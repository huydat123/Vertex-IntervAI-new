import json
import os
import random
import time
import uuid
from datetime import datetime, timezone
from decimal import Decimal

import boto3

dynamodb = boto3.resource("dynamodb")

INTERVIEWS_TABLE = os.environ["INTERVIEWS_TABLE"]
CVS_TABLE = os.environ.get("CVS_TABLE")

DEFAULT_USER_ID = "user_demo_001"
DEFAULT_ROLE = "Software Developer Intern"
DEFAULT_SKILLS = ["Java", "Spring Boot", "SQL"]
DEFAULT_PROJECTS = ["Talent Graph AI"]
DEFAULT_QUESTION_COUNT = 5
MIN_QUESTION_COUNT = 2
MAX_QUESTION_COUNT = 8


def response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
            "Access-Control-Allow-Methods": "OPTIONS,POST",
        },
        "body": json.dumps(from_dynamodb_value(body), ensure_ascii=False),
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

def normalize_language(value):
    normalized = str(value or "").strip().lower()
    return "vi" if normalized in {"vi", "vi-vn", "vietnamese", "tieng viet", "tiếng việt"} else "en"

def lambda_handler(event, context):
    try:
        method = get_http_method(event)

        if method == "OPTIONS":
            return response(200, {"message": "OK"})

        if method != "POST":
            return response(405, {"message": "Method not allowed"})

        body = json.loads(event.get("body") or "{}")
        user_id = safe_string(resolve_user_id(event, body.get("userId")), DEFAULT_USER_ID)
        cv_id = safe_string(body.get("cvId"), "cv_demo_001")
        cv_item = load_cv_item(user_id, cv_id)

        role = safe_string(
            body.get("role") or cv_item.get("suggestedPosition"),
            DEFAULT_ROLE,
        )
        role_category = safe_string(body.get("roleCategory"), "cv")
        role_focus = safe_string(body.get("roleFocus"), "")
        language = normalize_language(body.get("language") or body.get("interviewLanguage"))
        question_count = safe_int(body.get("questionCount"), DEFAULT_QUESTION_COUNT, MIN_QUESTION_COUNT, MAX_QUESTION_COUNT)
        skills = safe_string_list(body.get("skills") or cv_item.get("skills"), DEFAULT_SKILLS)
        projects = safe_string_list(body.get("projects") or cv_item.get("projects"), DEFAULT_PROJECTS)
        questions = create_interview_questions(role, skills, projects, role_category, role_focus, question_count, language)

        now = datetime.now(timezone.utc).isoformat()
        interview_id = f"interview_{int(time.time())}_{uuid.uuid4().hex[:8]}"
        interview = {
            "userId": user_id,
            "interviewId": interview_id,
            "cvId": cv_id,
            "role": role,
            "roleCategory": role_category,
            "roleFocus": role_focus,
            "language": language,
            "questionCount": question_count,
            "skills": skills,
            "projects": projects,
            "questions": questions,
            "answers": [],
            "answerAttempts": [],
            "status": "IN_PROGRESS",
            "overallScore": 0,
            "answeredQuestions": 0,
            "totalQuestions": len(questions),
            "createdAt": now,
            "updatedAt": now,
        }

        table = dynamodb.Table(INTERVIEWS_TABLE)
        table.put_item(Item=interview)

        return response(
            200,
            {
                "message": "Interview created successfully",
                "interview": interview,
            },
        )

    except Exception as error:
        print("Create interview error:", str(error))
        return response(
            500,
            {
                "message": "Internal server error",
                "error": str(error),
            },
        )


def load_cv_item(user_id, cv_id):
    if not CVS_TABLE or not cv_id or cv_id == "cv_demo_001":
        return {}

    try:
        table = dynamodb.Table(CVS_TABLE)
        result = table.get_item(Key={"userId": user_id, "cvId": cv_id})
        return result.get("Item") or {}
    except Exception as error:
        print("Could not load CV item for interview:", str(error))
        return {}


