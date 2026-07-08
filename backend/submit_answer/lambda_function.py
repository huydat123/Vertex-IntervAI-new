import json
import os
import re
from datetime import datetime, timezone
from decimal import Decimal

import boto3
from botocore.exceptions import ClientError

dynamodb = boto3.resource("dynamodb")
bedrock_runtime = boto3.client(
    "bedrock-runtime",
    region_name=os.environ.get("BEDROCK_REGION", os.environ.get("AWS_REGION", "ap-southeast-1")),
)

INTERVIEWS_TABLE = os.environ["INTERVIEWS_TABLE"]
BEDROCK_MODEL_ID = os.environ.get("BEDROCK_MODEL_ID", "apac.amazon.nova-lite-v1:0")

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
        interview_id = safe_string(body.get("interviewId"), "")
        answer = safe_string(body.get("answer"), "")

        if not interview_id:
            return response(400, {"message": "interviewId is required"})

        if not answer:
            return response(400, {"message": "answer is required"})

        table = dynamodb.Table(INTERVIEWS_TABLE)
        interview = table.get_item(
            Key={
                "userId": user_id,
                "interviewId": interview_id,
            }
        ).get("Item")

        if not interview:
            return response(404, {"message": "Interview not found"})

        questions = interview.get("questions") or []
        question_index = parse_question_index(body.get("questionIndex"), interview)

        if question_index < 0 or question_index >= len(questions):
            return response(400, {"message": "questionIndex is invalid"})

        question = safe_string(body.get("question"), questions[question_index])
        evaluation = evaluate_answer(question, answer, interview)
        now = datetime.now(timezone.utc).isoformat()
        answer_record = {
            "questionIndex": question_index,
            "question": question,
            "answer": answer,
            "score": int(evaluation["score"]),
            "level": evaluation.get("level", "needs-detail"),
            "feedback": evaluation["feedback"],
            "strengths": evaluation.get("strengths", []),
            "improvements": evaluation.get("improvements", []),
            "shouldAdvance": bool(evaluation["shouldAdvance"]),
            "aiProvider": evaluation.get("aiProvider", "Fallback evaluator"),
            "answeredAt": now,
        }

        updated_interview = update_interview(interview, answer_record, now)
        table.put_item(Item=to_dynamodb_value(updated_interview))

        return response(
            200,
            {
                "message": "Answer submitted successfully",
                "evaluation": {
                    "score": answer_record["score"],
                    "level": answer_record["level"],
                    "feedback": answer_record["feedback"],
                    "strengths": answer_record["strengths"],
                    "improvements": answer_record["improvements"],
                    "shouldAdvance": answer_record["shouldAdvance"],
                },
                "answer": answer_record,
                "interview": updated_interview,
            },
        )

    except Exception as error:
        print("Submit answer error:", str(error))
        return response(
            500,
            {
                "message": "Internal server error",
                "error": str(error),
            },
        )


def evaluate_answer(question, answer, interview):
    local_evaluation = evaluate_answer_locally(question, answer)

    try:
        bedrock_evaluation = evaluate_answer_with_bedrock(question, answer, interview)
        normalized = normalize_evaluation(bedrock_evaluation)
    except Exception as error:
        print("Bedrock interview evaluation unavailable, using fallback:", str(error))
        return local_evaluation

    if local_evaluation["score"] < 60 and normalized["score"] > local_evaluation["score"]:
        return local_evaluation

    if normalized["score"] < 60:
        normalized["shouldAdvance"] = False

    normalized["aiProvider"] = "Amazon Bedrock"
    return normalized


