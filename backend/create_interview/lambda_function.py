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


def lambda_handler(event, context):
    try:
        method = get_http_method(event)

        if method == "OPTIONS":
            return response(200, {"message": "OK"})

        if method != "POST":
            return response(405, {"message": "Method not allowed"})

        body = json.loads(event.get("body") or "{}")
        user_id = safe_string(body.get("userId"), DEFAULT_USER_ID)
        cv_id = safe_string(body.get("cvId"), "cv_demo_001")
        cv_item = load_cv_item(user_id, cv_id)

        role = safe_string(
            body.get("role") or cv_item.get("suggestedPosition"),
            DEFAULT_ROLE,
        )
        skills = safe_string_list(body.get("skills") or cv_item.get("skills"), DEFAULT_SKILLS)
        projects = safe_string_list(body.get("projects") or cv_item.get("projects"), DEFAULT_PROJECTS)
        questions = create_interview_questions(role, skills, projects)

        now = datetime.now(timezone.utc).isoformat()
        interview_id = f"interview_{int(time.time())}_{uuid.uuid4().hex[:8]}"
        interview = {
            "userId": user_id,
            "interviewId": interview_id,
            "cvId": cv_id,
            "role": role,
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


def create_interview_questions(role, skills, projects):
    primary_skill = get_item(skills, 0, "Java")
    second_skill = get_item(skills, 1, "Spring Boot")
    third_skill = get_item(skills, 2, "SQL")
    project = get_item(projects, 0, "Talent Graph AI")

    groups = [
        [
            f"You are applying for {role}. Please introduce yourself and highlight your strongest technical skill.",
            f"Give me a short self-introduction for the {role} role and connect it to one project in your CV.",
            f"Why do you think you are a good fit for the {role} position based on your CV?",
        ],
        create_skill_question_group(primary_skill),
        create_skill_question_group(second_skill),
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
        create_cloud_or_database_group(third_skill),
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

    return questions[:6]


def create_skill_question_group(skill):
    category = get_skill_category(skill)

    if category == "frontend":
        return [
            f"Your CV mentions {skill}. Can you explain a page or component where you used it and what your responsibility was?",
            f"How would you make a feature built with {skill} responsive, accessible, and easy to maintain?",
            f"If a page using {skill} looks broken on mobile, how would you debug and fix it?",
        ]

    if category == "database":
        return [
            f"Your CV mentions {skill}. Can you explain a feature where you used it and what data you stored?",
            f"What would you check before deploying a feature that uses {skill}?",
            f"How would you debug a slow or incorrect query related to {skill}?",
        ]

    if category == "cloud":
        return [
            f"Your CV mentions {skill}. Can you explain how you used it in one project?",
            f"If a {skill} feature fails in production, what logs and configuration would you check first?",
            f"How would you design permissions and environment variables for a service using {skill}?",
        ]

    return [
        f"Your CV mentions {skill}. Can you explain a project where you used it and what your responsibility was?",
        f"How would you improve the reliability of an API or feature built with {skill}?",
        f"What is one technical challenge you faced when working with {skill}, and how did you solve it?",
    ]


def create_cloud_or_database_group(skill):
    category = get_skill_category(skill)

    if category == "database":
        return [
            f"What would you check before deploying a feature that uses {skill}?",
            f"How would you design a database table or query for a feature using {skill}?",
            f"How would you debug a slow or incorrect query related to {skill}?",
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
