import csv
import json
import os
import re
import time
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from io import StringIO

import boto3
from botocore.exceptions import ClientError

dynamodb = boto3.resource("dynamodb")
cognito = boto3.client("cognito-idp")
s3 = boto3.client("s3")
ses = boto3.client("ses", region_name=os.environ.get("SES_REGION") or os.environ.get("AWS_REGION", "ap-southeast-1"))
bedrock_runtime = boto3.client(
    "bedrock-runtime",
    region_name=os.environ.get("BEDROCK_REGION", "ap-southeast-1"),
)

USERS_TABLE = os.environ.get("USERS_TABLE", "Users")
CVS_TABLE = os.environ.get("CVS_TABLE", "CVs")
INTERVIEWS_TABLE = os.environ.get("INTERVIEWS_TABLE", "Interviews")
ADMIN_AUDIT_TABLE = os.environ.get("ADMIN_AUDIT_TABLE", "AdminAuditLogs")
ADMIN_EXPORT_BUCKET = os.environ.get("ADMIN_EXPORT_BUCKET") or os.environ.get("STORAGE_BUCKET", "")
ADMIN_EXPORT_PREFIX = os.environ.get("ADMIN_EXPORT_PREFIX", "exports/admin")
COGNITO_USER_POOL_ID = os.environ.get("COGNITO_USER_POOL_ID", "")
MAX_ADMIN_ITEMS = int(os.environ.get("MAX_ADMIN_ITEMS", "200"))
PRESIGNED_URL_EXPIRES_SECONDS = int(os.environ.get("PRESIGNED_URL_EXPIRES_SECONDS", "300"))
BEDROCK_MODEL_ID = os.environ.get("BEDROCK_MODEL_ID", "apac.amazon.nova-lite-v1:0")
SES_FROM_EMAIL = os.environ.get("SES_FROM_EMAIL", "")
SES_REPLY_TO_EMAIL = os.environ.get("SES_REPLY_TO_EMAIL", "")
DEBUG_ADMIN_AUTH = os.environ.get("DEBUG_ADMIN_AUTH", "false").lower() == "true"

def response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
            "Access-Control-Allow-Methods": "OPTIONS,GET,POST",
        },
        "body": json.dumps(from_dynamodb_value(body), ensure_ascii=False),
    }

def get_http_method(event):
    return (
        event.get("httpMethod")
        or event.get("requestContext", {}).get("http", {}).get("method")
    )

def get_path(event):
    return (
        event.get("rawPath")
        or event.get("path")
        or event.get("requestContext", {}).get("http", {}).get("path")
        or ""
    )

def parse_body(event):
    try:
        return json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return {}

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
    role = (clean_string(claims.get("custom:role")) or ("admin" if "admin" in groups else "user")).lower()
    username = clean_string(claims.get("cognito:username") or claims.get("username"))
    user_id = clean_string(claims.get("sub") or username)

    return {
        "userId": user_id,
        "username": username,
        "email": clean_string(claims.get("email")),
        "role": role,
        "groups": groups,
        "isAdmin": role == "admin" or "admin" in groups,
        "isAuthenticated": bool(user_id),
    }

def parse_groups(value):
    if isinstance(value, list):
        return [str(item).strip().lower() for item in value if str(item).strip()]

    if isinstance(value, str):
        normalized = value.strip()

        if not normalized:
            return []

        try:
            decoded = json.loads(normalized)
            if isinstance(decoded, list):
                return parse_groups(decoded)
        except json.JSONDecodeError:
            pass

        return [
            item.strip().strip("\"'[]").lower()
            for item in normalized.split(",")
            if item.strip().strip("\"'[]")
        ]

    return []

def clean_string(value):
    return value.strip() if isinstance(value, str) else ""