def evaluate_answer_with_bedrock(question, answer, interview):
    prompt = build_evaluation_prompt(question, answer, interview)
    model_ids = unique_model_ids([BEDROCK_MODEL_ID, "apac.amazon.nova-lite-v1:0"])
    last_error = None

    for model_id in model_ids:
        try:
            result = bedrock_runtime.invoke_model(
                modelId=model_id,
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
                            "maxTokens": 1200,
                            "temperature": 0.15,
                            "topP": 0.9,
                        },
                    }
                ),
            )

            payload = json.loads(result["body"].read())
            text = "".join(
                part.get("text", "")
                for part in payload.get("output", {}).get("message", {}).get("content", [])
            )
            return parse_json_from_text(text)
        except ClientError as error:
            last_error = error
            error_code = error.response.get("Error", {}).get("Code", "")
            error_message = error.response.get("Error", {}).get("Message", "")
            can_try_next_model = error_code == "ValidationException" and (
                "Operation not allowed" in error_message
                or "model identifier is invalid" in error_message
            )

            if can_try_next_model:
                print(f"Model {model_id} failed: {error_message}. Trying next model ID.")
                continue

            raise

    raise last_error


def evaluate_answer_locally(question, answer):
    normalized_answer = normalize_text(answer)
    word_count = len(normalized_answer.split())

    copied_feedback = is_copied_ai_feedback(normalized_answer)
    if copied_feedback:
        return build_local_evaluation(
            28,
            "off-topic",
            False,
            "Your answer looks like copied AI feedback, not your own answer to the current interview question.",
            [],
            ["Answer the current question directly instead of reusing feedback from the previous answer."],
        )

    if says_unknown(normalized_answer):
        return build_local_evaluation(
            25,
            "weak",
            False,
            "You said you do not know the answer.",
            [],
            ["Try to explain what you know and connect it to one project or technology."],
        )

    if word_count < 12:
        return build_local_evaluation(
            42,
            "incomplete",
            False,
            "Your answer is too short for an interview response.",
            [],
            ["Add one project example, one technical detail, and one result."],
        )

    relevance_issue = evaluate_question_relevance(question, answer)
    if relevance_issue:
        return build_local_evaluation(
            relevance_issue["score"],
            "off-topic",
            False,
            relevance_issue["reason"],
            [],
            ["Answer the exact question, then support it with a project example."],
        )

    has_example = bool(re.search(r"\b(project|built|created|developed|implemented|used|designed|debugged|improved|connected|deployed|handled|worked on)\b", normalized_answer))
    has_technical_detail = bool(re.search(r"\b(react|javascript|typescript|python|java|spring|html|css|api|database|sql|mysql|dynamodb|lambda|s3|aws|bedrock|frontend|backend|component|state|serverless|authentication)\b", normalized_answer))
    has_result = bool(re.search(r"\b(result|improve|reduced|faster|user|performance|reliable|error|bug|learned|because|therefore|so that|impact|\d+)\b", normalized_answer))

    score = 58
    strengths = []
    improvements = []

    if has_technical_detail:
        score += 14
        strengths.append("You included relevant technical detail.")
    else:
        improvements.append("Add specific technologies, tools, or concepts.")

    if has_example:
        score += 14
        strengths.append("You connected the answer to practical work.")
    else:
        improvements.append("Add one concrete project example.")

    if has_result:
        score += 10
        strengths.append("You explained impact, reasoning, or a result.")
    else:
        improvements.append("Mention one result, tradeoff, bug, or lesson learned.")

    if word_count >= 45:
        score += 6

    score = min(94, score)
    level = "strong" if score >= 80 else "needs-detail"

    return build_local_evaluation(
        score,
        level,
        score >= 60,
        f"Answer reviewed for question: {question}. Score: {score}/100.",
        strengths,
        improvements or ["Add a measurable result to make the answer sharper."],
    )


