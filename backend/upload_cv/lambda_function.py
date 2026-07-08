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
dynamodb = boto3.resource("dynamodb")

CVS_TABLE = os.environ["CVS_TABLE"]
STORAGE_BUCKET = os.environ["STORAGE_BUCKET"]

ALLOWED_EXTENSIONS = {"pdf", "doc", "docx", "txt"}
MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024
DEFAULT_USER_ID = "user_demo_001"


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


def lambda_handler(event, context):
    try:
        method = get_http_method(event)

        if method == "OPTIONS":
            return response(200, {"message": "OK"})

        if method != "POST":
            return response(405, {"message": "Method not allowed"})

        body = json.loads(event.get("body") or "{}")
        user_id = sanitize_path_part(body.get("userId") or DEFAULT_USER_ID)
        file_name = safe_string(body.get("fileName"))
        file_content_base64 = safe_string(body.get("fileContent"))
        content_type = safe_string(body.get("contentType")) or "application/octet-stream"

        if not file_name or not file_content_base64:
            return response(
                400,
                {
                    "message": "fileName and fileContent are required",
                },
            )

        extension = get_extension(file_name)

        if extension not in ALLOWED_EXTENSIONS:
            return response(
                400,
                {
                    "message": "Only PDF, DOC, DOCX, and TXT files are allowed",
                },
            )

        file_bytes = decode_base64_file(file_content_base64)

        if len(file_bytes) > MAX_FILE_SIZE_BYTES:
            return response(
                400,
                {
                    "message": "File size must be less than 10MB",
                },
            )

        cv_id = f"cv_{int(time.time())}_{uuid.uuid4().hex[:8]}"
        s3_key = f"cv/{user_id}/{cv_id}.{extension}"

        s3.put_object(
            Bucket=STORAGE_BUCKET,
            Key=s3_key,
            Body=file_bytes,
            ContentType=content_type,
            Metadata={
                "original-file-name": sanitize_metadata_value(file_name),
                "user-id": sanitize_metadata_value(user_id),
            },
        )

        now = datetime.now(timezone.utc).isoformat()
        item = {
            "userId": user_id,
            "cvId": cv_id,
            "fileName": file_name,
            "fileSize": len(file_bytes),
            "contentType": content_type,
            "s3Bucket": STORAGE_BUCKET,
            "s3Key": s3_key,
            "status": "UPLOADED",
            "createdAt": now,
            "updatedAt": now,
        }

        table = dynamodb.Table(CVS_TABLE)
        table.put_item(Item=item)

        return response(
            200,
            {
                "message": "CV uploaded successfully",
                "cv": item,
            },
        )

    except (binascii.Error, ValueError) as error:
        return response(
            400,
            {
                "message": "Invalid upload request",
                "error": str(error),
            },
        )
    except Exception as error:
        print("Upload CV error:", str(error))
        return response(
            500,
            {
                "message": "Internal server error",
                "error": str(error),
            },
        )


def decode_base64_file(value):
    if "," in value:
        value = value.split(",", 1)[1]

    compact_value = re.sub(r"\s+", "", value)
    return base64.b64decode(compact_value, validate=True)


def get_extension(file_name):
    if "." not in file_name:
        return ""

    return file_name.rsplit(".", 1)[-1].lower()


def safe_string(value):
    if isinstance(value, str):
        return value.strip()

    return ""


def sanitize_path_part(value):
    value = safe_string(value) or DEFAULT_USER_ID
    return re.sub(r"[^a-zA-Z0-9_.-]", "_", value)


def sanitize_metadata_value(value):
    return re.sub(r"[^\x20-\x7E]", "_", value)[:256]