def lambda_handler(event, context):
    try:
        method = get_http_method(event)

        if method == "OPTIONS":
            return response(200, {"message": "OK"})

        if method not in {"GET", "POST"}:
            return response(405, {"message": "Method not allowed"})

        identity = get_request_identity(event)

        if not identity["isAdmin"]:
            body = {"message": "Admin role is required"}
            if DEBUG_ADMIN_AUTH:
                body["debug"] = build_auth_debug(event, identity)
            return response(403, body)

        path = get_path(event)

        if method == "POST":
            body = parse_body(event)

            if path.endswith("/admin/cvs/presign"):
                return create_cv_presigned_url(identity, body)

            if path.endswith("/admin/review-summary"):
                return create_review_summary(identity, body)

            if path.endswith("/admin/export"):
                return export_admin_csv(identity, body)

            if path.endswith("/admin/feedback/email"):
                return send_feedback_email(identity, body)

            if path.endswith("/admin/users/action"):
                return manage_user_account(identity, body)

            if path.endswith("/admin/interviews/delete"):
                return delete_interview_record(identity, body)

            return response(404, {"message": "Admin route not found"})

        users_scan = safe_scan_table(USERS_TABLE)
        cv_scan = safe_scan_table(CVS_TABLE)
        interview_scan = safe_scan_table(INTERVIEWS_TABLE)
        users_table_items = users_scan["items"]
        cv_items = cv_scan["items"]
        interview_items = interview_scan["items"]
        user_result = build_user_rows_result(users_table_items, cv_items, interview_items)
        table_diagnostics = {
            "usersTable": users_scan["diagnostics"],
            "cvsTable": cv_scan["diagnostics"],
            "interviewsTable": interview_scan["diagnostics"],
        }

        if path.endswith("/admin/summary"):
            return response(
                200,
                {
                    "message": "Admin summary loaded",
                    "summary": build_summary(user_result["users"], cv_items, interview_items),
                    "userSource": user_result["source"],
                    "diagnostics": user_result["diagnostics"],
                    "tableDiagnostics": table_diagnostics,
                },
            )

        if path.endswith("/admin/users"):
            return response(
                200,
                {
                    "message": "Admin users loaded",
                    "users": user_result["users"],
                    "source": user_result["source"],
                    "diagnostics": user_result["diagnostics"],
                    "tableDiagnostics": table_diagnostics,
                },
            )

        if path.endswith("/admin/cvs"):
            return response(
                200,
                {
                    "message": "Admin CVs loaded",
                    "cvs": [sanitize_cv_item(item) for item in sort_items_by_date(cv_items)],
                    "tableDiagnostics": table_diagnostics,
                },
            )

        if path.endswith("/admin/interviews"):
            return response(
                200,
                {
                    "message": "Admin interviews loaded",
                    "interviews": [sanitize_interview_item(item) for item in sort_items_by_date(interview_items)],
                    "tableDiagnostics": table_diagnostics,
                },
            )

        if path.endswith("/admin/review-queue"):
            return response(
                200,
                {
                    "message": "Admin review queue loaded",
                    "reviewItems": build_review_queue(user_result["users"], cv_items, interview_items),
                    "tableDiagnostics": table_diagnostics,
                },
            )

        if path.endswith("/admin/audit"):
            return response(
                200,
                {
                    "message": "Admin audit loaded",
                    **get_audit_logs(),
                },
            )

        return response(404, {"message": "Admin route not found"})

    except Exception as error:
        print("Admin API error:", str(error))
        return response(
            500,
            {
                "message": "Internal server error",
                "error": str(error),
            },
        )

def scan_table(table_name):
    table = dynamodb.Table(table_name)
    items = []
    scan_kwargs = {"Limit": min(100, MAX_ADMIN_ITEMS)}

    while len(items) < MAX_ADMIN_ITEMS:
        result = table.scan(**scan_kwargs)
        items.extend(result.get("Items", []))

        last_key = result.get("LastEvaluatedKey")
        if not last_key:
            break

        scan_kwargs["ExclusiveStartKey"] = last_key

    return items[:MAX_ADMIN_ITEMS]

def safe_scan_table(table_name):
    diagnostics = {
        "tableName": table_name,
        "loadedCount": 0,
        "errorCode": "",
        "errorMessage": "",
    }

    try:
        items = scan_table(table_name)
        diagnostics["loadedCount"] = len(items)
        return {"items": items, "diagnostics": diagnostics}
    except ClientError as error:
        error_info = error.response.get("Error", {})
        diagnostics["errorCode"] = error_info.get("Code", "ClientError")
        diagnostics["errorMessage"] = error_info.get("Message", str(error))
        print("Could not scan table:", table_name, diagnostics["errorCode"], diagnostics["errorMessage"])
        return {"items": [], "diagnostics": diagnostics}

def create_cv_presigned_url(identity, body):
    user_id = clean_string(body.get("userId"))
    cv_id = clean_string(body.get("cvId"))

    if not user_id or not cv_id:
        return response(400, {"message": "userId and cvId are required"})

    cv_item = get_cv_item(user_id, cv_id)

    if not cv_item:
        return response(404, {"message": "CV not found"})

    bucket = clean_string(cv_item.get("s3Bucket"))
    key = clean_string(cv_item.get("s3Key"))

    if not bucket or not key:
        return response(400, {"message": "CV does not have an S3 location"})

    file_name = safe_filename(cv_item.get("fileName") or f"{cv_id}.pdf")
    url = s3.generate_presigned_url(
        "get_object",
        Params={
            "Bucket": bucket,
            "Key": key,
            "ResponseContentDisposition": f'inline; filename="{file_name}"',
        },
        ExpiresIn=PRESIGNED_URL_EXPIRES_SECONDS,
    )

    write_audit_log(
        identity,
        "CV_PRESIGNED_URL_CREATED",
        "CV",
        cv_id,
        {
            "targetUserId": user_id,
            "fileName": cv_item.get("fileName", ""),
            "expiresIn": PRESIGNED_URL_EXPIRES_SECONDS,
        },
    )

    return response(
        200,
        {
            "message": "CV presigned URL created",
            "url": url,
            "expiresIn": PRESIGNED_URL_EXPIRES_SECONDS,
            "cv": sanitize_cv_item(cv_item),
        },
    )

def create_review_summary(identity, body):
    users_table_items = scan_table(USERS_TABLE)
    cv_items = scan_table(CVS_TABLE)
    interview_items = scan_table(INTERVIEWS_TABLE)
    user_result = build_user_rows_result(users_table_items, cv_items, interview_items)
    review_items = build_review_queue(user_result["users"], cv_items, interview_items)
    focus_user_id = clean_string(body.get("userId"))
    focus_items = review_items

    if focus_user_id:
        focus_items = [item for item in review_items if item.get("userId") == focus_user_id]

    focus_items = focus_items[:12]

    if not focus_items:
        return response(
            200,
            {
                "message": "No review items found",
                "summary": "No low-score, incomplete, or unreviewed records need attention right now.",
                "reviewItems": [],
            },
        )

    summary = summarize_review_queue_with_bedrock(focus_items)

    write_audit_log(
        identity,
        "REVIEW_SUMMARY_GENERATED",
        "REVIEW_QUEUE",
        focus_user_id or "all",
        {
            "itemCount": len(focus_items),
            "usedBedrock": summary.get("source") == "bedrock",
        },
    )

    return response(
        200,
        {
            "message": "Review summary generated",
            "summary": summary["text"],
            "source": summary["source"],
            "reviewItems": focus_items,
        },
    )