def evaluate_question_relevance(question, answer):
    normalized_question = normalize_text(question)
    normalized_answer = normalize_text(answer)

    if is_project_question(normalized_question):
        project = extract_project_name(question)
        mentions_project = normalize_text(project) in normalized_answer if project else False
        has_project_context = includes_any(normalized_answer, ["project", "website", "application", "app", "system", "page", "feature"])
        has_responsibility = includes_any(
            normalized_answer,
            [
                "my responsibility",
                "i built",
                "i created",
                "i developed",
                "i implemented",
                "i worked",
                "i designed",
                "i used",
                "i connected",
                "i tested",
                "i improved",
                "i handled",
            ],
        )

        if not mentions_project and (not has_project_context or not has_responsibility):
            return {
                "score": 38,
                "reason": "Your answer is not focused on the project question. Explain the project, your responsibility, what you built, and the result.",
            }

    if "reliability" in normalized_question or "responsive" in normalized_question:
        if not includes_any(normalized_answer, ["responsive", "reliability", "reliable", "accessibility", "browser", "loading", "error", "empty", "state", "validation", "test", "layout", "component"]):
            return {
                "score": 42,
                "reason": "Your answer does not address reliability, responsiveness, user experience, testing, or error handling.",
            }

    if "debug" in normalized_question or "bug" in normalized_question:
        if not includes_any(normalized_answer, ["reproduce", "log", "console", "debug", "root cause", "fix", "test", "verify", "error"]):
            return {
                "score": 42,
                "reason": "Your answer does not describe a debugging process or how you found and verified the fix.",
            }

    skill = extract_skill(question)
    if skill:
        mentions_skill = normalize_text(skill) in normalized_answer
        has_work_example = includes_any(normalized_answer, ["project", "feature", "built", "developed", "implemented", "used", "designed", "connected", "tested", "improved"])

        if not mentions_skill and not has_work_example:
            return {
                "score": 44,
                "reason": f"Your answer does not connect back to {skill} or to a concrete project example.",
            }

    return None


def build_local_evaluation(score, level, should_advance, feedback, strengths, improvements):
    return {
        "score": int(max(0, min(100, score))),
        "level": level,
        "shouldAdvance": bool(should_advance),
        "feedback": feedback,
        "strengths": strengths,
        "improvements": improvements,
        "aiProvider": "Fallback evaluator",
    }


def update_interview(interview, answer_record, now):
    attempts = list(interview.get("answerAttempts") or [])
    attempts.append(answer_record)
    interview["answerAttempts"] = attempts

    answers = list(interview.get("answers") or [])

    if answer_record["shouldAdvance"]:
        answers = upsert_answer(answers, answer_record)

    interview["answers"] = answers
    interview["answeredQuestions"] = len({int(answer.get("questionIndex", -1)) for answer in answers})
    interview["overallScore"] = calculate_overall_score(answers)
    interview["updatedAt"] = now

    total_questions = len(interview.get("questions") or [])
    completed = total_questions > 0 and interview["answeredQuestions"] >= total_questions
    interview["status"] = "COMPLETED" if completed else "IN_PROGRESS"

    if completed:
        interview["completedAt"] = now

    return interview


def upsert_answer(answers, answer_record):
    next_answers = []
    replaced = False

    for existing in answers:
        if int(existing.get("questionIndex", -1)) == int(answer_record["questionIndex"]):
            next_answers.append(answer_record)
            replaced = True
        else:
            next_answers.append(existing)

    if not replaced:
        next_answers.append(answer_record)

    return sorted(next_answers, key=lambda item: int(item.get("questionIndex", 0)))


def calculate_overall_score(answers):
    scores = [int(answer.get("score", 0)) for answer in answers if answer.get("shouldAdvance")]

    if not scores:
        return 0

    return round(sum(scores) / len(scores))


def parse_question_index(value, interview):
    if value is not None:
        return int(value)

    return len(interview.get("answers") or [])


def normalize_evaluation(raw):
    score = clamp_score(raw.get("score"), 0)
    level = safe_string(raw.get("level"), level_from_score(score))
    strengths = safe_string_list(raw.get("strengths"), [])
    improvements = safe_string_list(raw.get("improvements"), [])
    feedback = safe_string(raw.get("feedback"), f"Answer reviewed. Score: {score}/100.")
    should_advance = bool(raw.get("shouldAdvance", score >= 60))

    return {
        "score": score,
        "level": level,
        "shouldAdvance": should_advance and score >= 60,
        "feedback": feedback,
        "strengths": strengths,
        "improvements": improvements,
        "aiProvider": "Amazon Bedrock",
    }


