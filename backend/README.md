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
```

Remember to add `OPTIONS` or enable CORS for every route.