def export_admin_csv(identity, body):
    dataset = clean_string(body.get("dataset")).lower() or "users"

    if not ADMIN_EXPORT_BUCKET:
        return response(400, {"message": "ADMIN_EXPORT_BUCKET or STORAGE_BUCKET env var is required"})

    users_table_items = scan_table(USERS_TABLE)
    cv_items = scan_table(CVS_TABLE)
    interview_items = scan_table(INTERVIEWS_TABLE)
    user_result = build_user_rows_result(users_table_items, cv_items, interview_items)
    audit_result = get_audit_logs()
    headers, rows = build_export_data(dataset, user_result["users"], cv_items, interview_items, audit_result.get("auditLogs", []))

    if not headers:
        return response(400, {"message": "dataset must be users, cvs, interviews, review-queue, or audit"})

    csv_text = build_csv_text(headers, rows)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    admin_id = sanitize_key_part(identity.get("userId") or "admin")
    key = f"{ADMIN_EXPORT_PREFIX.strip('/')}/{admin_id}/{timestamp}-{dataset}.csv"

    s3.put_object(
        Bucket=ADMIN_EXPORT_BUCKET,
        Key=key,
        Body=csv_text.encode("utf-8-sig"),
        ContentType="text/csv; charset=utf-8",
        Metadata={
            "dataset": sanitize_metadata_value(dataset),
            "admin-user-id": sanitize_metadata_value(identity.get("userId") or ""),
        },
    )

    url = s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": ADMIN_EXPORT_BUCKET, "Key": key},
        ExpiresIn=PRESIGNED_URL_EXPIRES_SECONDS,
    )

    write_audit_log(
        identity,
        "CSV_EXPORTED",
        "EXPORT",
        dataset,
        {
            "bucket": ADMIN_EXPORT_BUCKET,
            "key": key,
            "rowCount": len(rows),
            "expiresIn": PRESIGNED_URL_EXPIRES_SECONDS,
        },
    )

    return response(
        200,
        {
            "message": "CSV export created",
            "dataset": dataset,
            "rowCount": len(rows),
            "s3Bucket": ADMIN_EXPORT_BUCKET,
            "s3Key": key,
            "url": url,
            "expiresIn": PRESIGNED_URL_EXPIRES_SECONDS,
        },
    )

def send_feedback_email(identity, body):
    recipient = clean_string(body.get("recipientEmail"))
    subject = clean_string(body.get("subject"))
    message = clean_string(body.get("message"))
    target_user_id = clean_string(body.get("userId"))

    if not SES_FROM_EMAIL:
        return response(400, {"message": "SES_FROM_EMAIL env var is required"})

    if not is_valid_email(recipient):
        return response(400, {"message": "recipientEmail must be a valid email"})

    if not subject or not message:
        return response(400, {"message": "subject and message are required"})

    params = {
        "Source": SES_FROM_EMAIL,
        "Destination": {"ToAddresses": [recipient]},
        "Message": {
            "Subject": {"Data": subject[:180], "Charset": "UTF-8"},
            "Body": {"Text": {"Data": message[:8000], "Charset": "UTF-8"}},
        },
    }

    if SES_REPLY_TO_EMAIL:
        params["ReplyToAddresses"] = [SES_REPLY_TO_EMAIL]

    try:
        result = ses.send_email(**params)
    except ClientError as error:
        error_info = error.response.get("Error", {})
        error_code = error_info.get("Code", "ClientError")
        error_message = error_info.get("Message", str(error))
        print("SES send email failed:", error_code, error_message)

        status_code = 400
        if error_code in {"AccessDenied", "AccessDeniedException", "UnauthorizedOperation"}:
            status_code = 403
        elif error_code in {"Throttling", "ThrottlingException", "TooManyRequestsException"}:
            status_code = 429

        return response(
            status_code,
            {
                "message": f"SES email failed: {error_code}",
                "error": error_message,
                "sesErrorCode": error_code,
                "sesErrorMessage": error_message,
            },
        )

    message_id = result.get("MessageId", "")

    write_audit_log(
        identity,
        "FEEDBACK_EMAIL_SENT",
        "USER",
        target_user_id or recipient,
        {
            "recipientEmail": recipient,
            "subject": subject[:180],
            "sesMessageId": message_id,
        },
    )

    return response(
        200,
        {
            "message": "Feedback email sent",
            "messageId": message_id,
        },
    )

