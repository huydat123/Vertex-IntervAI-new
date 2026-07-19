---
title : "Deploy Lambda Functions"
date : 2024-01-01
weight : 1
chapter : false
pre : " <b> 5.4.1 </b> "
---

#### Backend Lambda list

Deploy or update the Lambda functions from the `backend/` directory:

- `upload_cv`
- `analyze_cv`
- `profile_api`
- `create_interview`
- `submit_answer`
- `polly_speech`
- `transcribe_audio`
- `history_api`
- `admin_api`

Each Lambda should have its own execution role or a carefully scoped shared role for the demo environment.

#### Required environment variables

Configure only the variables each function needs:

| Lambda | Required variables |
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

#### IAM permissions by function

Use least-privilege permissions:

- `upload_cv`: `s3:PutObject`, `dynamodb:PutItem`, `dynamodb:UpdateItem`.
- `analyze_cv`: `s3:GetObject`, `dynamodb:GetItem`, `dynamodb:UpdateItem`, `bedrock:InvokeModel`.
- `profile_api`: `dynamodb:GetItem`, `dynamodb:PutItem`, `dynamodb:UpdateItem`.
- `create_interview`: `dynamodb:GetItem`, `dynamodb:PutItem`, `dynamodb:Query`, `bedrock:InvokeModel`.
- `submit_answer`: `dynamodb:GetItem`, `dynamodb:UpdateItem`, `bedrock:InvokeModel`.
- `polly_speech`: `polly:SynthesizeSpeech`, `s3:PutObject`.
- `transcribe_audio`: `transcribe:StartTranscriptionJob`, `transcribe:GetTranscriptionJob`, `s3:GetObject`, `s3:PutObject`.
- `history_api`: `dynamodb:Query`, `dynamodb:GetItem`.
- `admin_api`: read access to `Users`, `CVs`, `Interviews`, plus only the update/export permissions that admin features require.

#### Deployment checklist

For each Lambda:

1. Confirm the handler file and handler name match the AWS Lambda setting.
2. Set the runtime to the version used by the code.
3. Upload the function code.
4. Attach the execution role.
5. Add environment variables.
6. Set timeout high enough for Bedrock and Transcribe polling paths.
7. Open CloudWatch Logs after the first test invocation.

#### Error handling expectation

Each Lambda should return a consistent JSON shape:

```json
{
  "success": true,
  "data": {}
}
```

For errors:

```json
{
  "success": false,
  "message": "Readable error message"
}
```

This keeps frontend services easier to debug and prevents blank pages when an API fails.
