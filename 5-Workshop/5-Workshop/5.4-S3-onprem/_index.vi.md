---
title : "Backend APIs: Lambda và API Gateway"
date : 2024-01-01
weight : 4
chapter : false
pre : " <b> 5.4. </b> "
---

#### Tổng quan backend

Backend nằm trong `backend/` và được chia theo từng Lambda folder. API Gateway expose các Lambda này cho frontend React.

#### API routes

| Route | Method | Lambda | Mục đích |
| --- | --- | --- | --- |
| `/upload-cv` | `POST` | `upload_cv` | Upload CV base64 lên S3 và lưu metadata |
| `/analyze-cv` | `POST` | `analyze_cv` | Đọc CV từ S3, phân tích và cập nhật `CVs` |
| `/profile` | `GET` | `profile_api` | Đọc profile người dùng |
| `/profile` | `POST` | `profile_api` | Cập nhật fullname, phone, avatar và profile fields |
| `/interviews` | `POST` | `create_interview` | Tạo câu hỏi phỏng vấn theo role |
| `/interviews/answer` | `POST` | `submit_answer` | Chấm điểm câu trả lời và cập nhật attempts |
| `/voice/question-audio` | `POST` | `polly_speech` | Tạo audio cho câu hỏi |
| `/voice/transcribe` | `POST` | `transcribe_audio` | Chuyển voice answer thành text |
| `/history` | `GET` | `history_api` | Đọc interview history từ DynamoDB |
| `/admin/*` | tùy route | `admin_api` | Các chức năng admin console |

#### Trong phần này

1. [Deploy Lambda functions và environment variables](5.4.1-prepare/)
2. [Cấu hình API Gateway và Cognito authorizer](5.4.2-create-interface-enpoint/)
3. [Test API endpoints](5.4.3-test-endpoint/)
4. [Kết nối frontend và Cognito Hosted UI](5.4.4-dns-simulation/)