def manage_user_account(identity, body):
    action = clean_string(body.get("action")).lower()
    target_user_id = clean_string(body.get("userId"))
    target_username = clean_string(body.get("username"))

    if action not in {"lock", "unlock", "delete"}:
        return response(400, {"message": "action must be lock, unlock, or delete"})

    if action in {"lock", "unlock"} and not COGNITO_USER_POOL_ID:
        return response(400, {"message": "User pool is not configured for account lock/unlock"})

    target_user = find_cognito_user(target_username, target_user_id)

    if not target_user:
        if action == "delete" and target_user_id:
            delete_user_profile(target_user_id)
            write_audit_log(
                identity,
                "USER_PROFILE_DELETED",
                "USER",
                target_user_id,
                {"targetUserId": target_user_id, "source": "profile"},
            )
            return response(
                200,
                {
                    "message": "Profile-only user deleted",
                    "action": action,
                    "userId": target_user_id,
                },
            )

        return response(404, {"message": "User account not found"})

    if is_admin_account(target_user):
        return response(400, {"message": "Admin accounts cannot be managed from the candidate user list"})

    if is_same_identity(identity, target_user):
        return response(400, {"message": "You cannot manage your own admin account"})

    username = target_user.get("username")
    user_id = target_user.get("userId")

    if action == "lock":
        cognito.admin_disable_user(UserPoolId=COGNITO_USER_POOL_ID, Username=username)
        target_user["enabled"] = False
        target_user["access"] = "LOCKED"
        audit_action = "USER_LOCKED"
        message = "User locked"
    elif action == "unlock":
        cognito.admin_enable_user(UserPoolId=COGNITO_USER_POOL_ID, Username=username)
        target_user["enabled"] = True
        target_user["access"] = "ACTIVE"
        audit_action = "USER_UNLOCKED"
        message = "User unlocked"
    else:
        cognito.admin_delete_user(UserPoolId=COGNITO_USER_POOL_ID, Username=username)
        delete_user_profile(user_id)
        audit_action = "USER_DELETED"
        message = "User deleted"

    write_audit_log(
        identity,
        audit_action,
        "USER",
        user_id or username,
        {
            "targetUserId": user_id,
            "targetUsername": username,
            "targetEmail": target_user.get("email", ""),
            "targetStatus": target_user.get("status", ""),
        },
    )

    return response(
        200,
        {
            "message": message,
            "action": action,
            "user": target_user,
        },
    )

def delete_interview_record(identity, body):
    user_id = clean_string(body.get("userId"))
    interview_id = clean_string(body.get("interviewId"))

    if not user_id or not interview_id:
        return response(400, {"message": "userId and interviewId are required"})

    table = dynamodb.Table(INTERVIEWS_TABLE)

    try:
        result = table.delete_item(
            Key={"userId": user_id, "interviewId": interview_id},
            ConditionExpression="attribute_exists(userId) AND attribute_exists(interviewId)",
            ReturnValues="ALL_OLD",
        )
    except ClientError as error:
        error_info = error.response.get("Error", {})

        if error_info.get("Code") == "ConditionalCheckFailedException":
            return response(404, {"message": "Interview not found"})

        raise

    deleted_item = result.get("Attributes", {})
    role = clean_string(deleted_item.get("role")) or "Interview"

    write_audit_log(
        identity,
        "INTERVIEW_DELETED",
        "INTERVIEW",
        interview_id,
        {
            "targetUserId": user_id,
            "interviewId": interview_id,
            "role": role,
            "status": deleted_item.get("status", ""),
            "overallScore": deleted_item.get("overallScore", 0),
        },
    )

    return response(
        200,
        {
            "message": "Interview deleted",
            "userId": user_id,
            "interviewId": interview_id,
        },
    )

def get_cv_item(user_id, cv_id):
    table = dynamodb.Table(CVS_TABLE)
    result = table.get_item(Key={"userId": user_id, "cvId": cv_id})
    return result.get("Item")

def build_summary(users, cvs, interviews):
    analyzed_cvs = [item for item in cvs if item.get("status") == "ANALYZED" or item.get("cvScore")]
    completed_interviews = [item for item in interviews if item.get("status") == "COMPLETED" or item.get("completedAt")]

    return {
        "totalUsers": len(users),
        "totalCvs": len(cvs),
        "analyzedCvs": len(analyzed_cvs),
        "totalInterviews": len(interviews),
        "completedInterviews": len(completed_interviews),
        "averageCvScore": average_score(analyzed_cvs, "cvScore"),
        "averageInterviewScore": average_score(completed_interviews, "overallScore"),
    }

def build_review_queue(users, cvs, interviews):
    users_by_id = {item.get("userId"): item for item in users if item.get("userId")}
    review_items = []

    for item in interviews:
        reasons = []
        status = clean_string(item.get("status")).upper()
        score = to_number(item.get("overallScore"))
        answered = to_number(item.get("answeredQuestions"))
        total = to_number(item.get("totalQuestions"))

        if status == "IN_PROGRESS":
            reasons.append("Interview still in progress")

        if score and score < 60:
            reasons.append("Interview score below 60")

        if total and answered < total:
            reasons.append("Not all questions answered")

        if reasons:
            review_items.append(
                {
                    "type": "interview",
                    "id": item.get("interviewId", ""),
                    "userId": item.get("userId", ""),
                    "userName": display_user_name(users_by_id.get(item.get("userId"), {}), item.get("userId", "")),
                    "title": item.get("role") or "Interview",
                    "status": status or "UNKNOWN",
                    "score": int(score),
                    "priority": review_priority(score, status, reasons),
                    "reasons": reasons,
                    "updatedAt": item.get("completedAt") or item.get("updatedAt") or item.get("createdAt") or "",
                }
            )

    for item in cvs:
        reasons = []
        status = clean_string(item.get("status")).upper()
        score = to_number(item.get("cvScore"))

        if status != "ANALYZED":
            reasons.append("CV is not analyzed yet")

        if score and score < 60:
            reasons.append("CV score below 60")

        if reasons:
            review_items.append(
                {
                    "type": "cv",
                    "id": item.get("cvId", ""),
                    "userId": item.get("userId", ""),
                    "userName": display_user_name(users_by_id.get(item.get("userId"), {}), item.get("userId", "")),
                    "title": item.get("fileName") or item.get("suggestedPosition") or "CV",
                    "status": status or "UNKNOWN",
                    "score": int(score),
                    "priority": review_priority(score, status, reasons),
                    "reasons": reasons,
                    "updatedAt": item.get("analyzedAt") or item.get("updatedAt") or item.get("createdAt") or "",
                }
            )

    return sorted(
        review_items,
        key=lambda item: (item.get("priority", 0), item.get("updatedAt", "")),
        reverse=True,
    )[:MAX_ADMIN_ITEMS]