def create_interview_questions(role, skills, projects, role_category="cv", role_focus="", question_count=DEFAULT_QUESTION_COUNT, language="en"):
    primary_skill = get_item(skills, 0, "Java")
    second_skill = get_item(skills, 1, "Spring Boot")
    third_skill = get_item(skills, 2, "SQL")
    project = get_item(projects, 0, "Talent Graph AI")

    if language == "vi":
        groups = [
            *create_role_question_groups(role, skills, role_category, role_focus, language),
            [
                f"Bạn đang ứng tuyển vị trí {role}. Hãy giới thiệu bản thân và nêu kỹ năng kỹ thuật mạnh nhất trong CV.",
                f"Hãy giới thiệu ngắn gọn cho vị trí {role} và liên hệ với một dự án trong CV của bạn.",
                f"Dựa trên CV, vì sao bạn phù hợp với vị trí {role}?",
            ],
            create_skill_question_group(primary_skill, language),
            create_skill_question_group(second_skill, language),
            [
                f"Hãy nói về dự án {project}. Dự án giải quyết vấn đề gì và bạn đã xây phần nào?",
                "Chọn một dự án trong CV. Kiến trúc của dự án là gì và vì sao bạn chọn cách đó?",
                "Nếu có thêm thời gian, bạn muốn cải thiện tính năng nào trong dự án CV của mình?",
            ],
            [
                "Bạn sẽ thiết kế dashboard lấy dữ liệu từ nhiều API nhưng vẫn dễ bảo trì như thế nào?",
                "Bạn sẽ xử lý trạng thái loading, lỗi API và dữ liệu rỗng trong dashboard cho người dùng như thế nào?",
                "Bạn sẽ tổ chức component React cho dashboard có upload, profile và interview pages như thế nào?",
            ],
            create_cloud_or_database_group(third_skill, language),
            [
                "Hãy kể về một bug khó bạn từng xử lý và cách bạn debug.",
                "Hãy mô tả một lần bạn học nhanh công nghệ mới và áp dụng vào dự án.",
                "Hãy kể về một lần bạn nhận feedback về code. Sau đó bạn đã thay đổi gì?",
            ],
        ]
    else:
        groups = [
            *create_role_question_groups(role, skills, role_category, role_focus, language),
            [
                f"You are applying for {role}. Please introduce yourself and highlight your strongest technical skill.",
                f"Give me a short self-introduction for the {role} role and connect it to one project in your CV.",
                f"Why do you think you are a good fit for the {role} position based on your CV?",
            ],
            create_skill_question_group(primary_skill, language),
            create_skill_question_group(second_skill, language),
            [
                f"Tell me about {project}. What problem did it solve and what part did you build?",
                "Pick one project from your CV. What was the architecture, and why did you choose that approach?",
                "Describe one feature in your CV project that you would improve if you had more time.",
            ],
            [
                "How would you design a dashboard that consumes data from multiple APIs and remains easy to maintain?",
                "How would you handle loading states, API errors, and empty data in a user-facing dashboard?",
                "How would you organize React components for a dashboard with upload, profile, and interview pages?",
            ],
            create_cloud_or_database_group(third_skill, language),
            [
                "Tell me about a difficult bug you solved and how you approached debugging it.",
                "Describe a time you learned a new technology quickly and applied it in a project.",
                "Tell me about a time you received feedback on your code. What did you change after that?",
            ],
        ]

    random.shuffle(groups)
    questions = []

    for group in groups:
        questions.append(random.choice(group))

    if len(questions) < question_count:
        remaining_questions = [
            question
            for group in groups
            for question in group
            if question not in questions
        ]
        random.shuffle(remaining_questions)
        questions.extend(remaining_questions)

    return questions[:question_count]

