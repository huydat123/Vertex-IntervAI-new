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
    "avatarUrl",
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

        table = dynamodb.Table(USERS_TABLE)

        if method == "GET":
            user_id = resolve_user_id(event, get_query_param(event, "userId"))
            result = table.get_item(Key={"userId": user_id})
            profile = result.get("Item")

            if not profile:
                return response(404, {"message": "Profile not found"})

            return response(200, {"profile": profile})

        if method == "POST":
            body = json.loads(event.get("body") or "{}")
            user_id = resolve_user_id(event, body.get("userId"))
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