def review_priority(score, status, reasons):
    priority = len(reasons) * 10

    if status == "IN_PROGRESS":
        priority += 20

    if score and score < 45:
        priority += 30
    elif score and score < 60:
        priority += 20

    return priority

def summarize_review_queue_with_bedrock(review_items):
    prompt = build_review_summary_prompt(review_items)

    try:
        result = bedrock_runtime.invoke_model(
            modelId=BEDROCK_MODEL_ID,
            contentType="application/json",
            accept="application/json",
            body=json.dumps(
                {
                    "schemaVersion": "messages-v1",
                    "messages": [
                        {
                            "role": "user",
                            "content": [{"text": prompt}],
                        }
                    ],
                    "inferenceConfig": {
                        "maxTokens": 900,
                        "temperature": 0.25,
                        "topP": 0.9,
                    },
                }
            ),
        )
        payload = json.loads(result["body"].read())
        text = "".join(
            part.get("text", "")
            for part in payload.get("output", {}).get("message", {}).get("content", [])
        ).strip()

        if text:
            return {"source": "bedrock", "text": text}
    except ClientError as error:
        error_info = error.response.get("Error", {})
        print("Bedrock review summary failed:", error_info.get("Code"), error_info.get("Message"))
    except Exception as error:
        print("Bedrock review summary failed:", str(error))

    return {"source": "fallback", "text": build_fallback_review_summary(review_items)}

def build_review_summary_prompt(review_items):
    compact_items = [
        {
            "type": item.get("type"),
            "user": item.get("userName") or item.get("userId"),
            "title": item.get("title"),
            "status": item.get("status"),
            "score": item.get("score"),
            "reasons": item.get("reasons"),
        }
        for item in review_items
    ]

    return (
        "You are an admin assistant for a technical interview platform. "
        "Write a concise Vietnamese operations summary for the admin. "
        "Include: priority risks, who needs attention, and 3 recommended actions. "
        "Do not use markdown tables.\n\n"
        f"Review queue JSON:\n{json.dumps(compact_items, ensure_ascii=False)}"
    )

def build_fallback_review_summary(review_items):
    critical = [item for item in review_items if item.get("score", 0) and item.get("score", 0) < 45]
    in_progress = [item for item in review_items if item.get("status") == "IN_PROGRESS"]
    users = unique_items([item.get("userName") or item.get("userId") for item in review_items])[:5]

    return (
        f"Có {len(review_items)} mục cần admin xem lại. "
        f"{len(critical)} mục có điểm rất thấp và {len(in_progress)} interview còn đang dang dở. "
        f"Ứng viên cần chú ý: {', '.join(users) if users else 'chưa có dữ liệu rõ ràng'}. "
        "Đề xuất: ưu tiên xem các điểm dưới 45, nhắc ứng viên hoàn thành interview còn dang dở, "
        "và gửi email feedback cá nhân hóa sau khi xem transcript hoặc CV."
    )