def build_evaluation_prompt(question, answer, interview):
    role = interview.get("role", "Software Developer Intern")
    skills = ", ".join(interview.get("skills") or [])
    projects = ", ".join(interview.get("projects") or [])

    return f"""
You are an AI interviewer for a junior software developer interview.
Evaluate the candidate answer strictly.

Rules:
- Score only the answer to the current question.
- If the answer copies previous AI feedback, is off-topic, or does not answer the question, score below 45 and shouldAdvance must be false.
- If the answer says "I don't know", "no", or is too short, score below 45 and shouldAdvance must be false.
- Give practical feedback and a concrete improvement.
- Return ONLY valid JSON. Do not use markdown.

Return JSON with this shape:
{{
  "score": 0,
  "level": "strong",
  "shouldAdvance": true,
  "feedback": "short feedback",
  "strengths": ["strength 1"],
  "improvements": ["improvement 1"]
}}

Role: {role}
CV skills: {skills}
CV projects: {projects}
Question: {question}
Candidate answer: {answer}
"""


def parse_json_from_text(text):
    match = re.search(r"\{.*\}", text, re.DOTALL)

    if not match:
        raise ValueError("Bedrock did not return JSON")

    return json.loads(match.group(0))


def unique_model_ids(model_ids):
    seen = set()
    unique_ids = []

    for model_id in model_ids:
        if model_id and model_id not in seen:
            seen.add(model_id)
            unique_ids.append(model_id)

    return unique_ids


def says_unknown(value):
    patterns = [
        r"\bi\s*(do not|dont|don't)\s*(know|no)\b",
        r"\bidk\b",
        r"\bno idea\b",
        r"\bnot sure\b",
        r"\bkhong biet\b",
        r"\bko biet\b",
        r"\bkhong ro\b",
    ]
    return any(re.search(pattern, value) for pattern in patterns)


def is_copied_ai_feedback(value):
    patterns = [
        r"\bto make it even stronger\b",
        r"\bwhat to improve\b",
        r"\bbetter structure\b",
        r"\bsuggested answer\b",
        r"\bnext question\b",
        r"\banswer reviewed for question\b",
        r"\bmention one hard part\b",
        r"\bscore\s+\d+\s+100\b",
    ]
    return any(re.search(pattern, value) for pattern in patterns)


def is_project_question(question):
    return any(
        phrase in question
        for phrase in [
            "tell me about",
            "project where you used",
            "one project",
            "what problem did it solve",
            "what part did you build",
        ]
    )


def extract_skill(question):
    patterns = [
        r"mentions\s+(.+?)\.",
        r"mentions\s+(.+?)\?",
        r"with\s+(.+?)\?",
        r"uses\s+(.+?)\?",
        r"built with\s+(.+?)\?",
        r"related to\s+(.+?)\?",
    ]

    for pattern in patterns:
        match = re.search(pattern, question, re.IGNORECASE)
        if match:
            return clean_extracted_text(match.group(1))

    return ""


def extract_project_name(question):
    github_match = re.search(r"github\.com/[^/\s]+/([^.\s/?#]+)", question, re.IGNORECASE)

    if github_match:
        return format_project_name(github_match.group(1))

    about_match = re.search(r"tell me about\s+(.+?)\.", question, re.IGNORECASE)

    if about_match:
        return clean_extracted_text(about_match.group(1))

    return ""


def clean_extracted_text(value):
    return re.sub(r"[?.]+$", "", str(value)).strip()


def format_project_name(value):
    return clean_extracted_text(value).replace("-", " ").replace("_", " ").title()


def includes_any(value, terms):
    return any(term in value for term in terms)


def normalize_text(value):
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9\s']", " ", str(value).lower())).strip()


def level_from_score(score):
    if score >= 80:
        return "strong"
    if score >= 60:
        return "needs-detail"
    if score >= 40:
        return "incomplete"
    return "weak"


def clamp_score(value, fallback):
    try:
        score = int(round(float(value)))
    except (TypeError, ValueError):
        score = fallback

    return max(0, min(100, score))


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
