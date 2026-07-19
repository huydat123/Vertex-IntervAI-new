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
    requested = clean_identity_string(requested_user_id) or "user_demo_001"

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

        body = json.loads(event.get("body") or "{}")
        user_id = resolve_user_id(event, body.get("userId"))
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
        analysis = normalize_analysis(ai_result, cv_text)

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
    pypdf_text = extract_pdf_text_with_pypdf(file_bytes)

    if has_enough_readable_text(pypdf_text):
        return pypdf_text

    text_parts = []

    for stream in iter_pdf_streams(file_bytes):
        text_parts.extend(extract_pdf_strings(stream))

    if not text_parts:
        text_parts.extend(extract_pdf_strings(file_bytes))

    return clean_text("\n".join(text_parts))


def extract_pdf_text_with_pypdf(file_bytes):
    try:
        from pypdf import PdfReader
    except ImportError:
        return ""

    try:
        reader = PdfReader(BytesIO(file_bytes))
        pages = []

        for page in reader.pages:
            pages.append(page.extract_text() or "")

        return clean_text("\n".join(pages))
    except Exception as error:
        print("pypdf extraction failed, using fallback PDF parser:", str(error))
        return ""


def has_enough_readable_text(value):
    if len(value.strip()) < 80:
        return False

    readable_chars = sum(
        1
        for char in value
        if char.isalnum() or char.isspace() or char in ".,:;-/@()[]+#&|"
    )

    return readable_chars / max(1, len(value)) > 0.72


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
    evidence = extract_cv_evidence(cv_text)

    return {
        **evidence,
        "summary": "CV was analyzed with the local fallback evaluator because Bedrock model invocation is currently unavailable. The parser extracted skills, projects, roles, and certificates from CV sections.",
        "recommendation": "Add measurable project results, clearer technical skills, and specific tools used in each project.",
    }


def extract_cv_evidence(cv_text):
    skills = extract_skills(cv_text)
    projects = extract_projects(cv_text)
    experience = extract_experience(cv_text, projects)
    certificates = extract_certificates(cv_text)
    talent_scores = build_talent_scores(cv_text, skills, projects)

    return {
        "cvScore": calculate_cv_score(skills, projects, experience, certificates),
        "suggestedPosition": suggest_position(cv_text, skills),
        "skills": skills or ["HTML/CSS", "Programming fundamentals"],
        "projects": projects or extract_simple_items(cv_text, ["project", "github", "app", "website"], "Project details not clearly detected"),
        "experience": experience or ["Project-based software development experience"],
        "certificates": certificates or ["Certificates not clearly detected"],
        "talentScores": talent_scores,
        "skillGroups": build_skill_groups(skills, talent_scores),
    }


def extract_skills(cv_text):
    normalized_text = normalize_for_matching(cv_text)
    skill_catalog = [
        ("PHP", [" php "]),
        ("Java", [" java ", "java core"]),
        ("JavaScript", ["javascript", " js "]),
        ("TypeScript", ["typescript"]),
        ("Dart", ["dart"]),
        ("HTML/CSS", ["html/css", "html5", "css3", "html", "css"]),
        ("SQL", [" sql ", "sql."]),
        ("React.js", ["react.js", "react"]),
        ("Next.js", ["next.js", "nextjs"]),
        ("Node.js", ["node.js", "nodejs"]),
        ("Java Spring Boot", ["java spring boot", "spring boot"]),
        ("Spring MVC", ["spring mvc"]),
        ("Spring Security", ["spring security"]),
        ("Hibernate/JPA", ["hibernate/jpa", "hibernate", " jpa "]),
        ("Thymeleaf", ["thymeleaf"]),
        ("MVC", [" mvc "]),
        ("Razor View", ["razor view"]),
        ("Entity Framework Core", ["entity framework core"]),
        ("WordPress", ["wordpress"]),
        ("NestJS", ["nestjs", "nest.js"]),
        ("Express", ["express"]),
        ("Flutter", ["flutter"]),
        ("MySQL", ["mysql"]),
        ("MongoDB", ["mongodb"]),
        ("SQL Server", ["sql server"]),
        ("Sequelize ORM", ["sequelize orm", "sequelize"]),
        ("Socket.IO", ["socket.io", "socket io"]),
        ("Multer", ["multer"]),
        ("JWT", ["jwt", "json web tokens", "json web token"]),
        ("HTTP-only Cookies", ["http-only cookies", "http only cookies"]),
        ("Tailwind CSS", ["tailwind css", "tailwind"]),
        ("Shadcn UI", ["shadcn ui", "shadcn"]),
        ("Git", [" git "]),
        ("GitHub", ["github"]),
        ("GitHub Pages", ["github pages"]),
        ("XAMPP", ["xampp"]),
        ("Figma", ["figma"]),
        ("StarUML", ["staruml", "star uml"]),
        ("VS Code", ["vs code", "visual studio code"]),
        ("Postman", ["postman"]),
        ("RESTful APIs", ["restful api", "restful apis", "rest api", "rest apis"]),
        ("WebSockets", ["websocket", "websockets"]),
        ("OOP", ["object-oriented programming", "oop"]),
        ("ArrayList", ["arraylist"]),
        ("File I/O", ["file i/o", "file io"]),
        ("Data Structures and Algorithms", ["data structures and algorithms"]),
    ]

    detected = []

    for label, keywords in skill_catalog:
        if any(keyword in normalized_text for keyword in keywords):
            detected.append(label)

    return unique_items(detected)[:32]


