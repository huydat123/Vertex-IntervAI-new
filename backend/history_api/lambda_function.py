import json
import os
from decimal import Decimal

import boto3
from boto3.dynamodb.conditions import Key

dynamodb = boto3.resource("dynamodb")

CVS_TABLE = os.environ["CVS_TABLE"]
INTERVIEWS_TABLE = os.environ["INTERVIEWS_TABLE"]
DEFAULT_USER_ID = "user_demo_001"
DEFAULT_LIMIT = 20

def response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
            "Access-Control-Allow-Methods": "OPTIONS,GET",
        },
        "body": json.dumps(from_dynamodb_value(body), ensure_ascii=False),
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

        if method != "GET":
            return response(405, {"message": "Method not allowed"})

        user_id = resolve_user_id(event, get_query_param(event, "userId"))
        limit = parse_limit(get_query_param(event, "limit"))
        cv_history = query_user_items(CVS_TABLE, user_id, limit)
        interview_history = query_user_items(INTERVIEWS_TABLE, user_id, limit)

        return response(
            200,
            {
                "message": "History loaded successfully",
                "userId": user_id,
                "cvHistory": sort_items_by_date(cv_history)[:limit],
                "interviewHistory": sort_items_by_date(interview_history)[:limit],
            },
        )

    except Exception as error:
        print("History API error:", str(error))
        return response(
            500,
            {
                "message": "Internal server error",
                "error": str(error),
            },
        )

def query_user_items(table_name, user_id, limit):
    table = dynamodb.Table(table_name)
    result = table.query(
        KeyConditionExpression=Key("userId").eq(user_id),
        Limit=limit,
        ScanIndexForward=False,
    )
    return result.get("Items", [])

def sort_items_by_date(items):
    return sorted(
        items,
        key=lambda item: item.get("completedAt") or item.get("analyzedAt") or item.get("updatedAt") or item.get("createdAt") or "",
        reverse=True,
    )

def parse_limit(value):
    try:
        limit = int(value or DEFAULT_LIMIT)
    except (TypeError, ValueError):
        limit = DEFAULT_LIMIT

    return max(1, min(50, limit))

def from_dynamodb_value(value):
    if isinstance(value, Decimal):
        if value % 1 == 0:
            return int(value)
        return float(value)

    if isinstance(value, list):
        return [from_dynamodb_value(item) for item in value]

    if isinstance(value, dict):
        return {key: from_dynamodb_value(item) for key, item in value.items()}

    return value
