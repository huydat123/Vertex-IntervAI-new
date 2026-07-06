import json
import os
import re
import zipfile
import zlib
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from decimal import Decimal
from io import BytesIO

import boto3
from botocore.exceptions import ClientError


dynamodb = boto3.resource("dynamodb")
s3 = boto3.client("s3")
bedrock_runtime = boto3.client(
    "bedrock-runtime",
    region_name=os.environ.get("BEDROCK_REGION", "ap-southeast-2"),
)

CVS_TABLE = os.environ["CVS_TABLE"]
BEDROCK_MODEL_ID = os.environ.get("BEDROCK_MODEL_ID", "apac.amazon.nova-lite-v1:0")

MAX_CV_TEXT_CHARS = 12000
SUPPORTED_TEXT_FORMATS = {"pdf", "docx", "txt"}


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

        body = json.loads(event.get("body") or "{}")
        user_id = body.get("userId", "user_demo_001")
        cv_id = body.get("cvId")

        if not cv_id:
            return response(400, {"message": "cvId is required"})

        table = dynamodb.Table(CVS_TABLE)
        cv_item = get_cv_item(table, user_id, cv_id)

        if not cv_item:
            return response(404, {"message": "CV not found"})

        bucket = cv_item.get("s3Bucket")
        key = cv_item.get("s3Key")

        if not bucket or not key:
            return response(400, {"message": "CV item does not contain S3 location"})

        cv_text = get_cv_text(bucket, key)

        if len(cv_text.strip()) < 30:
            return response(
                400,
                {
                    "message": "Cannot read enough text from this CV. Please upload a text-based PDF or DOCX file."
                },
            )

        ai_result = analyze_with_bedrock(cv_text)
        analysis = normalize_analysis(ai_result)

        now = datetime.now(timezone.utc).isoformat()
        update_data = {
            **analysis,
            "status": "ANALYZED",
            "cvText": cv_text[:MAX_CV_TEXT_CHARS],
            "analyzedAt": now,
            "updatedAt": now,
        }

        updated_cv = update_cv_item(table, user_id, cv_id, update_data)

        return response(
            200,
            {
                "message": "CV analyzed successfully",
                "cv": updated_cv,
            },
        )

    except Exception as error:
        print("Analyze CV error:", str(error))
        return response(
            500,
            {
                "message": "Internal server error",
                "error": str(error),
            },
        )


def get_cv_item(table, user_id, cv_id):
    result = table.get_item(Key={"userId": user_id, "cvId": cv_id})
    return result.get("Item")


def get_cv_text(bucket, key):
    extension = key.rsplit(".", 1)[-1].lower()

    if extension not in SUPPORTED_TEXT_FORMATS:
        raise ValueError("AI analysis supports PDF, DOCX, and TXT files. Please convert DOC files to DOCX or PDF.")

    result = s3.get_object(Bucket=bucket, Key=key)
    file_bytes = result["Body"].read()

    if extension == "docx":
        return extract_docx_text(file_bytes)

    if extension == "pdf":
        return extract_pdf_text(file_bytes)

    return file_bytes.decode("utf-8", errors="ignore")


def extract_docx_text(file_bytes):
    text_parts = []

    with zipfile.ZipFile(BytesIO(file_bytes)) as docx:
        xml_files = [
            name
            for name in docx.namelist()
            if name.startswith("word/")
            and name.endswith(".xml")
            and (
                name.endswith("document.xml")
                or "header" in name
                or "footer" in name
                or name.endswith("footnotes.xml")
                or name.endswith("endnotes.xml")
            )
        ]

        for xml_file in xml_files:
            root = ET.fromstring(docx.read(xml_file))
            for node in root.iter("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t"):
                if node.text:
                    text_parts.append(node.text)

    return clean_text("\n".join(text_parts))


def extract_pdf_text(file_bytes):
    text_parts = []

    for stream in iter_pdf_streams(file_bytes):
        text_parts.extend(extract_pdf_strings(stream))

    if not text_parts:
        text_parts.extend(extract_pdf_strings(file_bytes))

    return clean_text("\n".join(text_parts))


def iter_pdf_streams(file_bytes):
    for match in re.finditer(rb"stream\r?\n(.*?)\r?\nendstream", file_bytes, re.DOTALL):
        stream = match.group(1).strip(b"\r\n")
        dictionary_area = file_bytes[max(0, match.start() - 500):match.start()]

        if b"/FlateDecode" in dictionary_area:
            try:
                yield zlib.decompress(stream)
            except zlib.error:
                continue
        else:
            yield stream