def extract_projects(cv_text):
    lines = get_clean_lines(cv_text)
    projects = []

    for index, line in enumerate(lines):
        if "technologies:" not in line.lower():
            continue

        heading = find_project_heading(lines, index)
        technologies = collect_technology_text(lines, index)

        if heading and technologies:
            projects.append(f"{heading} - Technologies: {technologies}")

    if projects:
        return unique_items(projects)[:8]

    project_section = extract_section(
        cv_text,
        ["technical projects", "featured projects", "projects", "personal projects"],
        ["skills", "certificates", "education", "experience"],
    )
    section_lines = get_clean_lines(project_section)

    for line in section_lines:
        if looks_like_project_heading(line):
            projects.append(clean_cv_line(line))

    projects.extend(extract_github_projects(cv_text))

    return unique_items(projects)[:8]


def find_project_heading(lines, technology_line_index):
    for index in range(technology_line_index - 1, max(-1, technology_line_index - 10), -1):
        line = lines[index]

        if not is_project_heading_candidate(line):
            continue

        heading = line

        for continuation in lines[index + 1:min(len(lines), index + 4)]:
            if is_heading_continuation(continuation):
                heading = f"{heading} {continuation}"
                break

        return clean_project_heading(heading)

    return ""


def is_project_heading_candidate(line):
    lower_line = line.lower()

    if is_noise_line(line):
        return False

    if "|" in line and any(role in lower_line for role in ["developer", "engineer", "member"]):
        return True

    project_words = [
        "system",
        "website",
        "application",
        "app",
        "service",
        "manager",
        "management",
        "portfolio",
        "booking",
        "sharing",
        "task",
    ]

    return any(word in lower_line for word in project_words) and len(line.split()) >= 3


def is_heading_continuation(line):
    lower_line = line.lower().strip()
    return lower_line in {"project)", "(academic project)", "academic project)"}


def clean_project_heading(line):
    line = clean_cv_line(line)
    line = strip_leading_noise_before_project_title(line)
    line = re.sub(r"\s+", " ", line)
    line = re.sub(r"\(\s*Academic\s+Project\s*\)", "(Academic Project)", line, flags=re.IGNORECASE)
    line = re.sub(r"\(\s*Academic\s*$", "(Academic Project)", line, flags=re.IGNORECASE)
    return line.strip(" -")


def strip_leading_noise_before_project_title(line):
    project_starters = [
        "movie",
        "website",
        "jwt",
        "portfolio",
        "personal",
        "todo",
        "student",
        "library",
        "booking",
        "management",
        "e-commerce",
        "shop",
        "task",
    ]
    lower_line = line.lower()
    positions = [
        lower_line.find(starter)
        for starter in project_starters
        if lower_line.find(starter) >= 0
    ]

    if positions:
        first_position = min(positions)
        return line[first_position:].strip() if first_position > 0 else line.strip()

    return re.sub(r"^(?:git|github|xampp|figma|staruml|postman|vs code)[,\s]+", "", line, flags=re.IGNORECASE)


