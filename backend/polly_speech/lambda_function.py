import json
import os
import re
import time
import uuid
from datetime import datetime, timezone

import boto3

polly = boto3.client("polly")
s3 = boto3.client("s3")

VOICE_BUCKET = os.environ["VOICE_BUCKET"]
POLLY_VOICE_ID = os.environ.get("POLLY_VOICE_ID", "Joanna")
POLLY_ENGINE = os.environ.get("POLLY_ENGINE", "standard")
PRESIGNED_URL_EXPIRES_SECONDS = int(os.environ.get("PRESIGNED_URL_EXPIRES_SECONDS", "900"))

DEFAULT_USER_ID = "user_demo_001"
MAX_TEXT_CHARS = 2500


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

def resolve_user_id(event, requested_user_id=None):
    identity = get_request_identity(event)
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
        text = safe_string(body.get("text"))

        if not text:
            return response(400, {"message": "text is required"})

        user_id = sanitize_path_part(resolve_user_id(event, body.get("userId")))
        interview_id = sanitize_path_part(body.get("interviewId") or "interview_demo")
        question_index = sanitize_path_part(str(body.get("questionIndex", "0")))
        voice_id = safe_string(body.get("voiceId")) or POLLY_VOICE_ID
        engine = safe_string(body.get("engine")) or POLLY_ENGINE
        text = text[:MAX_TEXT_CHARS]

        speech = polly.synthesize_speech(
            Text=text,
            OutputFormat="mp3",
            VoiceId=voice_id,
            Engine=engine,
        )

        audio_bytes = speech["AudioStream"].read()
        now = datetime.now(timezone.utc).isoformat()
        audio_id = f"polly_{int(time.time())}_{uuid.uuid4().hex[:8]}"
        s3_key = f"voice/polly/{user_id}/{interview_id}/q{question_index}_{audio_id}.mp3"

        s3.put_object(
            Bucket=VOICE_BUCKET,
            Key=s3_key,
            Body=audio_bytes,
            ContentType="audio/mpeg",
            Metadata={
                "user-id": user_id,
                "interview-id": interview_id,
                "question-index": question_index,
                "created-at": now,
            },
        )

        audio_url = s3.generate_presigned_url(
            "get_object",
            Params={
                "Bucket": VOICE_BUCKET,
                "Key": s3_key,
            },
            ExpiresIn=PRESIGNED_URL_EXPIRES_SECONDS,
        )

        return response(
            200,
            {
                "message": "Question audio created successfully",
                "audioUrl": audio_url,
                "s3Bucket": VOICE_BUCKET,
                "s3Key": s3_key,
                "voiceId": voice_id,
                "engine": engine,
                "expiresIn": PRESIGNED_URL_EXPIRES_SECONDS,
            },
        )

    except Exception as error:
        print("Polly speech error:", str(error))
        return response(
            500,
            {
                "message": "Internal server error",
                "error": str(error),
            },
        )


def safe_string(value):
    if isinstance(value, str):
        return value.strip()

    return ""


def sanitize_path_part(value):
    value = safe_string(value) or "unknown"
    return re.sub(r"[^a-zA-Z0-9_.-]", "_", value)