def extract_pdf_strings(data):
    strings = []

    for token in re.findall(rb"\((?:\\.|[^\\)])*\)", data):
        value = decode_pdf_literal(token[1:-1])
        if is_useful_pdf_text(value):
            strings.append(value)

    for token in re.findall(rb"<([0-9A-Fa-f\s]{4,})>", data):
        value = decode_pdf_hex(token)
        if is_useful_pdf_text(value):
            strings.append(value)

    return strings


def decode_pdf_literal(value):
    value = re.sub(rb"\\([nrtbf()\\])", replace_pdf_escape, value)
    value = re.sub(rb"\\([0-7]{1,3})", lambda match: bytes([int(match.group(1), 8)]), value)
    return decode_text_bytes(value)


def replace_pdf_escape(match):
    replacements = {
        b"n": b"\n",
        b"r": b"\r",
        b"t": b"\t",
        b"b": b"\b",
        b"f": b"\f",
        b"(": b"(",
        b")": b")",
        b"\\": b"\\",
    }
    return replacements.get(match.group(1), match.group(1))


def decode_pdf_hex(value):
    cleaned = re.sub(rb"\s+", b"", value)

    if len(cleaned) % 2 == 1:
        cleaned += b"0"

    try:
        return decode_text_bytes(bytes.fromhex(cleaned.decode("ascii")))
    except ValueError:
        return ""


def decode_text_bytes(value):
    if value.startswith(b"\xfe\xff"):
        return value[2:].decode("utf-16-be", errors="ignore")

    if value.startswith(b"\xff\xfe"):
        return value[2:].decode("utf-16-le", errors="ignore")

    if value.count(b"\x00") > max(1, len(value) // 4):
        return value.decode("utf-16-be", errors="ignore")

    return value.decode("latin-1", errors="ignore")


def is_useful_pdf_text(value):
    value = value.strip()

    if len(value) < 2:
        return False

    readable_chars = sum(1 for char in value if char.isalnum() or char.isspace() or char in ".,:;-/@()[]+#")
    return readable_chars / max(1, len(value)) > 0.6


def clean_text(value):
    lines = [re.sub(r"\s+", " ", line).strip() for line in value.splitlines()]
    return "\n".join(line for line in lines if line)


def analyze_with_bedrock(cv_text):
    cv_text = cv_text[:MAX_CV_TEXT_CHARS]

    try:
        result = call_nova_invoke_model(cv_text)
    except ClientError as error:
        error_code = error.response.get("Error", {}).get("Code", "")
        error_message = error.response.get("Error", {}).get("Message", "")
        print(f"Bedrock unavailable, using fallback CV analysis. {error_code}: {error_message}")
        return create_fallback_analysis(cv_text)

    text = "".join(
        part.get("text", "")
        for part in result.get("output", {}).get("message", {}).get("content", [])
    )

    try:
        return parse_json_from_text(text)
    except ValueError:
        print("Bedrock did not return valid JSON, using fallback CV analysis.")
        return create_fallback_analysis(cv_text)


def call_nova_invoke_model(cv_text):
    model_ids = unique_model_ids(
        [
            BEDROCK_MODEL_ID,
            "apac.amazon.nova-lite-v1:0",
        ]
    )
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
                                "content": [
                                    {
                                        "text": build_prompt(cv_text),
                                    },
                                ],
                            }
                        ],
                        "inferenceConfig": {
                            "maxTokens": 2000,
                            "temperature": 0.2,
                            "topP": 0.9,
                        },
                    }
                ),
            )

            return json.loads(result["body"].read())
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


def unique_model_ids(model_ids):
    seen = set()
    unique_ids = []

    for model_id in model_ids:
        if model_id and model_id not in seen:
            seen.add(model_id)
            unique_ids.append(model_id)

    return unique_ids