def collect_technology_text(lines, technology_line_index):
    first_line = lines[technology_line_index]
    parts = [extract_text_after_label(first_line, "technologies")]

    for line in lines[technology_line_index + 1:technology_line_index + 4]:
        lower_line = line.lower()

        if any(marker in lower_line for marker in ["key responsibilities", "achievements", "education", "activities"]):
            break

        if looks_like_technology_continuation(line):
            parts.append(line)

    technologies_text = " ".join(parts)
    technologies_text = remove_sidebar_noise_from_technologies(technologies_text)
    technologies_text = re.sub(r"\s+(19|20)\d{2}\s*$", "", technologies_text).strip()
    technologies = split_technology_items(technologies_text)

    return ", ".join(technologies)


def extract_text_after_label(line, label):
    match = re.search(label + r"\s*:\s*(.+)", line, re.IGNORECASE)
    return match.group(1) if match else line


def looks_like_technology_continuation(line):
    lower_line = line.lower()

    if is_noise_line(line):
        return False

    technology_markers = [
        "java",
        "spring",
        "hibernate",
        "mysql",
        "html",
        "css",
        "javascript",
        "github",
        "figma",
        "staruml",
        "react",
        "node",
        "express",
        "mongodb",
        "tailwind",
        "jwt",
    ]

    return any(marker in lower_line for marker in technology_markers)


def remove_sidebar_noise_from_technologies(value):
    value = re.sub(r"^(?:github\.com/\S+\s*)", "", value, flags=re.IGNORECASE)
    value = re.sub(r"^(?:soft skills\s*)", "", value, flags=re.IGNORECASE)
    value = re.sub(r"^(?:communication|teamwork|problem-solving)\s+", "", value, flags=re.IGNORECASE)
    value = re.sub(r"\b(?:communication|teamwork|problem-solving)\b", "", value, flags=re.IGNORECASE)
    return clean_cv_line(value)


def split_technology_items(value):
    raw_items = re.split(r",|;|\s{2,}", value)
    items = []

    for item in raw_items:
        cleaned = normalize_technology_name(item)

        if cleaned:
            items.append(cleaned)

    return unique_items(items)


def normalize_technology_name(value):
    value = clean_cv_line(value)
    value = value.strip(" .")

    if not value:
        return ""

    replacements = {
        "html": "HTML",
        "css": "CSS",
        "javascript": "JavaScript",
        "java core": "Java Core",
        "java spring boot": "Java Spring Boot",
        "spring mvc": "Spring MVC",
        "hibernate/jpa": "Hibernate/JPA",
        "mysql": "MySQL",
        "github": "GitHub",
        "figma": "Figma",
        "staruml": "StarUML",
        "oop": "OOP",
        "arraylist": "ArrayList",
        "file i/o": "File I/O",
    }

    return replacements.get(value.lower(), value)


def extract_github_projects(cv_text):
    projects = []

    for match in re.finditer(r"github\.com/[^\s,)]+", cv_text, re.IGNORECASE):
        url = match.group(0).rstrip(".")
        repo_name = url.rsplit("/", 1)[-1]

        if repo_name and repo_name.lower() not in {"github.com"}:
            projects.append(f"{format_project_name(repo_name)} ({url})")

    return projects


def is_noise_line(line):
    lower_line = line.lower()
    noise_markers = [
        "career objective",
        "education",
        "skills",
        "programming",
        "frameworks",
        "database",
        "tools",
        "soft skills",
        "hobbies",
        "activities",
        "male",
        "github.com/",
        "@",
        "thu duc",
        "ho chi minh",
    ]

    if re.search(r"\b\d{2}/\d{2}/\d{4}\b", lower_line):
        return True

    if re.fullmatch(r"(19|20)\d{2}\s*-\s*(19|20)\d{2}", lower_line):
        return True

    return any(marker in lower_line for marker in noise_markers)


