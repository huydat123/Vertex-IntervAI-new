---
title : "Prerequisites"
date : 2024-01-01
weight : 2
chapter : false
pre : " <b> 5.2. </b> "
---

#### AWS account requirements

Before starting, make sure your AWS account can use the following services:

- AWS Lambda
- Amazon API Gateway
- Amazon S3
- Amazon DynamoDB
- Amazon Cognito
- Amazon Bedrock with access to the selected Nova Lite model
- Amazon Polly
- Amazon Transcribe
- Amazon CloudWatch Logs
- AWS IAM
- Amazon SES if you want feedback email

CloudFront and WAF are recommended for the production frontend, but they are postponed in this project until the AWS account verification issue is resolved.

#### IAM permissions for deployment

The deployment user should be allowed to manage:

- Lambda functions, environment variables, and execution roles.
- API Gateway routes, stages, CORS, and JWT authorizers.
- S3 buckets, objects, and bucket CORS.
- DynamoDB tables and item access.
- Cognito User Pool, App Client, Hosted UI domain, groups, and users.
- Bedrock model invocation.
- Polly speech synthesis and Transcribe jobs.
- CloudWatch log groups and log streams.
- IAM PassRole for Lambda execution roles.

#### Local development tools

Install and configure:

- Node.js and npm for the React + Vite frontend.
- AWS CLI with credentials for the target account and region.
- Python 3.12 or the Lambda runtime version used by the backend functions.
- A modern browser for Cognito Hosted UI and camera/microphone testing.

#### Frontend environment variables

Create or update `frontend/.env` based on `frontend/.env.example`:

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

For local testing, Cognito callback and logout URLs must include `http://localhost:5173`. Add the deployed frontend URL later when S3/CloudFront hosting is ready.

#### Backend environment variables

Each Lambda should receive only the values it needs. Common variables include:

```bash
CV_BUCKET=your-cv-bucket
AUDIO_BUCKET=your-audio-bucket
CVS_TABLE=CVs
USERS_TABLE=Users
INTERVIEWS_TABLE=Interviews
BEDROCK_MODEL_ID=amazon.nova-lite-v1:0
BEDROCK_REGION=your-bedrock-region
```

#### Cognito setup checklist

- Create a User Pool.
- Add sign-up attributes for full name, email, phone number, and optionally profile picture.
- Create an App Client for the React app.
- Configure Hosted UI domain.
- Add callback URL and logout URL.
- Enable scopes `openid`, `email`, and `profile`.
- Create groups `user` and `admin`.
- Add test users to the correct group.
- Verify the ID token contains user identity and group claims.