def create_fallback_analysis(cv_text):
    normalized_text = cv_text.lower()
    skill_keywords = {
        "React": ["react", "vite", "jsx", "frontend"],
        "Python": ["python", "django", "flask", "fastapi"],
        "AWS": ["aws", "lambda", "s3", "dynamodb", "bedrock", "api gateway"],
        "Database": ["database", "sql", "mysql", "postgres", "mongodb", "dynamodb"],
        "Communication": ["team", "presentation", "communication", "english", "collaboration"],
        "Problem Solving": ["algorithm", "problem", "leetcode", "debug", "system design"],
    }

    talent_scores = []
    matched_skills = []

    for label, keywords in skill_keywords.items():
        matches = sum(1 for keyword in keywords if keyword in normalized_text)
        score = min(95, 45 + matches * 15)
        talent_scores.append({"label": label, "score": score})

        if matches:
            matched_skills.append(label)

    project_score = 10 if any(word in normalized_text for word in ["project", "github", "app", "website"]) else 0
    experience_score = 10 if any(word in normalized_text for word in ["intern", "experience", "work", "freelance"]) else 0
    certificate_score = 5 if any(word in normalized_text for word in ["certificate", "certification", "course"]) else 0
    cv_score = min(95, 55 + len(matched_skills) * 5 + project_score + experience_score + certificate_score)

    skills = matched_skills or ["HTML", "CSS", "Programming fundamentals"]

    return {
        "cvScore": cv_score,
        "suggestedPosition": suggest_position(normalized_text),
        "summary": "CV was analyzed with the local fallback evaluator because Bedrock model invocation is currently unavailable.",
        "skills": skills,
        "projects": extract_simple_items(cv_text, ["project", "github", "app", "website"], "Project details not clearly detected"),
        "experience": extract_simple_items(cv_text, ["experience", "intern", "work"], "Experience details not clearly detected"),
        "certificates": extract_simple_items(cv_text, ["certificate", "certification", "course"], "Certificates not clearly detected"),
        "recommendation": "Add measurable project results, clearer technical skills, and specific tools used in each project.",
        "talentScores": talent_scores,
        "skillGroups": [
            {"label": "Frontend", "value": score_for_label(talent_scores, "React"), "skills": join_detected(skills, ["React"]), "tone": "purple"},
            {"label": "Backend", "value": score_for_label(talent_scores, "Python"), "skills": join_detected(skills, ["Python"]), "tone": "blue"},
            {"label": "Cloud", "value": score_for_label(talent_scores, "AWS"), "skills": join_detected(skills, ["AWS"]), "tone": "orange"},
            {"label": "Communication", "value": score_for_label(talent_scores, "Communication"), "skills": "Teamwork, presentation, interview clarity", "tone": "green"},
        ],
    }


def suggest_position(normalized_text):
    if any(word in normalized_text for word in ["react", "frontend", "html", "css", "javascript"]):
        return "Frontend Developer Intern"

    if any(word in normalized_text for word in ["python", "api", "backend", "database"]):
        return "Backend Developer Intern"

    if any(word in normalized_text for word in ["aws", "cloud", "lambda", "s3"]):
        return "Cloud Developer Intern"

    return "Software Developer Intern"


def extract_simple_items(cv_text, keywords, fallback):
    lines = [line.strip() for line in cv_text.splitlines() if line.strip()]
    matched_lines = []

    for line in lines:
        lower_line = line.lower()
        if any(keyword in lower_line for keyword in keywords):
            matched_lines.append(line[:120])

        if len(matched_lines) >= 3:
            break

    return matched_lines or [fallback]


def score_for_label(scores, label):
    for item in scores:
        if item["label"] == label:
            return item["score"]

    return 0


def join_detected(skills, preferred):
    detected = [skill for skill in skills if skill in preferred]
    return ", ".join(detected or preferred)


def build_prompt(cv_text):
    return f"""
You are an AI CV evaluator for a technical interview platform.
Analyze the candidate CV text and return ONLY valid JSON. Do not use markdown.

Score based only on evidence in the CV. If information is missing, give a lower score.
Use Vietnamese for summary and recommendation. Keep labels in English exactly as requested.

Return JSON with this exact shape:
{{
  "cvScore": 0,
  "suggestedPosition": "Frontend Developer Intern",
  "summary": "short Vietnamese summary",
  "skills": ["skill 1", "skill 2"],
  "projects": ["project 1", "project 2"],
  "experience": ["experience 1", "experience 2"],
  "certificates": ["certificate 1", "certificate 2"],
  "recommendation": "Vietnamese improvement advice",
  "talentScores": [
    {{ "label": "React", "score": 0 }},
    {{ "label": "Python", "score": 0 }},
    {{ "label": "AWS", "score": 0 }},
    {{ "label": "Database", "score": 0 }},
    {{ "label": "Communication", "score": 0 }},
    {{ "label": "Problem Solving", "score": 0 }}
  ],
  "skillGroups": [
    {{ "label": "Frontend", "value": 0, "skills": "skills here", "tone": "purple" }},
    {{ "label": "Backend", "value": 0, "skills": "skills here", "tone": "blue" }},
    {{ "label": "Cloud", "value": 0, "skills": "skills here", "tone": "orange" }},
    {{ "label": "Communication", "value": 0, "skills": "skills here", "tone": "green" }}
  ]
}}

CV TEXT:
{cv_text}
"""


