---
title : "Create S3 Buckets and DynamoDB Tables"
date : 2024-01-01
weight : 1
chapter : false
pre : " <b> 5.3.1 </b> "
---

#### Step 1: Choose the AWS Region

Use one primary region for the first deployment. Keep Lambda, API Gateway, S3, DynamoDB, Cognito, Polly, Transcribe, and Bedrock configuration consistent. If the Bedrock model is only available in a different region, set `BEDROCK_REGION` explicitly for the Lambda functions that invoke Bedrock.

#### Step 2: Create S3 storage

Create one or two S3 buckets:

- `CV_BUCKET` for uploaded CV files.
- `AUDIO_BUCKET` for question audio, answer audio, and transcripts.

For a small demo, both can point to the same bucket if prefixes are separated clearly.

Recommended prefixes:

```text
cv/{userId}/{cvId}.{extension}
voice/question/{userId}/{interviewId}/{questionId}.mp3
voice/answer/{userId}/{interviewId}/{questionId}.webm
voice/transcript/{userId}/{interviewId}/{questionId}.json
```

Enable default encryption and block public access. The frontend should never upload directly to S3 unless you add a signed URL flow. In the current project, the frontend sends the base64 CV to `upload_cv`, and Lambda writes the object to S3.

#### Step 3: Configure S3 CORS if direct browser access is needed

If the frontend needs to fetch generated audio directly from S3, add a CORS rule similar to:

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

Add the deployed frontend origin later when production hosting is ready.

#### Step 4: Create DynamoDB tables

Create the tables below with on-demand capacity for easier demo usage:

| Table | Partition key | Sort key |
| --- | --- | --- |
| `Users` | `userId` string | none |
| `CVs` | `userId` string | `cvId` string |
| `Interviews` | `userId` string | `interviewId` string |

Important attributes:

- `Users`: `email`, `fullName`, `phone`, `avatarUrl`, `role`, `createdAt`, `updatedAt`.
- `CVs`: `cvId`, `fileName`, `fileType`, `s3Key`, `status`, `analysis`, `createdAt`, `updatedAt`.
- `Interviews`: `interviewId`, `cvId`, `role`, `questionCount`, `questions`, `answers`, `attempts`, `score`, `feedback`, `createdAt`, `updatedAt`.

#### Step 5: Save names for Lambda environment variables

After creating the resources, record:

- CV bucket name.
- Audio bucket name.
- DynamoDB table names.
- AWS region.

Use these values in the backend Lambda environment variables in the next section.