def build_export_data(dataset, users, cvs, interviews, audit_logs):
    if dataset == "users":
        return (
            ["userId", "fullName", "email", "role", "status", "groups", "latestCvScore", "latestInterviewScore"],
            [
                [
                    item.get("userId", ""),
                    item.get("fullName", ""),
                    item.get("email", ""),
                    item.get("role", ""),
                    item.get("status", ""),
                    ", ".join(item.get("groups", [])),
                    item.get("latestCvScore", 0),
                    item.get("latestInterviewScore", 0),
                ]
                for item in users
            ],
        )

    if dataset == "cvs":
        return (
            ["userId", "cvId", "fileName", "status", "cvScore", "suggestedPosition", "createdAt", "updatedAt", "analyzedAt"],
            [
                [
                    item.get("userId", ""),
                    item.get("cvId", ""),
                    item.get("fileName", ""),
                    item.get("status", ""),
                    item.get("cvScore", 0),
                    item.get("suggestedPosition", ""),
                    item.get("createdAt", ""),
                    item.get("updatedAt", ""),
                    item.get("analyzedAt", ""),
                ]
                for item in sort_items_by_date(cvs)
            ],
        )

    if dataset == "interviews":
        return (
            ["userId", "interviewId", "role", "status", "overallScore", "answeredQuestions", "totalQuestions", "createdAt", "completedAt"],
            [
                [
                    item.get("userId", ""),
                    item.get("interviewId", ""),
                    item.get("role", ""),
                    item.get("status", ""),
                    item.get("overallScore", 0),
                    item.get("answeredQuestions", 0),
                    item.get("totalQuestions", 0),
                    item.get("createdAt", ""),
                    item.get("completedAt", ""),
                ]
                for item in sort_items_by_date(interviews)
            ],
        )

    if dataset == "review-queue":
        review_items = build_review_queue(users, cvs, interviews)
        return (
            ["type", "id", "userId", "userName", "title", "status", "score", "priority", "reasons", "updatedAt"],
            [
                [
                    item.get("type", ""),
                    item.get("id", ""),
                    item.get("userId", ""),
                    item.get("userName", ""),
                    item.get("title", ""),
                    item.get("status", ""),
                    item.get("score", 0),
                    item.get("priority", 0),
                    "; ".join(item.get("reasons", [])),
                    item.get("updatedAt", ""),
                ]
                for item in review_items
            ],
        )

    if dataset == "audit":
        return (
            ["createdAt", "adminUserId", "adminEmail", "action", "resourceType", "resourceId", "details"],
            [
                [
                    item.get("createdAt", ""),
                    item.get("adminUserId", ""),
                    item.get("adminEmail", ""),
                    item.get("action", ""),
                    item.get("resourceType", ""),
                    item.get("resourceId", ""),
                    json.dumps(item.get("details", {}), ensure_ascii=False),
                ]
                for item in audit_logs
            ],
        )

    return [], []

def build_csv_text(headers, rows):
    output = StringIO()
    writer = csv.writer(output)
    writer.writerow(headers)
    writer.writerows(rows)
    return output.getvalue()

def build_user_rows_result(profile_items, cv_items, interview_items):
    profiles_by_user_id = {item.get("userId"): item for item in profile_items if item.get("userId")}
    latest_cvs = latest_items_by_user(cv_items)
    latest_interviews = latest_items_by_user(interview_items)
    cognito_result = list_cognito_users()
    cognito_users = cognito_result["users"]

    if cognito_users:
        rows = [
            enrich_user_row(user, profiles_by_user_id, latest_cvs, latest_interviews)
            for user in cognito_users
        ]
        return {
            "users": [row for row in rows if not is_admin_account(row)],
            "source": "cognito",
            "diagnostics": cognito_result["diagnostics"],
        }

    user_ids = set(profiles_by_user_id) | set(latest_cvs) | set(latest_interviews)
    rows = [
        enrich_user_row(
            {
                "userId": user_id,
                "email": profiles_by_user_id.get(user_id, {}).get("email", ""),
                "fullName": profiles_by_user_id.get(user_id, {}).get("fullName", ""),
                "role": profiles_by_user_id.get(user_id, {}).get("role", "user"),
                "status": "PROFILE_ONLY",
                "groups": [],
            },
            profiles_by_user_id,
            latest_cvs,
            latest_interviews,
        )
        for user_id in sorted(user_ids)
    ]
    return {
        "users": [row for row in rows if not is_admin_account(row)],
        "source": "dynamodb",
        "diagnostics": cognito_result["diagnostics"],
    }

def list_cognito_users():
    diagnostics = {
        "cognitoConfigured": bool(COGNITO_USER_POOL_ID),
        "cognitoLoadedCount": 0,
        "cognitoErrorCode": "",
        "cognitoErrorMessage": "",
        "groupLookupErrors": 0,
        "lastGroupLookupErrorCode": "",
        "lastGroupLookupErrorMessage": "",
    }

    if not COGNITO_USER_POOL_ID:
        diagnostics["cognitoErrorCode"] = "MissingUserPoolId"
        diagnostics["cognitoErrorMessage"] = "COGNITO_USER_POOL_ID Lambda environment variable is not configured."
        return {"users": [], "diagnostics": diagnostics}

    try:
        users = []
        pagination_token = None

        while len(users) < MAX_ADMIN_ITEMS:
            params = {
                "UserPoolId": COGNITO_USER_POOL_ID,
                "Limit": min(60, MAX_ADMIN_ITEMS - len(users)),
            }

            if pagination_token:
                params["PaginationToken"] = pagination_token

            result = cognito.list_users(**params)

            for item in result.get("Users", []):
                row = cognito_user_to_row_with_diagnostics(item, diagnostics)
                users.append(row)

            pagination_token = result.get("PaginationToken")
            if not pagination_token:
                break

        diagnostics["cognitoLoadedCount"] = len(users)
        return {"users": users, "diagnostics": diagnostics}
    except ClientError as error:
        print("Could not list Cognito users:", str(error))
        error_info = error.response.get("Error", {})
        diagnostics["cognitoErrorCode"] = error_info.get("Code", "ClientError")
        diagnostics["cognitoErrorMessage"] = error_info.get("Message", str(error))
        return {"users": [], "diagnostics": diagnostics}

def list_user_groups(username, diagnostics=None):
    if not username or not COGNITO_USER_POOL_ID:
        return []

    try:
        result = cognito.admin_list_groups_for_user(
            UserPoolId=COGNITO_USER_POOL_ID,
            Username=username,
        )
        return [item.get("GroupName", "").lower() for item in result.get("Groups", []) if item.get("GroupName")]
    except ClientError as error:
        print("Could not list groups for user:", username, str(error))
        if diagnostics is not None:
            error_info = error.response.get("Error", {})
            diagnostics["groupLookupErrors"] += 1
            diagnostics["lastGroupLookupErrorCode"] = error_info.get("Code", "ClientError")
            diagnostics["lastGroupLookupErrorMessage"] = error_info.get("Message", str(error))
        return []

