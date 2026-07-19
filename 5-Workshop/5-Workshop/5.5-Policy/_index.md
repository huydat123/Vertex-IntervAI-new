---
title : "Security, Roles, and Observability"
date : 2024-01-01
weight : 5
chapter : false
pre : " <b> 5.5. </b> "
---

#### Cognito roles

Create two Cognito groups:

- `user`: normal candidate access.
- `admin`: admin console access.

The frontend should use the group claim to show or hide admin navigation. The backend must also verify `cognito:groups` before serving admin operations.

#### Authorization rules

Use these baseline rules:

| Area | Required user |
| --- | --- |
| Profile | Signed-in user can read/update only their own profile |
| CV upload/analyze/delete | Signed-in user can manage only their own CVs |
| Interview create/answer/history | Signed-in user can manage only their own interviews |
| Admin users/CVs/interviews | `admin` group only |
| CSV export | `admin` group only |
| Feedback email | `admin` group only |

Do not trust `userId` sent from the browser. Derive it from Cognito token claim `sub`.

#### IAM least privilege

Keep IAM policies narrow:

- Limit S3 access to the project bucket and required prefixes.
- Limit DynamoDB access to the tables each Lambda needs.
- Allow `bedrock:InvokeModel` only for the chosen model/resource pattern.
- Allow Polly only on `polly:SynthesizeSpeech`.
- Allow Transcribe only for required job actions.
- Give `admin_api` only the permissions required by the admin console.

#### CORS security

During local development, allow `http://localhost:5173`. In production, replace or add the final frontend origin. Avoid `*` with authorization headers in production.

#### Audit and logs

Use CloudWatch Logs for every Lambda. Log useful operational metadata, but do not log sensitive data such as full CV text, raw tokens, or private user information.

Recommended audit events:

- User profile updated.
- CV uploaded, analyzed, or deleted.
- Interview created or completed.
- Admin viewed/exported data.
- Feedback email requested.

#### SES sandbox note

Amazon SES starts in sandbox mode in many accounts. While in sandbox, emails can only be sent to verified addresses. To send feedback to any candidate email, request SES production access and explain the use case, bounce handling, complaint handling, and expected sending volume.

#### Production hardening

Before production:

- Enable JWT authorizer on all protected routes.
- Verify admin enforcement in Lambda.
- Add WAF when CloudFront is available.
- Add AWS Budgets alerts.
- Set CloudWatch log retention.
- Review S3 public access settings.
- Test English and Vietnamese voice flows.
- Back up important DynamoDB data before major schema changes.
