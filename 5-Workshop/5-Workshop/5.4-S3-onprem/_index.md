---
title : "Backend APIs: Lambda and API Gateway"
date : 2024-01-01
weight : 4
chapter : false
pre : " <b> 5.4. </b> "
---

#### Backend overview

The backend is located in `backend/` and is organized as one Lambda folder per feature. API Gateway exposes the Lambda functions to the React frontend.

#### API routes

| Route | Method | Lambda | Purpose |
| --- | --- | --- | --- |
| `/upload-cv` | `POST` | `upload_cv` | Upload CV base64 to S3 and save metadata |
| `/analyze-cv` | `POST` | `analyze_cv` | Read CV from S3, analyze it, update `CVs` |
| `/profile` | `GET` | `profile_api` | Read user profile |
| `/profile` | `POST` | `profile_api` | Update full name, phone, avatar, and profile fields |
| `/interviews` | `POST` | `create_interview` | Generate role-based interview questions |
| `/interviews/answer` | `POST` | `submit_answer` | Score an answer and update interview attempts |
| `/voice/question-audio` | `POST` | `polly_speech` | Generate question audio |
| `/voice/transcribe` | `POST` | `transcribe_audio` | Transcribe voice answer to text |
| `/history` | `GET` | `history_api` | Read interview history from DynamoDB |
| `/admin/*` | varies | `admin_api` | Admin console operations |

#### In this section

1. [Deploy Lambda functions and environment variables](5.4.1-prepare/)
2. [Configure API Gateway and Cognito authorizer](5.4.2-create-interface-enpoint/)
3. [Test API endpoints](5.4.3-test-endpoint/)
4. [Connect frontend and Cognito Hosted UI](5.4.4-dns-simulation/)