def extract_experience(cv_text, projects):
    experience = []
    role_pattern = re.compile(
        r"\b(Full-Stack Developer|Backend Developer|Frontend Developer|Mobile Developer|Software Developer|Web Developer|Developer Intern|Member)\b",
        re.IGNORECASE,
    )

    for project in projects:
        match = role_pattern.search(project)

        if not match:
            continue

        role = normalize_role(match.group(1))
        project_name = project[:match.start()].strip(" -|")

        if project_name:
            experience.append(f"{role} - {project_name}")

    experience_section = extract_section(
        cv_text,
        ["experience", "work experience", "professional experience"],
        ["technical projects", "projects", "skills", "certificates", "education"],
    )

    for line in get_clean_lines(experience_section):
        if any(keyword in line.lower() for keyword in ["intern", "developer", "engineer", "assistant"]):
            experience.append(clean_cv_line(line))

    return unique_items(experience)[:6]


def extract_certificates(cv_text):
    certificates = []
    lines = get_clean_lines(cv_text)

    for line in lines:
        lower_line = line.lower()

        if lower_line in {"skills & certificates", "certificates", "languages & certificates"}:
            continue

        if lower_line.startswith("languages & certificates"):
            value = line.split(":", 1)[-1] if ":" in line else line

            for item in re.split(r",|;", value):
                cleaned = clean_cv_line(item).rstrip(".")

                if not cleaned:
                    continue

                ielts_match = re.search(r"English\s*\((IELTS\s*[\d.]+)\)", cleaned, re.IGNORECASE)
                certificates.append(f"English - {ielts_match.group(1)}" if ielts_match else cleaned)

            continue

        if "ielts" in lower_line:
            match = re.search(r"English\s*\((IELTS\s*[\d.]+)\)", line, re.IGNORECASE)
            certificates.append(f"English - {match.group(1)}" if match else clean_cv_line(line))

        if "certificate" in lower_line and "languages & certificates" not in lower_line:
            certificates.append(clean_cv_line(line))

    return unique_items(certificates)[:6]


def build_talent_scores(cv_text, skills, projects):
    normalized_text = normalize_for_matching(cv_text)
    score_rules = {
        "React": ["React.js", "Next.js", "JavaScript", "TypeScript", "HTML/CSS", "Tailwind CSS", "Shadcn UI", "Figma"],
        "Python": ["Python"],
        "AWS": ["AWS", "Lambda", "S3", "DynamoDB", "Bedrock", "API Gateway", "GitHub"],
        "Database": ["MongoDB", "MySQL", "SQL", "SQL Server", "Sequelize ORM", "Hibernate/JPA"],
        "Communication": ["English - IELTS 5.5", "English", "Vietnamese", "team", "collaboration"],
        "Problem Solving": ["Data Structures and Algorithms", "OOP", "ArrayList", "File I/O", "optimized", "performance", "engineered", "debug", "logical thinking"],
    }
    scores = []

    for label, indicators in score_rules.items():
        matches = 0

        for indicator in indicators:
            normalized_indicator = normalize_for_matching(indicator)
            if indicator in skills or normalized_indicator in normalized_text:
                matches += 1

        base = 45
        if label == "Problem Solving" and projects:
            base += 10

        scores.append({"label": label, "score": min(95, base + matches * 10)})

    return scores


