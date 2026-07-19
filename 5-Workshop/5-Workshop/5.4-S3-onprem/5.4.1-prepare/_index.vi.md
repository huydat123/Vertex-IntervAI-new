---
title : "Deploy Lambda Functions"
date : 2024-01-01
weight : 1
chapter : false
pre : " <b> 5.4.1 </b> "
---

#### Danh sách Lambda backend

Deploy hoặc update các Lambda trong thư mục `backend/`:

- `upload_cv`
- `analyze_cv`
- `profile_api`
- `create_interview`
- `submit_answer`
- `polly_speech`
- `transcribe_audio`
- `history_api`
- `admin_api`

Mỗi Lambda nên có execution role riêng, hoặc dùng shared role được giới hạn kỹ cho môi trường demo.

#### Environment variables cần thiết

Chỉ cấu hình biến mà từng function cần:

| Lambda | Variables cần có |
| --- | --- |
| `upload_cv` | `CV_BUCKET`, `CVS_TABLE` |
| `analyze_cv` | `CV_BUCKET`, `CVS_TABLE`, `BEDROCK_MODEL_ID`, `BEDROCK_REGION` |
| `profile_api` | `USERS_TABLE` |
| `create_interview` | `CVS_TABLE`, `INTERVIEWS_TABLE`, `BEDROCK_MODEL_ID`, `BEDROCK_REGION` |
| `submit_answer` | `INTERVIEWS_TABLE`, `BEDROCK_MODEL_ID`, `BEDROCK_REGION` |
| `polly_speech` | `AUDIO_BUCKET` |
| `transcribe_audio` | `AUDIO_BUCKET` |
| `history_api` | `CVS_TABLE`, `INTERVIEWS_TABLE` |
| `admin_api` | `USERS_TABLE`, `CVS_TABLE`, `INTERVIEWS_TABLE` |

#### IAM permissions theo function

Dùng least privilege:

- `upload_cv`: `s3:PutObject`, `dynamodb:PutItem`, `dynamodb:UpdateItem`.
- `analyze_cv`: `s3:GetObject`, `dynamodb:GetItem`, `dynamodb:UpdateItem`, `bedrock:InvokeModel`.
- `profile_api`: `dynamodb:GetItem`, `dynamodb:PutItem`, `dynamodb:UpdateItem`.
- `create_interview`: `dynamodb:GetItem`, `dynamodb:PutItem`, `dynamodb:Query`, `bedrock:InvokeModel`.
- `submit_answer`: `dynamodb:GetItem`, `dynamodb:UpdateItem`, `bedrock:InvokeModel`.
- `polly_speech`: `polly:SynthesizeSpeech`, `s3:PutObject`.
- `transcribe_audio`: `transcribe:StartTranscriptionJob`, `transcribe:GetTranscriptionJob`, `s3:GetObject`, `s3:PutObject`.
- `history_api`: `dynamodb:Query`, `dynamodb:GetItem`.
- `admin_api`: quyền đọc `Users`, `CVs`, `Interviews`, cộng thêm quyền update/export đúng với chức năng admin cần.

#### Checklist deploy

Với từng Lambda:

1. Kiểm tra handler file và handler name đúng với Lambda setting.
2. Chọn runtime đúng với code.
3. Upload function code.
4. Gắn execution role.
5. Thêm environment variables.
6. Set timeout đủ cho Bedrock và luồng Transcribe.
7. Mở CloudWatch Logs sau lần test đầu tiên.

#### Kỳ vọng xử lý lỗi

Mỗi Lambda nên trả JSON thống nhất:

```json
{
  "success": true,
  "data": {}
}
```

Khi lỗi:

```json
{
  "success": false,
  "message": "Readable error message"
}
```

Cách này giúp frontend service dễ debug hơn và tránh lỗi trắng màn hình khi API trả lỗi.
