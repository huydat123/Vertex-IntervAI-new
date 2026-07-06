import json
import os
from datetime import datetime, timezone

import boto3


dynamodb = boto3.resource("dynamodb")
USERS_TABLE = os.environ["USERS_TABLE"]

ALLOWED_FIELDS = {
    "fullName",
    "headline",
    "email",
    "phone",
    "location",
    "university",
    "github",
    "linkedin",
    "portfolio",
    "goal",
}

DEFAULT_USER_ID = "user_demo_001"


def response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
            "Access-Control-Allow-Methods": "OPTIONS,GET,POST",
        },
        "body": json.dumps(body, ensure_ascii=False),
    }


def get_http_method(event):
    return (
        event.get("httpMethod")
        or event.get("requestContext", {}).get("http", {}).get("method")
    )


def get_query_param(event, name):
    query = event.get("queryStringParameters") or {}
    return query.get(name)


def lambda_handler(event, context):
    try:
        method = get_http_method(event)

        if method == "OPTIONS":
            return response(200, {"message": "OK"})

        table = dynamodb.Table(USERS_TABLE)

        if method == "GET":
            user_id = get_query_param(event, "userId") or DEFAULT_USER_ID
            result = table.get_item(Key={"userId": user_id})
            profile = result.get("Item")

            if not profile:
                return response(404, {"message": "Profile not found"})

            return response(200, {"profile": profile})

        if method == "POST":
            body = json.loads(event.get("body") or "{}")
            user_id = body.get("userId") or DEFAULT_USER_ID
            now = datetime.now(timezone.utc).isoformat()

            profile = {
                "userId": user_id,
                "updatedAt": now,
            }

            for field in ALLOWED_FIELDS:
                value = body.get(field)

                if isinstance(value, str):
                    profile[field] = value.strip()

            existing = table.get_item(Key={"userId": user_id}).get("Item")

            if existing and existing.get("createdAt"):
                profile["createdAt"] = existing["createdAt"]
            else:
                profile["createdAt"] = now

            table.put_item(Item=profile)

            return response(
                200,
                {
                    "message": "Profile saved successfully",
                    "profile": profile,
                },
            )

        return response(405, {"message": "Method not allowed"})

    except Exception as error:
        print("Profile API error:", str(error))
        return response(
            500,
            {
                "message": "Internal server error",
                "error": str(error),
            },
        )