def find_cognito_user(username="", user_id=""):
    if not COGNITO_USER_POOL_ID:
        return None

    for candidate in [username, user_id]:
        candidate = clean_string(candidate)

        if not candidate:
            continue

        user = get_cognito_user_by_username(candidate)
        if user:
            return user

    user_id = clean_string(user_id)
    if not user_id:
        return None

    try:
        result = cognito.list_users(
            UserPoolId=COGNITO_USER_POOL_ID,
            Filter=f'sub = "{escape_cognito_filter_value(user_id)}"',
            Limit=1,
        )
    except ClientError as error:
        print("Could not find Cognito user by sub:", user_id, str(error))
        return None

    users = result.get("Users", [])
    if not users:
        return None

    return cognito_user_to_row(users[0])

def get_cognito_user_by_username(username):
    try:
        result = cognito.admin_get_user(
            UserPoolId=COGNITO_USER_POOL_ID,
            Username=username,
        )
    except ClientError:
        return None

    item = {
        "Username": result.get("Username", username),
        "Attributes": result.get("UserAttributes", []),
        "UserStatus": result.get("UserStatus", "UNKNOWN"),
        "Enabled": result.get("Enabled", False),
        "UserCreateDate": result.get("UserCreateDate"),
    }
    return cognito_user_to_row(item)

def cognito_user_to_row(item):
    attributes = {
        attr.get("Name"): attr.get("Value")
        for attr in item.get("Attributes", [])
    }
    username = item.get("Username", "")
    groups = list_user_groups(username)

    return {
        "userId": attributes.get("sub") or username,
        "username": username,
        "email": attributes.get("email", ""),
        "fullName": attributes.get("name") or attributes.get("given_name") or attributes.get("email", ""),
        "role": "admin" if "admin" in groups else "user",
        "status": item.get("UserStatus", "UNKNOWN"),
        "enabled": item.get("Enabled", False),
        "createdAt": item.get("UserCreateDate", "").isoformat() if item.get("UserCreateDate") else "",
        "groups": groups,
    }

def cognito_user_to_row_with_diagnostics(item, diagnostics):
    attributes = {
        attr.get("Name"): attr.get("Value")
        for attr in item.get("Attributes", [])
    }
    username = item.get("Username", "")
    groups = list_user_groups(username, diagnostics)

    return {
        "userId": attributes.get("sub") or username,
        "username": username,
        "email": attributes.get("email", ""),
        "fullName": attributes.get("name") or attributes.get("given_name") or attributes.get("email", ""),
        "role": "admin" if "admin" in groups else "user",
        "status": item.get("UserStatus", "UNKNOWN"),
        "enabled": item.get("Enabled", False),
        "createdAt": item.get("UserCreateDate", "").isoformat() if item.get("UserCreateDate") else "",
        "groups": groups,
    }

def delete_user_profile(user_id):
    user_id = clean_string(user_id)
    if not user_id:
        return

    try:
        dynamodb.Table(USERS_TABLE).delete_item(Key={"userId": user_id})
    except ClientError as error:
        error_info = error.response.get("Error", {})
        print("Could not delete user profile:", user_id, error_info.get("Code"), error_info.get("Message"))

def is_admin_account(user):
    groups = [str(item).lower() for item in user.get("groups", [])]
    return clean_string(user.get("role")).lower() == "admin" or "admin" in groups

def is_same_identity(identity, user):
    identity_ids = {
        clean_string(identity.get("userId")),
        clean_string(identity.get("username")),
        clean_string(identity.get("email")).lower(),
    }
    user_ids = {
        clean_string(user.get("userId")),
        clean_string(user.get("username")),
        clean_string(user.get("email")).lower(),
    }
    return bool(identity_ids.intersection({item for item in user_ids if item}))

def escape_cognito_filter_value(value):
    return clean_string(value).replace("\\", "\\\\").replace('"', '\\"')

def enrich_user_row(user, profiles_by_user_id, latest_cvs, latest_interviews):
    user_id = user.get("userId")
    profile = profiles_by_user_id.get(user_id, {})
    latest_cv = latest_cvs.get(user_id, {})
    latest_interview = latest_interviews.get(user_id, {})

    return {
        **user,
        "fullName": user.get("fullName") or profile.get("fullName") or user.get("email") or user_id,
        "email": user.get("email") or profile.get("email", ""),
        "headline": profile.get("headline", ""),
        "latestCvScore": latest_cv.get("cvScore", 0),
        "latestCvId": latest_cv.get("cvId", ""),
        "latestInterviewScore": latest_interview.get("overallScore", 0),
        "latestInterviewId": latest_interview.get("interviewId", ""),
    }

def latest_items_by_user(items):
    latest = {}

    for item in sort_items_by_date(items):
        user_id = item.get("userId")
        if user_id and user_id not in latest:
            latest[user_id] = item

    return latest

