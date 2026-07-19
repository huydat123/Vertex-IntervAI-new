import json
import os
import re
import unicodedata
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
        language = normalize_language(body.get("language") or interview.get("language"))
        evaluation = evaluate_answer(question, answer, interview, language)
        now = datetime.now(timezone.utc).isoformat()
        answer_record = {
            "questionIndex": question_index,
            "question": question,
            "answer": answer,
            "language": language,
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


def evaluate_answer(question, answer, interview, language="en"):
    local_evaluation = evaluate_answer_locally(question, answer, language)

    try:
        bedrock_evaluation = evaluate_answer_with_bedrock(question, answer, interview, language)
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


def evaluate_answer_with_bedrock(question, answer, interview, language="en"):
    prompt = build_evaluation_prompt(question, answer, interview, language)
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


def evaluate_answer_locally(question, answer, language="en"):
    is_vietnamese = normalize_language(language) == "vi"
    normalized_answer = normalize_text(answer)
    word_count = len(normalized_answer.split())

    copied_feedback = is_copied_ai_feedback(normalized_answer)
    if copied_feedback:
        return build_local_evaluation(
            28,
            "off-topic",
            False,
            "Câu trả lời giống như bạn copy feedback AI trước đó, chưa phải câu trả lời của bạn cho câu hỏi hiện tại."
            if is_vietnamese
            else "Your answer looks like copied AI feedback, not your own answer to the current interview question.",
            [],
            [
                "Hãy trả lời trực tiếp câu hỏi hiện tại, không dùng lại feedback của câu trước."
                if is_vietnamese
                else "Answer the current question directly instead of reusing feedback from the previous answer."
            ],
        )

    if says_unknown(normalized_answer):
        return build_local_evaluation(
            25,
            "weak",
            False,
            "Bạn nói rằng mình chưa biết câu trả lời." if is_vietnamese else "You said you do not know the answer.",
            [],
            [
                "Hãy giải thích phần bạn biết và liên hệ với một dự án hoặc công nghệ cụ thể."
                if is_vietnamese
                else "Try to explain what you know and connect it to one project or technology."
            ],
        )

    if word_count < 12:
        return build_local_evaluation(
            42,
            "incomplete",
            False,
            "Câu trả lời còn quá ngắn cho một buổi phỏng vấn."
            if is_vietnamese
            else "Your answer is too short for an interview response.",
            [],
            [
                "Hãy thêm một ví dụ dự án, một chi tiết kỹ thuật và một kết quả."
                if is_vietnamese
                else "Add one project example, one technical detail, and one result."
            ],
        )

    relevance_issue = evaluate_question_relevance(question, answer)
    if relevance_issue:
        return build_local_evaluation(
            relevance_issue["score"],
            "off-topic",
            False,
            relevance_issue["reason"],
            [],
            [
                "Hãy trả lời đúng trọng tâm câu hỏi, sau đó chứng minh bằng một ví dụ dự án."
                if is_vietnamese
                else "Answer the exact question, then support it with a project example."
            ],
        )

    has_example = bool(re.search(
        r"\b(project|du an|built|created|developed|implemented|used|designed|debugged|improved|connected|deployed|handled|worked on|xay|xay dung|phat trien|trien khai|su dung|thiet ke|ket noi|xu ly|lam)\b",
        normalized_answer,
    ))
    has_technical_detail = bool(re.search(
        r"\b(react|javascript|typescript|python|java|spring|html|css|api|database|sql|mysql|dynamodb|lambda|s3|aws|bedrock|frontend|backend|component|state|serverless|authentication|xac thuc|giao dien|co so du lieu|kiem thu|logging|validation)\b",
        normalized_answer,
    ))
    has_result = bool(re.search(
        r"\b(result|ket qua|improve|cai thien|reduced|faster|nhanh|user|nguoi dung|performance|hieu nang|reliable|tin cay|error|loi|bug|learned|hoc|because|vi|therefore|so that|impact|anh huong|\d+)\b",
        normalized_answer,
    ))

    score = 58
    strengths = []
    improvements = []

    if has_technical_detail:
        score += 14
        strengths.append(
            "Bạn đã nêu chi tiết kỹ thuật liên quan."
            if is_vietnamese
            else "You included relevant technical detail."
        )
    else:
        improvements.append(
            "Hãy thêm công nghệ, công cụ hoặc khái niệm cụ thể."
            if is_vietnamese
            else "Add specific technologies, tools, or concepts."
        )

    if has_example:
        score += 14
        strengths.append(
            "Bạn đã liên hệ câu trả lời với công việc hoặc dự án thực tế."
            if is_vietnamese
            else "You connected the answer to practical work."
        )
    else:
        improvements.append(
            "Hãy thêm một ví dụ dự án cụ thể."
            if is_vietnamese
            else "Add one concrete project example."
        )

    if has_result:
        score += 10
        strengths.append(
            "Bạn đã giải thích kết quả, tác động hoặc lý do."
            if is_vietnamese
            else "You explained impact, reasoning, or a result."
        )
    else:
        improvements.append(
            "Hãy nêu một kết quả, tradeoff, bug hoặc bài học rút ra."
            if is_vietnamese
            else "Mention one result, tradeoff, bug, or lesson learned."
        )

    if word_count >= 45:
        score += 6

    score = min(94, score)
    level = "strong" if score >= 80 else "needs-detail"

    return build_local_evaluation(
        score,
        level,
        score >= 60,
        f"Đã chấm câu trả lời cho câu hỏi: {question}. Điểm: {score}/100."
        if is_vietnamese
        else f"Answer reviewed for question: {question}. Score: {score}/100.",
        strengths,
        improvements or [
            "Hãy thêm một kết quả đo được để câu trả lời sắc hơn."
            if is_vietnamese
            else "Add a measurable result to make the answer sharper."
        ],
    )


def evaluate_question_relevance(question, answer):
    normalized_question = normalize_text(question)
    normalized_answer = normalize_text(answer)
    is_vietnamese_question = includes_any(normalized_question, ["du an", "ban se", "hay", "cau hoi", "phong van", "ky nang"])

    if is_project_question(normalized_question):
        project = extract_project_name(question)
        mentions_project = normalize_text(project) in normalized_answer if project else False
        has_project_context = includes_any(normalized_answer, ["project", "du an", "website", "application", "ung dung", "app", "system", "he thong", "page", "trang", "feature", "tinh nang"])
        has_responsibility = includes_any(
            normalized_answer,
            [
                "my responsibility",
                "trach nhiem",
                "vai tro",
                "i built",
                "em xay",
                "toi xay",
                "i created",
                "i developed",
                "phat trien",
                "i implemented",
                "trien khai",
                "i worked",
                "lam",
                "i designed",
                "thiet ke",
                "i used",
                "su dung",
                "i connected",
                "ket noi",
                "i tested",
                "kiem thu",
                "i improved",
                "cai thien",
                "i handled",
                "xu ly",
            ],
        )

        if not mentions_project and (not has_project_context or not has_responsibility):
            return {
                "score": 38,
                "reason": (
                    "Câu trả lời chưa tập trung vào câu hỏi về dự án. Hãy giải thích dự án, trách nhiệm của bạn, phần bạn xây dựng và kết quả."
                    if is_vietnamese_question
                    else "Your answer is not focused on the project question. Explain the project, your responsibility, what you built, and the result."
                ),
            }

    if "reliability" in normalized_question or "do tin cay" in normalized_question or "responsive" in normalized_question or "bao tri" in normalized_question:
        if not includes_any(normalized_answer, ["responsive", "reliability", "reliable", "do tin cay", "tin cay", "accessibility", "truy cap", "browser", "trinh duyet", "loading", "error", "loi", "empty", "rong", "state", "trang thai", "validation", "kiem tra", "test", "layout", "component"]):
            return {
                "score": 42,
                "reason": (
                    "Câu trả lời chưa nói đến độ tin cậy, responsive, trải nghiệm người dùng, kiểm thử hoặc xử lý lỗi."
                    if is_vietnamese_question
                    else "Your answer does not address reliability, responsiveness, user experience, testing, or error handling."
                ),
            }

    if "debug" in normalized_question or "bug" in normalized_question or "loi" in normalized_question:
        if not includes_any(normalized_answer, ["reproduce", "tai hien", "log", "console", "debug", "root cause", "nguyen nhan", "fix", "sua", "test", "verify", "xac minh", "error", "loi"]):
            return {
                "score": 42,
                "reason": (
                    "Câu trả lời chưa mô tả quy trình debug hoặc cách bạn tìm nguyên nhân và xác minh bản sửa."
                    if is_vietnamese_question
                    else "Your answer does not describe a debugging process or how you found and verified the fix."
                ),
            }

    skill = extract_skill(question)
    if skill:
        mentions_skill = normalize_text(skill) in normalized_answer
        has_work_example = includes_any(normalized_answer, ["project", "du an", "feature", "tinh nang", "built", "xay", "developed", "phat trien", "implemented", "trien khai", "used", "su dung", "designed", "thiet ke", "connected", "ket noi", "tested", "kiem thu", "improved", "cai thien"])

        if not mentions_skill and not has_work_example:
            return {
                "score": 44,
                "reason": (
                    f"Câu trả lời chưa liên hệ lại với {skill} hoặc một ví dụ dự án cụ thể."
                    if is_vietnamese_question
                    else f"Your answer does not connect back to {skill} or to a concrete project example."
                ),
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
    interview["language"] = answer_record.get("language") or interview.get("language", "en")

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


def build_evaluation_prompt(question, answer, interview, language="en"):
    role = interview.get("role", "Software Developer Intern")
    skills = ", ".join(interview.get("skills") or [])
    projects = ", ".join(interview.get("projects") or [])

    if normalize_language(language) == "vi":
        return f"""
Bạn là AI interviewer cho buổi phỏng vấn junior software developer.
Hãy chấm câu trả lời của ứng viên thật nghiêm túc.

Quy tắc:
- Chỉ chấm câu trả lời cho câu hỏi hiện tại.
- Nếu câu trả lời copy feedback AI trước đó, lạc đề, hoặc không trả lời câu hỏi, điểm phải dưới 45 và shouldAdvance phải là false.
- Nếu ứng viên nói "không biết", "không", hoặc trả lời quá ngắn, điểm phải dưới 45 và shouldAdvance phải là false.
- Feedback, strengths, improvements phải viết bằng tiếng Việt tự nhiên.
- Return ONLY valid JSON. Do not use markdown.

Return JSON with this shape:
{{
  "score": 0,
  "level": "strong",
  "shouldAdvance": true,
  "feedback": "feedback ngắn bằng tiếng Việt",
  "strengths": ["điểm mạnh 1"],
  "improvements": ["điểm cần cải thiện 1"]
}}

Role: {role}
CV skills: {skills}
CV projects: {projects}
Question: {question}
Candidate answer: {answer}
"""

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
        r"\bcau tra loi goi y\b",
        r"\bcau hoi tiep theo\b",
        r"\bcan cai thien\b",
        r"\bde manh hon\b",
        r"\bdiem\s+\d+\s+100\b",
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
            "du an",
            "giai quyet van de",
            "phan nao",
            "ban da xay",
            "kien truc",
        ]
    )


