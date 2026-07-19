import base64
import binascii
import json
import os
import re
import time
import uuid
from datetime import datetime, timezone

import boto3

s3 = boto3.client("s3")
transcribe = boto3.client("transcribe")

VOICE_BUCKET = os.environ["VOICE_BUCKET"]
TRANSCRIBE_LANGUAGE_CODE = os.environ.get("TRANSCRIBE_LANGUAGE_CODE", "en-US")
TRANSCRIBE_OUTPUT_PREFIX = os.environ.get("TRANSCRIBE_OUTPUT_PREFIX", "voice/transcripts")

DEFAULT_USER_ID = "user_demo_001"
MAX_AUDIO_SIZE_BYTES = 15 * 1024 * 1024

SUPPORTED_MEDIA_FORMATS = {
    "audio/webm": "webm",
    "audio/webm;codecs=opus": "webm",
    "audio/ogg": "ogg",
    "audio/ogg;codecs=opus": "ogg",
    "audio/mp4": "mp4",
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/flac": "flac",
    "audio/x-m4a": "m4a",
    "audio/m4a": "m4a",
}


def response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
            "Access-Control-Allow-Methods": "OPTIONS,POST",
        },
        "body": json.dumps(body, ensure_ascii=False),
    }


def get_http_method(event):
    return (
        event.get("httpMethod")
        or event.get("requestContext", {}).get("http", {}).get("method")
    )


def get_authorizer_claims(event):
    authorizer = event.get("requestContext", {}).get("authorizer") or {}
    return (
        authorizer.get("jwt", {}).get("claims")
        or authorizer.get("claims")
        or {}
    )

def get_request_identity(event):
    claims = get_authorizer_claims(event)
    groups = parse_groups(claims.get("cognito:groups"))
    role = clean_identity_string(claims.get("custom:role")) or ("admin" if "admin" in groups else "user")
    user_id = clean_identity_string(
        claims.get("sub")
        or claims.get("username")
        or claims.get("cognito:username")
    )

    return {
        "userId": user_id,
        "role": role,
        "isAdmin": role == "admin" or "admin" in groups,
        "isAuthenticated": bool(user_id),
    }

def resolve_user_id(identity, requested_user_id=None):
    requested = clean_identity_string(requested_user_id) or DEFAULT_USER_ID

    if identity["isAuthenticated"]:
        if identity["isAdmin"] and requested:
            return requested
        return identity["userId"]

    return requested

def parse_groups(value):
    if isinstance(value, list):
        return [str(item).lower() for item in value]

    if isinstance(value, str):
        return [item.strip().lower() for item in value.split(",") if item.strip()]

    return []

def clean_identity_string(value):
    return value.strip() if isinstance(value, str) else ""

def lambda_handler(event, context):
    try:
        method = get_http_method(event)

        if method == "OPTIONS":
            return response(200, {"message": "OK"})

        if method != "POST":
            return response(405, {"message": "Method not allowed"})

        body = json.loads(event.get("body") or "{}")
        action = safe_string(body.get("action")) or "start"
        identity = get_request_identity(event)

        if action == "start":
            return start_transcription(body, identity)

        if action == "status":
            return get_transcription_status(body, identity)

        return response(400, {"message": "Unsupported action"})

    except (binascii.Error, ValueError) as error:
        return response(
            400,
            {
                "message": "Invalid transcription request",
                "error": str(error),
            },
        )
    except Exception as error:
        print("Transcribe audio error:", str(error))
        return response(
            500,
            {
                "message": "Internal server error",
                "error": str(error),
            },
        )