def sanitize_cv_item(item):
    allowed_keys = [
        "userId",
        "cvId",
        "fileName",
        "fileSize",
        "contentType",
        "status",
        "cvScore",
        "suggestedPosition",
        "skills",
        "createdAt",
        "updatedAt",
        "analyzedAt",
    ]
    return {key: item.get(key) for key in allowed_keys if key in item}

def sanitize_interview_item(item):
    allowed_keys = [
        "userId",
        "interviewId",
        "cvId",
        "role",
        "status",
        "overallScore",
        "answeredQuestions",
        "totalQuestions",
        "createdAt",
        "updatedAt",
        "completedAt",
        "skills",
        "projects",
    ]
    return {key: item.get(key) for key in allowed_keys if key in item}

def sort_items_by_date(items):
    return sorted(
        items,
        key=lambda item: item.get("completedAt") or item.get("analyzedAt") or item.get("updatedAt") or item.get("createdAt") or "",
        reverse=True,
    )

def average_score(items, key):
    scores = []

    for item in items:
        try:
            score = float(item.get(key, 0))
        except (TypeError, ValueError):
            score = 0

        if score > 0:
            scores.append(score)

    if not scores:
        return 0

    return round(sum(scores) / len(scores))

def get_audit_logs():
    try:
        items = scan_table(ADMIN_AUDIT_TABLE)
        return {
            "auditLogs": [sanitize_audit_item(item) for item in sort_audit_items(items)],
            "auditDiagnostics": {
                "auditTableConfigured": bool(ADMIN_AUDIT_TABLE),
                "auditErrorCode": "",
                "auditErrorMessage": "",
            },
        }
    except ClientError as error:
        error_info = error.response.get("Error", {})
        print("Could not read audit logs:", error_info.get("Code"), error_info.get("Message"))
        return {
            "auditLogs": [],
            "auditDiagnostics": {
                "auditTableConfigured": bool(ADMIN_AUDIT_TABLE),
                "auditErrorCode": error_info.get("Code", "ClientError"),
                "auditErrorMessage": error_info.get("Message", str(error)),
            },
        }

def write_audit_log(identity, action, resource_type, resource_id="", details=None):
    if not ADMIN_AUDIT_TABLE:
        return

    now = datetime.now(timezone.utc).isoformat()
    item = {
        "adminUserId": identity.get("userId") or "unknown_admin",
        "createdAt": now,
        "auditId": f"audit_{int(time.time())}_{uuid.uuid4().hex[:8]}",
        "adminEmail": identity.get("email", ""),
        "action": action,
        "resourceType": resource_type,
        "resourceId": resource_id,
        "details": details or {},
    }

    try:
        table = dynamodb.Table(ADMIN_AUDIT_TABLE)
        table.put_item(Item=to_dynamodb_value(item))
    except ClientError as error:
        error_info = error.response.get("Error", {})
        print("Could not write audit log:", error_info.get("Code"), error_info.get("Message"))

def sanitize_audit_item(item):
    allowed_keys = [
        "adminUserId",
        "createdAt",
        "auditId",
        "adminEmail",
        "action",
        "resourceType",
        "resourceId",
        "details",
    ]
    return {key: item.get(key) for key in allowed_keys if key in item}

def sort_audit_items(items):
    return sorted(items, key=lambda item: item.get("createdAt", ""), reverse=True)

def display_user_name(user, fallback=""):
    return user.get("fullName") or user.get("email") or fallback or "Unknown user"

def to_number(value):
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0

def safe_filename(value):
    value = clean_string(value) or "file"
    return re.sub(r'[^a-zA-Z0-9_.() -]', "_", value)[:140]

def sanitize_key_part(value):
    value = clean_string(value) or "item"
    return re.sub(r"[^a-zA-Z0-9_.-]", "_", value)[:120]

def sanitize_metadata_value(value):
    return re.sub(r"[^\x20-\x7E]", "_", str(value))[:256]

def is_valid_email(value):
    return bool(re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", value or ""))

def unique_items(items):
    seen = set()
    unique = []

    for item in items:
        value = clean_string(item)
        key = value.lower()

        if value and key not in seen:
            seen.add(key)
            unique.append(value)

    return unique

def to_dynamodb_value(value):
    if isinstance(value, float):
        return Decimal(str(value))

    if isinstance(value, list):
        return [to_dynamodb_value(item) for item in value]

    if isinstance(value, dict):
        return {key: to_dynamodb_value(item) for key, item in value.items()}

    return value

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

def build_auth_debug(event, identity):
    claims = get_authorizer_claims(event)
    authorizer = event.get("requestContext", {}).get("authorizer") or {}
    headers = event.get("headers") or {}
    authorization = headers.get("authorization") or headers.get("Authorization") or ""

    return {
        "identity": {
            "userIdPresent": bool(identity.get("userId")),
            "emailPresent": bool(identity.get("email")),
            "role": identity.get("role"),
            "groups": identity.get("groups"),
            "isAdmin": identity.get("isAdmin"),
        },
        "authorizerKeys": sorted(authorizer.keys()),
        "claimKeys": sorted(claims.keys()),
        "groupsRaw": claims.get("cognito:groups"),
        "customRoleRaw": claims.get("custom:role"),
        "tokenUse": claims.get("token_use"),
        "issuer": claims.get("iss"),
        "audience": claims.get("aud") or claims.get("client_id"),
        "authorizationHeaderPresent": bool(authorization),
        "authorizationHeaderStartsWithBearer": authorization.lower().startswith("bearer "),
    }