def build_skill_groups(skills, talent_scores):
    frontend = filter_skills(skills, ["React.js", "Next.js", "JavaScript", "TypeScript", "HTML/CSS", "Tailwind CSS", "Shadcn UI", "Razor View", "Thymeleaf", "Figma"])
    backend = filter_skills(skills, ["Java", "Java Spring Boot", "Spring MVC", "Spring Security", "PHP", "Node.js", "NestJS", "Express", "RESTful APIs", "JWT", "HTTP-only Cookies", "Multer", "MVC", "Entity Framework Core", "WordPress", "OOP", "ArrayList", "File I/O"])
    cloud = filter_skills(skills, ["GitHub Pages", "GitHub", "Postman", "XAMPP", "VS Code", "StarUML", "Git"])
    database = filter_skills(skills, ["MySQL", "MongoDB", "SQL", "SQL Server", "Sequelize ORM", "Hibernate/JPA"])
    frontend_score = min(95, 50 + len(frontend) * 6)
    backend_score = min(95, 50 + len(backend) * 7)
    cloud_score = max(score_for_label(talent_scores, "AWS"), min(70, 35 + len(cloud) * 10))

    return [
        {"label": "Frontend", "value": max(score_for_label(talent_scores, "React"), frontend_score if frontend else 0), "skills": ", ".join(frontend or ["Not enough evidence"]), "tone": "purple"},
        {"label": "Backend", "value": backend_score if backend else 0, "skills": ", ".join(backend or ["Not enough evidence"]), "tone": "blue"},
        {"label": "Cloud", "value": cloud_score if cloud else score_for_label(talent_scores, "AWS"), "skills": ", ".join(cloud or ["Not enough evidence"]), "tone": "orange"},
        {"label": "Communication", "value": score_for_label(talent_scores, "Communication"), "skills": "English, Vietnamese, interview clarity", "tone": "green"},
        {"label": "Database", "value": score_for_label(talent_scores, "Database"), "skills": ", ".join(database or ["Not enough evidence"]), "tone": "blue"},
    ]


def calculate_cv_score(skills, projects, experience, certificates):
    skill_score = min(25, len(skills) * 2)
    project_score = min(30, len(projects) * 8)
    experience_score = min(20, len(experience) * 5)
    certificate_score = min(10, len(certificates) * 5)
    return min(95, 45 + skill_score + project_score + experience_score + certificate_score)


def suggest_position(cv_text, skills):
    normalized_text = normalize_for_matching(cv_text)
    frontend_count = len(filter_skills(skills, ["React.js", "Next.js", "JavaScript", "TypeScript", "HTML/CSS", "Tailwind CSS", "Shadcn UI", "Razor View", "Thymeleaf", "Figma"]))
    backend_count = len(filter_skills(skills, ["Java", "Java Spring Boot", "Spring MVC", "Spring Security", "PHP", "Node.js", "NestJS", "Express", "RESTful APIs", "JWT", "Multer", "MVC", "Entity Framework Core", "WordPress", "OOP"]))
    mobile_count = len(filter_skills(skills, ["Flutter", "Dart"]))
    database_count = len(filter_skills(skills, ["MySQL", "MongoDB", "SQL", "SQL Server", "Sequelize ORM", "Hibernate/JPA"]))

    if "full-stack" in normalized_text or (frontend_count >= 3 and backend_count >= 3):
        return "Full-Stack Developer Intern"

    if mobile_count >= 2:
        return "Mobile Developer Intern"

    if backend_count + database_count >= frontend_count:
        return "Backend Developer Intern"

    if frontend_count:
        return "Frontend Developer Intern"

    if any(word in normalized_text for word in ["aws", "cloud", "lambda", "s3"]):
        return "Cloud Developer Intern"

    return "Software Developer Intern"


def filter_skills(skills, preferred):
    preferred_set = set(preferred)
    return [skill for skill in skills if skill in preferred_set]


def extract_section(text, starts, stops):
    lines = get_clean_lines(text)
    capture = False
    captured = []

    for line in lines:
        normalized = line.strip().lower()

        if any(normalized.startswith(start) for start in starts):
            capture = True
            continue

        if capture and any(normalized.startswith(stop) for stop in stops):
            break

        if capture:
            captured.append(line)

    return "\n".join(captured)


def get_clean_lines(text):
    return [clean_cv_line(line) for line in text.splitlines() if clean_cv_line(line)]


def clean_cv_line(line):
    line = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\uf000-\uf8ff]", " ", line)
    line = line.replace("\ufffd", " ")
    line = re.sub(r"\s+", " ", line).strip()
    line = re.sub(r"^[•\-–—*]+\s*", "", line)
    line = re.sub(r"^[•●▪◦\-\–\—*]+\s*", "", line)
    return line


def looks_like_project_heading(line):
    lower_line = line.lower()
    return any(role in lower_line for role in ["developer", "engineer"]) and not lower_line.startswith("technologies:")