def parse_json_from_text(text):
    match = re.search(r"\{.*\}", text, re.DOTALL)

    if not match:
        raise ValueError("Bedrock did not return JSON")

    return json.loads(match.group(0))


def normalize_analysis(raw):
    talent_labels = ["React", "Python", "AWS", "Database", "Communication", "Problem Solving"]
    skill_group_defaults = [
        ("Frontend", "purple"),
        ("Backend", "blue"),
        ("Cloud", "orange"),
        ("Communication", "green"),
    ]

    talent_scores = normalize_score_list(raw.get("talentScores"), talent_labels, "score")
    skill_groups = normalize_skill_groups(raw.get("skillGroups"), skill_group_defaults)

    return {
        "cvScore": clamp_score(raw.get("cvScore"), 70),
        "suggestedPosition": safe_string(raw.get("suggestedPosition"), "Software Developer Intern"),
        "summary": safe_string(raw.get("summary"), "CV analyzed successfully."),
        "skills": safe_string_list(raw.get("skills")),
        "projects": safe_string_list(raw.get("projects")),
        "experience": safe_string_list(raw.get("experience")),
        "certificates": safe_string_list(raw.get("certificates")),
        "recommendation": safe_string(
            raw.get("recommendation"),
            "Add more real projects, measurable outcomes, and technical interview practice notes.",
        ),
        "talentScores": talent_scores,
        "skillGroups": skill_groups,
    }


def normalize_score_list(value, labels, score_key):
    scores_by_label = {}

    if isinstance(value, list):
        for item in value:
            if isinstance(item, dict):
                label = safe_string(item.get("label"), "")
                if label:
                    scores_by_label[label] = clamp_score(item.get(score_key), 0)

    return [
        {
            "label": label,
            score_key: scores_by_label.get(label, 0),
        }
        for label in labels
    ]


def normalize_skill_groups(value, defaults):
    groups_by_label = {}

    if isinstance(value, list):
        for item in value:
            if isinstance(item, dict):
                label = safe_string(item.get("label"), "")
                if label:
                    groups_by_label[label] = item

    groups = []

    for label, tone in defaults:
        item = groups_by_label.get(label, {})
        groups.append(
            {
                "label": label,
                "value": clamp_score(item.get("value"), 0),
                "skills": safe_string(item.get("skills"), "Not enough evidence"),
                "tone": tone,
            }
        )

    return groups


def safe_string(value, fallback):
    if isinstance(value, str) and value.strip():
        return value.strip()
    return fallback


def safe_string_list(value):
    if not isinstance(value, list):
        return []

    cleaned = []
    for item in value[:10]:
        if isinstance(item, str) and item.strip():
            cleaned.append(item.strip())

    return cleaned


def clamp_score(value, fallback):
    try:
        score = int(round(float(value)))
    except (TypeError, ValueError):
        score = fallback

    return max(0, min(100, score))


def update_cv_item(table, user_id, cv_id, update_data):
    expression_names = {}
    expression_values = {}
    update_parts = []

    for key, value in update_data.items():
        name_key = f"#{key}"
        value_key = f":{key}"
        expression_names[name_key] = key
        expression_values[value_key] = to_dynamodb_value(value)
        update_parts.append(f"{name_key} = {value_key}")

    result = table.update_item(
        Key={"userId": user_id, "cvId": cv_id},
        UpdateExpression="SET " + ", ".join(update_parts),
        ExpressionAttributeNames=expression_names,
        ExpressionAttributeValues=expression_values,
        ReturnValues="ALL_NEW",
    )

    return from_dynamodb_value(result["Attributes"])


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
