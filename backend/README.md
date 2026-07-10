# Backend Lambda source

This folder stores the AWS Lambda code used by Talent Graph AI.

## Lambda functions

| Folder | API route | Purpose |
| --- | --- | --- |
| `upload_cv` | `POST /upload_cv` | Decode a base64 CV, upload it to S3, and save metadata to DynamoDB `CVs`. |
| `analyze_cv` | `POST /analyze_cv` | Read the uploaded CV, evaluate it with Bedrock Nova Lite when available, and update `CVs`. |
| `profile_api` | `GET /profile`, `POST /profile` | Read and save user profile data in DynamoDB `Users`. |
| `create_interview` | `POST /interviews` | Create a six-question interview session and save it in DynamoDB `Interviews`. |
| `submit_answer` | `POST /interviews/answer` | Score each interview answer with Bedrock when available, fallback locally, and update `Interviews`. |
| `polly_speech` | `POST /voice/question-audio` | Use Amazon Polly to synthesize interview questions and store MP3 files in S3. |
| `transcribe_audio` | `POST /voice/transcribe` | Upload recorded answer audio to S3, start Amazon Transcribe, and return transcript text. |

## Environment variables

### `upload_cv`

```text
CVS_TABLE=CVs
STORAGE_BUCKET=talent-graph-ai-storage-huydat
```

### `analyze_cv`

```text
CVS_TABLE=CVs
BEDROCK_MODEL_ID=apac.amazon.nova-lite-v1:0
BEDROCK_REGION=ap-southeast-1
```

For better PDF extraction, deploy `analyze_cv` with the dependency in:

```text
backend/analyze_cv/requirements.txt
```

The important package is:

```text
pypdf==6.10.0
```

This repo also includes a ready-to-upload Lambda Layer zip:

```text
backend/analyze_cv/analyze_cv_pypdf_layer.zip
```

Use it in AWS Console:

1. Open Lambda -> Layers -> Create layer.
2. Name: `analyze-cv-pypdf-layer`.
3. Upload `backend/analyze_cv/analyze_cv_pypdf_layer.zip`.
4. Compatible runtimes: choose the same Python runtime as `analyze_cv`, for example Python 3.12 or Python 3.13.
5. Create the layer.
6. Open Lambda -> Functions -> `analyze_cv` -> Layers -> Add a layer.
7. Choose Custom layers -> `analyze-cv-pypdf-layer` -> latest version -> Add.
8. Open Code in `analyze_cv`, update it with `backend/analyze_cv/lambda_function.py`, then click Deploy.
9. Upload and analyze the CV again. Old analysis results saved in localStorage will not change automatically.

If you paste code directly in the Lambda console without a layer/package, the function still works, but difficult PDF layouts may extract less text.

### `profile_api`

```text
USERS_TABLE=Users
```

### `create_interview`

```text
INTERVIEWS_TABLE=Interviews
CVS_TABLE=CVs
```

### `submit_answer`

```text
INTERVIEWS_TABLE=Interviews
BEDROCK_MODEL_ID=apac.amazon.nova-lite-v1:0
BEDROCK_REGION=ap-southeast-1
```

### `polly_speech`

```text
VOICE_BUCKET=talent-graph-ai-storage-huydat
POLLY_VOICE_ID=Joanna
POLLY_ENGINE=standard
PRESIGNED_URL_EXPIRES_SECONDS=900
```

### `transcribe_audio`

```text
VOICE_BUCKET=talent-graph-ai-storage-huydat
TRANSCRIBE_LANGUAGE_CODE=en-US
TRANSCRIBE_OUTPUT_PREFIX=voice/transcripts
```

## Minimum IAM permissions

Use the exact table and bucket ARNs for your AWS account.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject"
      ],
      "Resource": "arn:aws:s3:::talent-graph-ai-storage-huydat/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket"
      ],
      "Resource": "arn:aws:s3:::talent-graph-ai-storage-huydat"
    },
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:Query"
      ],
      "Resource": [
        "arn:aws:dynamodb:ap-southeast-1:454550198437:table/CVs",
        "arn:aws:dynamodb:ap-southeast-1:454550198437:table/Users",
        "arn:aws:dynamodb:ap-southeast-1:454550198437:table/Interviews"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "polly:SynthesizeSpeech"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "transcribe:StartTranscriptionJob",
        "transcribe:GetTranscriptionJob"
      ],
      "Resource": "*"
    }
  ]
}
```

## API Gateway routes

```text
POST /upload_cv          -> upload_cv
POST /analyze_cv         -> analyze_cv
GET  /profile            -> profile_api
POST /profile            -> profile_api
POST /interviews         -> create_interview
POST /interviews/answer  -> submit_answer
POST /voice/question-audio -> polly_speech
POST /voice/transcribe     -> transcribe_audio
```

Remember to add `OPTIONS` or enable CORS for every route.
