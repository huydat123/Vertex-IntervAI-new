---
title : "Tạo S3 Buckets và DynamoDB Tables"
date : 2024-01-01
weight : 1
chapter : false
pre : " <b> 5.3.1 </b> "
---

#### Bước 1: Chọn AWS Region

Nên dùng một region chính cho lần triển khai đầu tiên. Giữ Lambda, API Gateway, S3, DynamoDB, Cognito, Polly, Transcribe và Bedrock cùng cấu hình region nếu có thể. Nếu Bedrock model chỉ chạy ở region khác, đặt riêng biến `BEDROCK_REGION` cho các Lambda gọi Bedrock.

#### Bước 2: Tạo S3 storage

Tạo một hoặc hai S3 bucket:

- `CV_BUCKET` để lưu CV upload.
- `AUDIO_BUCKET` để lưu audio câu hỏi, audio câu trả lời và transcript.

Với demo nhỏ, hai biến này có thể trỏ cùng một bucket nếu prefix được tách rõ.

Prefix khuyến nghị:

```text
cv/{userId}/{cvId}.{extension}
voice/question/{userId}/{interviewId}/{questionId}.mp3
voice/answer/{userId}/{interviewId}/{questionId}.webm
voice/transcript/{userId}/{interviewId}/{questionId}.json
```

Bật default encryption và block public access. Frontend không nên upload trực tiếp lên S3 nếu chưa có signed URL flow. Trong dự án hiện tại, frontend gửi CV base64 đến `upload_cv`, sau đó Lambda ghi object vào S3.

#### Bước 3: Cấu hình S3 CORS nếu cần browser truy cập trực tiếp

Nếu frontend cần lấy generated audio trực tiếp từ S3, thêm CORS rule tương tự:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedOrigins": ["http://localhost:5173"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

Khi có frontend production URL, thêm origin production vào rule.

#### Bước 4: Tạo DynamoDB tables

Tạo các bảng dưới đây với on-demand capacity để dễ dùng cho demo:

| Table | Partition key | Sort key |
| --- | --- | --- |
| `Users` | `userId` string | không có |
| `CVs` | `userId` string | `cvId` string |
| `Interviews` | `userId` string | `interviewId` string |

Các attributes quan trọng:

- `Users`: `email`, `fullName`, `phone`, `avatarUrl`, `role`, `createdAt`, `updatedAt`.
- `CVs`: `cvId`, `fileName`, `fileType`, `s3Key`, `status`, `analysis`, `createdAt`, `updatedAt`.
- `Interviews`: `interviewId`, `cvId`, `role`, `questionCount`, `questions`, `answers`, `attempts`, `score`, `feedback`, `createdAt`, `updatedAt`.

#### Bước 5: Lưu lại tên resource cho Lambda environment variables

Sau khi tạo xong, ghi lại:

- Tên CV bucket.
- Tên audio bucket.
- Tên DynamoDB tables.
- AWS region.

Các giá trị này sẽ được dùng cho environment variables của Lambda ở phần tiếp theo.