def create_role_question_groups(role, skills, role_category, role_focus, language="en"):
    normalized_role = role.lower()
    normalized_category = role_category.lower()
    primary_skill = get_item(skills, 0, "Python")
    second_skill = get_item(skills, 1, "Machine Learning")
    focus_text = role_focus or ", ".join(skills[:3])

    if normalized_category == "cv":
        return []

    if language == "vi":
        return [
            [
                f"Với vai trò {role}, bạn sẽ thiết kế một tính năng AI từ lúc xác định vấn đề đến khi release production như thế nào?",
                f"Bạn sẽ xây hệ thống AI nào với trọng tâm {focus_text}? Hãy giải thích model, API và luồng dữ liệu.",
            ],
            [
                f"Bạn sẽ đánh giá chất lượng và độ tin cậy của giải pháp dùng {primary_skill} như thế nào?",
                "Nếu câu trả lời AI không ổn định, bạn sẽ debug prompt, dữ liệu, model setting và log như thế nào?",
            ],
            [
                f"Hãy thiết kế workflow production nhỏ dùng {primary_skill}, {second_skill} và một API. Bạn sẽ monitor những gì?",
                "Bạn sẽ theo dõi chất lượng, độ trễ và chi phí của một tính năng AI trong production như thế nào?",
            ],
        ]

    if normalized_category == "ai" or any(word in normalized_role for word in ["ai", "machine learning", "ml", "genai", "nlp", "vision"]):
        return [
            [
                f"For a {role} role, how would you design an AI feature from problem definition to production release?",
                f"Describe an AI system you would build using {focus_text}. What are the model, API, and data flow?",
            ],
            [
                f"How would you evaluate the quality and reliability of an AI solution built with {primary_skill}?",
                "If an AI answer is inconsistent, how would you debug prompts, data, model settings, and logs?",
            ],
            [
                f"Design a small production workflow using {primary_skill}, {second_skill}, and an API. What would you monitor?",
                "How would you monitor quality, latency, cost, and safety for an AI feature in production?",
            ],
        ]

    if normalized_category == "data":
        return [
            [
                f"For a {role} role, how would you turn raw product data into reliable analytics or model features?",
                "How would you explore a new dataset before building a model, report, or dashboard?",
            ],
            [
                "What data quality checks would you add before AI evaluation uses candidate data?",
                "How would you debug missing, duplicated, or delayed records in an interview history pipeline?",
            ],
        ]

    if normalized_category == "cloud":
        return [
            [
                f"For a {role} role, how would you design a reliable deployment pipeline for an AI service?",
                "What checks should happen before promoting a model, prompt, or Lambda change to production?",
            ],
            [
                "How would you monitor API failures, model latency, and cost using CloudWatch logs?",
                "How would you manage environment variables, IAM permissions, and rollback for an AI backend?",
            ],
        ]

    if normalized_category == "frontend":
        return [
            [
                "How would you design a React interface for an AI interview chat with loading, retry, and error states?",
                "How would you make an AI feature feel trustworthy and easy to understand in the UI?",
            ],
            [
                "How would you handle streaming AI responses, partial results, and cancellation in React?",
                "How would you design accessible camera, voice, and chat controls for an interview page?",
            ],
        ]

    if normalized_category == "backend":
        return [
            [
                "How would you design a backend API that creates AI interview questions from a CV?",
                "How would you structure Lambda functions for upload, analysis, interview, scoring, and history?",
            ],
            [
                "How would you handle retries, timeouts, and fallback behavior when an AI provider fails?",
                "How would you store answers, attempts, scores, and audit logs in DynamoDB?",
            ],
        ]

    return []