def normalize_role(value):
    normalized = re.sub(r"\s+", " ", value.strip()).lower()
    replacements = {
        "full-stack developer": "Full-Stack Developer",
        "backend developer": "Backend Developer",
        "frontend developer": "Frontend Developer",
        "mobile developer": "Mobile Developer",
        "software developer": "Software Developer",
        "web developer": "Web Developer",
        "developer intern": "Developer Intern",
        "member": "Member",
    }
    return replacements.get(normalized, value.strip().title())


def format_project_name(value):
    cleaned = re.sub(r"[-_]+", " ", str(value)).strip()
    return re.sub(r"\s+", " ", cleaned).title()


def normalize_for_matching(text):
    cleaned = re.sub(r"[^a-z0-9.+#/ -]+", " ", text.lower())
    return f" {cleaned.replace('-', ' ')} "


def unique_items(items):
    seen = set()
    unique = []

    for item in items:
        cleaned = clean_cv_line(str(item))
        key = cleaned.lower()

        if cleaned and key not in seen:
            seen.add(key)
            unique.append(cleaned)

    return unique


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
Extract concrete evidence from the CV:
- skills: include up to 20 concrete technologies, frameworks, databases, tools, and languages.
- projects: include every clear project name with role and main technologies.
- experience: include work experience if present; otherwise include project-based roles such as Full-Stack Developer, Backend Developer, Frontend Developer.
- certificates: include certificates and language certificates such as IELTS. Do not return section headings.

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


def normalize_analysis(raw, cv_text=None):
    talent_labels = ["React", "Python", "AWS", "Database", "Communication", "Problem Solving"]
    skill_group_defaults = [
        ("Frontend", "purple"),
        ("Backend", "blue"),
        ("Cloud", "orange"),
        ("Communication", "green"),
    ]
    fallback = extract_cv_evidence(cv_text) if cv_text else {}

    talent_scores = normalize_score_list(raw.get("talentScores"), talent_labels, "score")
    skill_groups = normalize_skill_groups(raw.get("skillGroups"), skill_group_defaults)
    fallback_scores = fallback.get("talentScores") or []
    fallback_groups = fallback.get("skillGroups") or []

    if should_use_fallback_scores(talent_scores) and fallback_scores:
        talent_scores = fallback_scores

    if should_use_fallback_skill_groups(skill_groups) and fallback_groups:
        skill_groups = fallback_groups

    return {
        "cvScore": clamp_score(raw.get("cvScore"), fallback.get("cvScore", 70)),
        "suggestedPosition": safe_string(raw.get("suggestedPosition"), fallback.get("suggestedPosition", "Software Developer Intern")),
        "summary": safe_string(raw.get("summary"), "CV analyzed successfully."),
        "skills": prefer_rich_list(raw.get("skills"), fallback.get("skills")),
        "projects": prefer_rich_list(raw.get("projects"), fallback.get("projects")),
        "experience": prefer_rich_list(raw.get("experience"), fallback.get("experience")),
        "certificates": prefer_rich_list(raw.get("certificates"), fallback.get("certificates")),
        "recommendation": safe_string(
            raw.get("recommendation"),
            "Add more real projects, measurable outcomes, and technical interview practice notes.",
        ),
        "talentScores": talent_scores,
        "skillGroups": skill_groups,
    }


def prefer_rich_list(primary, fallback):
    primary_list = safe_string_list(primary)
    fallback_list = safe_string_list(fallback)

    if is_low_quality_list(primary_list) and fallback_list:
        return fallback_list

    if len(fallback_list) > len(primary_list):
        return unique_items(primary_list + fallback_list)[:32]

    return primary_list


def is_low_quality_list(items):
    if not items:
        return True

    low_quality_markers = [
        "not clearly detected",
        "not enough evidence",
        "coursew",
        "project details",
        "certificates not",
    ]

    return any(
        len(item.strip()) <= 3
        or any(marker in item.lower() for marker in low_quality_markers)
        for item in items
    )


def should_use_fallback_scores(scores):
    if not scores:
        return True

    non_zero_scores = [item.get("score", 0) for item in scores if item.get("score", 0) > 0]
    return len(non_zero_scores) <= 2


def should_use_fallback_skill_groups(groups):
    if not groups:
        return True

    return any(group.get("skills") == "Not enough evidence" for group in groups)


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
    for item in value[:32]:
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