def extract_skill(question):
    searchable_question = strip_accents(question)
    patterns = [
        r"mentions\s+(.+?)\.",
        r"mentions\s+(.+?)\?",
        r"nhac den\s+(.+?)\.",
        r"nhac den\s+(.+?)\?",
        r"with\s+(.+?)\?",
        r"uses\s+(.+?)\?",
        r"built with\s+(.+?)\?",
        r"related to\s+(.+?)\?",
        r"dung\s+(.+?)\s+(responsive|de|nhu)",
        r"lien quan den\s+(.+?)\?",
    ]

    for pattern in patterns:
        match = re.search(pattern, searchable_question, re.IGNORECASE)
        if match:
            return clean_extracted_text(match.group(1))

    return ""


def extract_project_name(question):
    searchable_question = strip_accents(question)
    github_match = re.search(r"github\.com/[^/\s]+/([^.\s/?#]+)", question, re.IGNORECASE)

    if github_match:
        return format_project_name(github_match.group(1))

    about_match = re.search(r"tell me about\s+(.+?)\.", searchable_question, re.IGNORECASE)

    if about_match:
        return clean_extracted_text(about_match.group(1))

    vietnamese_match = re.search(r"du an\s+(.+?)\.", searchable_question, re.IGNORECASE)

    if vietnamese_match:
        return clean_extracted_text(vietnamese_match.group(1))

    return ""


def clean_extracted_text(value):
    return re.sub(r"[?.]+$", "", str(value)).strip()


def format_project_name(value):
    return clean_extracted_text(value).replace("-", " ").replace("_", " ").title()


def includes_any(value, terms):
    return any(term in value for term in terms)


def normalize_text(value):
    ascii_value = strip_accents(value).lower()
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9\s']", " ", ascii_value)).strip()

def strip_accents(value):
    normalized = unicodedata.normalize("NFD", str(value))
    return "".join(character for character in normalized if unicodedata.category(character) != "Mn")


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