def create_skill_question_group(skill, language="en"):
    category = get_skill_category(skill)

    if category == "frontend":
        if language == "vi":
            return [
                f"CV của bạn có nhắc đến {skill}. Hãy giải thích một page hoặc component bạn đã dùng nó và trách nhiệm của bạn là gì?",
                f"Bạn sẽ làm một tính năng dùng {skill} responsive, accessible và dễ bảo trì như thế nào?",
                f"Nếu một page dùng {skill} bị lỗi trên mobile, bạn sẽ debug và sửa như thế nào?",
            ]

        return [
            f"Your CV mentions {skill}. Can you explain a page or component where you used it and what your responsibility was?",
            f"How would you make a feature built with {skill} responsive, accessible, and easy to maintain?",
            f"If a page using {skill} looks broken on mobile, how would you debug and fix it?",
        ]

    if category == "database":
        if language == "vi":
            return [
                f"CV của bạn có nhắc đến {skill}. Hãy giải thích một tính năng bạn đã dùng nó và dữ liệu bạn lưu là gì?",
                f"Trước khi deploy một tính năng dùng {skill}, bạn sẽ kiểm tra những gì?",
                f"Bạn sẽ debug một query chậm hoặc sai liên quan đến {skill} như thế nào?",
            ]

        return [
            f"Your CV mentions {skill}. Can you explain a feature where you used it and what data you stored?",
            f"What would you check before deploying a feature that uses {skill}?",
            f"How would you debug a slow or incorrect query related to {skill}?",
        ]

    if category == "cloud":
        if language == "vi":
            return [
                f"CV của bạn có nhắc đến {skill}. Hãy giải thích bạn đã dùng nó trong một dự án như thế nào?",
                f"Nếu một tính năng dùng {skill} lỗi trên production, bạn sẽ kiểm tra log và cấu hình nào trước?",
                f"Bạn sẽ thiết kế permission và environment variables cho service dùng {skill} như thế nào?",
            ]

        return [
            f"Your CV mentions {skill}. Can you explain how you used it in one project?",
            f"If a {skill} feature fails in production, what logs and configuration would you check first?",
            f"How would you design permissions and environment variables for a service using {skill}?",
        ]

    if language == "vi":
        return [
            f"CV của bạn có nhắc đến {skill}. Hãy giải thích một dự án bạn đã dùng nó và trách nhiệm của bạn là gì?",
            f"Bạn sẽ cải thiện độ tin cậy của một API hoặc tính năng xây bằng {skill} như thế nào?",
            f"Một thử thách kỹ thuật khi làm với {skill} là gì và bạn đã giải quyết như thế nào?",
        ]

    return [
        f"Your CV mentions {skill}. Can you explain a project where you used it and what your responsibility was?",
        f"How would you improve the reliability of an API or feature built with {skill}?",
        f"What is one technical challenge you faced when working with {skill}, and how did you solve it?",
    ]


def create_cloud_or_database_group(skill, language="en"):
    category = get_skill_category(skill)

    if category == "database":
        if language == "vi":
            return [
                f"Trước khi deploy một tính năng dùng {skill}, bạn sẽ kiểm tra những gì?",
                f"Bạn sẽ thiết kế database table hoặc query cho một tính năng dùng {skill} như thế nào?",
                f"Bạn sẽ debug query chậm hoặc sai liên quan đến {skill} như thế nào?",
            ]

        return [
            f"What would you check before deploying a feature that uses {skill}?",
            f"How would you design a database table or query for a feature using {skill}?",
            f"How would you debug a slow or incorrect query related to {skill}?",
        ]

    if language == "vi":
        return [
            f"Hãy giải thích cách {skill}, API Gateway và database phối hợp trong ứng dụng serverless.",
            "Nếu Lambda API trả về Internal Server Error, bạn sẽ kiểm tra log và cấu hình nào trước?",
            "Bạn sẽ thiết kế permission thế nào để backend đọc dữ liệu CV an toàn?",
        ]

    return [
        f"Explain how {skill}, API Gateway, and a database can work together in a serverless application.",
        "If a Lambda API returns Internal Server Error, what logs and configuration would you check first?",
        "How would you design permissions so a backend service can read CV data securely?",
    ]


def get_skill_category(skill):
    normalized = skill.lower()

    if any(word in normalized for word in ["html", "css", "bootstrap", "tailwind", "react", "vue", "angular", "javascript", "typescript", "frontend"]):
        return "frontend"

    if any(word in normalized for word in ["sql", "mysql", "postgres", "database", "dynamodb", "mongodb", "redis"]):
        return "database"

    if any(word in normalized for word in ["aws", "s3", "lambda", "api gateway", "bedrock", "cloud", "serverless", "iam"]):
        return "cloud"

    return "backend"


def get_item(items, index, fallback):
    if isinstance(items, list) and len(items) > index and isinstance(items[index], str) and items[index].strip():
        return items[index].strip()

    return fallback


def safe_string(value, fallback):
    if isinstance(value, str) and value.strip():
        return value.strip()

    return fallback


def safe_string_list(value, fallback):
    if not isinstance(value, list):
        return fallback

    cleaned = []

    for item in value[:8]:
        if isinstance(item, str) and item.strip():
            cleaned.append(item.strip())

    return cleaned or fallback


def safe_int(value, fallback, minimum, maximum):
    try:
        number = int(value)
    except (TypeError, ValueError):
        number = fallback

    return max(minimum, min(maximum, number))


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
