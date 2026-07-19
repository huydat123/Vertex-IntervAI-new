---
title : "Configure API Gateway and Cognito Authorizer"
date : 2024-01-01
weight : 2
chapter : false
pre : " <b> 5.4.2 </b> "
---

#### Step 1: Create API Gateway routes

Create routes that match the frontend service files:

| Frontend service | Route group |
| --- | --- |
| `cvApi.js` | `/upload-cv`, `/analyze-cv` |
| `profileApi.js` | `/profile` |
| `interviewApi.js` | `/interviews`, `/interviews/answer` |
| `voiceApi.js` | `/voice/question-audio`, `/voice/transcribe` |
| History page | `/history` |
| Admin console | `/admin/*` |

Connect each route to its Lambda integration and deploy the API stage.

#### Step 2: Enable CORS

For local development, allow:

- Origin: `http://localhost:5173`
- Methods: `GET`, `POST`, `OPTIONS`, `DELETE` if delete routes are enabled
- Headers: `Authorization`, `Content-Type`, `X-Requested-With`

Add the deployed frontend origin later. If the browser shows no red backend error but the request still fails, check the Network tab for blocked CORS preflight requests.

#### Step 3: Create Cognito JWT authorizer

Use the Cognito User Pool as the identity provider:

- Issuer URL: `https://cognito-idp.{region}.amazonaws.com/{userPoolId}`
- Audience: the Cognito App Client ID
- Identity source: `Authorization` header

Attach the authorizer to protected routes. Public routes should be avoided except for health checks or documentation.

#### Step 4: Pass user identity to Lambda

Inside Lambda, read claims from the API Gateway authorizer context. The important values are:

- `sub` as the stable `userId`
- `email`
- `name` or `given_name`/`family_name` for full name
- `phone_number`
- `picture` if avatar URL is configured
- `cognito:groups` for `user` or `admin`

Use `sub` as the primary identity instead of email, because email can change.

#### Step 5: Enforce admin role

The frontend can hide admin pages, but backend must also enforce admin access. For admin routes:

1. Read `cognito:groups` from JWT claims.
2. Confirm the group contains `admin`.
3. Return `403` if the user is not an admin.

This protects `admin_api` even if a normal user manually calls the endpoint.
