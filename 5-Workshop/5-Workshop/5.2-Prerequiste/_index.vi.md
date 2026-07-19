---
title : "Chuẩn bị"
date : 2024-01-01
weight : 2
chapter : false
pre : " <b> 5.2. </b> "
---

#### Yêu cầu AWS account

Trước khi bắt đầu, AWS account cần dùng được các dịch vụ sau:

- AWS Lambda
- Amazon API Gateway
- Amazon S3
- Amazon DynamoDB
- Amazon Cognito
- Amazon Bedrock với quyền truy cập model Nova Lite đã chọn
- Amazon Polly
- Amazon Transcribe
- Amazon CloudWatch Logs
- AWS IAM
- Amazon SES nếu muốn gửi feedback email

CloudFront và WAF được khuyến nghị cho frontend production, nhưng trong đồ án này đang tạm hoãn vì AWS account chưa hoàn tất phần verification cần thiết.

#### IAM permissions để triển khai

User dùng để deploy nên có quyền quản lý:

- Lambda functions, environment variables và execution roles.
- API Gateway routes, stages, CORS và JWT authorizers.
- S3 buckets, objects và bucket CORS.
- DynamoDB tables và quyền đọc/ghi item.
- Cognito User Pool, App Client, Hosted UI domain, groups và users.
- Bedrock model invocation.
- Polly speech synthesis và Transcribe jobs.
- CloudWatch log groups và log streams.
- IAM PassRole cho Lambda execution roles.

#### Công cụ local

Cài đặt và cấu hình:

- Node.js và npm cho frontend React + Vite.
- AWS CLI với credentials của account/region đang dùng.
- Python 3.12 hoặc đúng runtime đang dùng cho Lambda.
- Trình duyệt hiện đại để test Cognito Hosted UI, camera và microphone.

#### Environment variables frontend

Tạo hoặc cập nhật `frontend/.env` dựa trên `frontend/.env.example`:

```bash
VITE_API_BASE_URL=https://your-api-id.execute-api.region.amazonaws.com/stage
VITE_INTERVIEW_API_BASE_URL=https://your-api-id.execute-api.region.amazonaws.com/stage
VITE_PROFILE_API_BASE_URL=https://your-api-id.execute-api.region.amazonaws.com/stage
VITE_VOICE_API_BASE_URL=https://your-api-id.execute-api.region.amazonaws.com/stage
VITE_COGNITO_DOMAIN=https://your-domain.auth.region.amazoncognito.com
VITE_COGNITO_CLIENT_ID=your_app_client_id
VITE_COGNITO_REDIRECT_URI=http://localhost:5173
VITE_COGNITO_LOGOUT_URI=http://localhost:5173
VITE_COGNITO_SCOPES=openid email profile
```

Khi test local, callback URL và logout URL trong Cognito phải có `http://localhost:5173`. Khi deploy lên S3/CloudFront thì thêm URL production sau.

#### Environment variables backend

Mỗi Lambda chỉ nên nhận biến môi trường mà nó cần. Các biến thường dùng:

```bash
CV_BUCKET=your-cv-bucket
AUDIO_BUCKET=your-audio-bucket
CVS_TABLE=CVs
USERS_TABLE=Users
INTERVIEWS_TABLE=Interviews
BEDROCK_MODEL_ID=amazon.nova-lite-v1:0
BEDROCK_REGION=your-bedrock-region
```

#### Checklist Cognito

- Tạo User Pool.
- Thêm sign-up attributes gồm full name, email, phone number và có thể thêm profile picture.
- Tạo App Client cho React app.
- Cấu hình Hosted UI domain.
- Thêm callback URL và logout URL.
- Bật scopes `openid`, `email` và `profile`.
- Tạo groups `user` và `admin`.
- Add test users vào đúng group.
- Kiểm tra ID token có thông tin user và group claims.
