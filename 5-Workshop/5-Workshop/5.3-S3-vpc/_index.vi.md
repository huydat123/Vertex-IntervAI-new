---
title : "Data Layer: S3 và DynamoDB"
date : 2024-01-01
weight : 3
chapter : false
pre : " <b> 5.3. </b> "
---

#### Tổng quan data layer

Vertex-IntervAI tách phần lưu file lớn và dữ liệu có cấu trúc:

- **Amazon S3** lưu CV đã upload và các file voice.
- **Amazon DynamoDB** lưu users, metadata CV, interview records, answers, attempts, scores và history.

Cách thiết kế này giúp hệ thống đơn giản và đúng hướng serverless. Lambda chỉ đọc/ghi metadata nhỏ trong DynamoDB, còn file lớn như CV/audio/transcript được lưu trong S3.

#### Cấu trúc object trong S3

Nên dùng prefix rõ ràng để dễ kiểm tra và dọn dẹp:

| Loại dữ liệu | Key ví dụ |
| --- | --- |
| CV upload | `cv/{userId}/{cvId}.{extension}` |
| Audio câu hỏi | `voice/question/{userId}/{interviewId}/{questionId}.mp3` |
| Audio câu trả lời | `voice/answer/{userId}/{interviewId}/{questionId}.webm` |
| Transcript | `voice/transcript/{userId}/{interviewId}/{questionId}.json` |

#### DynamoDB tables

| Table | Partition key | Sort key | Mục đích |
| --- | --- | --- | --- |
| `Users` | `userId` | không có | Profile, role, email, fullname, phone, avatar metadata |
| `CVs` | `userId` | `cvId` | Metadata CV, S3 key, kết quả phân tích, role gợi ý |
| `Interviews` | `userId` | `interviewId` | Câu hỏi, câu trả lời, attempts, điểm, final result, feedback |

#### Trong phần này

1. [Tạo S3 buckets và DynamoDB tables](5.3.1-create-gwe/)
2. [Test upload CV, phân tích CV và history data](5.3.2-test-gwe/)