def start_transcription(body, identity):
    user_id = sanitize_path_part(resolve_user_id(identity, body.get("userId")))
    interview_id = sanitize_path_part(body.get("interviewId") or "interview_demo")
    question_index = sanitize_path_part(str(body.get("questionIndex", "0")))
    content_type = normalize_content_type(body.get("contentType"))
    media_format = get_media_format(content_type)
    file_content = safe_string(body.get("fileContent"))

    if not file_content:
        return response(400, {"message": "fileContent is required"})

    audio_bytes = decode_base64_file(file_content)

    if len(audio_bytes) > MAX_AUDIO_SIZE_BYTES:
        return response(400, {"message": "Audio file must be less than 15MB"})

    now = datetime.now(timezone.utc).isoformat()
    audio_id = f"audio_{int(time.time())}_{uuid.uuid4().hex[:8]}"
    audio_key = f"voice/answers/{user_id}/{interview_id}/q{question_index}_{audio_id}.{media_format}"
    job_name = build_job_name(user_id, interview_id, question_index)
    transcript_key = f"{TRANSCRIBE_OUTPUT_PREFIX}/{user_id}/{job_name}.json"

    s3.put_object(
        Bucket=VOICE_BUCKET,
        Key=audio_key,
        Body=audio_bytes,
        ContentType=content_type,
        Metadata={
            "user-id": user_id,
            "interview-id": interview_id,
            "question-index": question_index,
            "created-at": now,
        },
    )

    transcribe.start_transcription_job(
        TranscriptionJobName=job_name,
        LanguageCode=safe_string(body.get("languageCode")) or TRANSCRIBE_LANGUAGE_CODE,
        MediaFormat=media_format,
        Media={
            "MediaFileUri": f"s3://{VOICE_BUCKET}/{audio_key}",
        },
        OutputBucketName=VOICE_BUCKET,
        OutputKey=transcript_key,
    )

    return response(
        200,
        {
            "message": "Transcription job started",
            "jobName": job_name,
            "status": "IN_PROGRESS",
            "audioBucket": VOICE_BUCKET,
            "audioKey": audio_key,
            "transcriptBucket": VOICE_BUCKET,
            "transcriptKey": transcript_key,
            "mediaFormat": media_format,
            "languageCode": safe_string(body.get("languageCode")) or TRANSCRIBE_LANGUAGE_CODE,
        },
    )


def get_transcription_status(body, identity):
    job_name = safe_string(body.get("jobName"))

    if not job_name:
        return response(400, {"message": "jobName is required"})

    if identity["isAuthenticated"] and not identity["isAdmin"]:
        user_prefix = f"tgai-{sanitize_path_part(identity['userId'])}-"

        if not job_name.startswith(user_prefix):
            return response(403, {"message": "You cannot read another user's transcription job"})

    result = transcribe.get_transcription_job(TranscriptionJobName=job_name)
    job = result["TranscriptionJob"]
    status = job["TranscriptionJobStatus"]
    payload = {
        "message": "Transcription status loaded",
        "jobName": job_name,
        "status": status,
    }

    if status == "FAILED":
        payload["failureReason"] = job.get("FailureReason", "Transcription failed")

    if status == "COMPLETED":
        transcript_key = find_transcript_key(job_name)
        transcript = load_transcript_text(transcript_key)
        payload.update(
            {
                "transcript": transcript,
                "transcriptBucket": VOICE_BUCKET,
                "transcriptKey": transcript_key,
                "transcriptUri": job.get("Transcript", {}).get("TranscriptFileUri"),
            }
        )

    return response(200, payload)


def find_transcript_key(job_name):
    prefix = f"{TRANSCRIBE_OUTPUT_PREFIX}/"
    result = s3.list_objects_v2(
        Bucket=VOICE_BUCKET,
        Prefix=prefix,
    )

    for item in result.get("Contents", []):
        key = item["Key"]
        if key.endswith(f"{job_name}.json"):
            return key

    raise ValueError("Transcript output was not found in S3 yet")


def load_transcript_text(transcript_key):
    result = s3.get_object(Bucket=VOICE_BUCKET, Key=transcript_key)
    transcript_json = json.loads(result["Body"].read())
    transcripts = transcript_json.get("results", {}).get("transcripts", [])

    if not transcripts:
        return ""

    return transcripts[0].get("transcript", "")


def decode_base64_file(value):
    if "," in value:
        value = value.split(",", 1)[1]

    compact_value = re.sub(r"\s+", "", value)
    return base64.b64decode(compact_value, validate=True)


def get_media_format(content_type):
    if content_type in SUPPORTED_MEDIA_FORMATS:
        return SUPPORTED_MEDIA_FORMATS[content_type]

    short_type = content_type.split(";", 1)[0]
    if short_type in SUPPORTED_MEDIA_FORMATS:
        return SUPPORTED_MEDIA_FORMATS[short_type]

    return "webm"


def normalize_content_type(value):
    value = safe_string(value).lower()
    return value or "audio/webm"


def build_job_name(user_id, interview_id, question_index):
    raw_name = f"tgai-{user_id}-{interview_id}-q{question_index}-{int(time.time())}-{uuid.uuid4().hex[:8]}"
    clean_name = re.sub(r"[^a-zA-Z0-9._-]", "-", raw_name)
    return clean_name[:190]


def safe_string(value):
    if isinstance(value, str):
        return value.strip()

    return ""


def sanitize_path_part(value):
    value = safe_string(value) or "unknown"
    return re.sub(r"[^a-zA-Z0-9_.-]", "_", value)
