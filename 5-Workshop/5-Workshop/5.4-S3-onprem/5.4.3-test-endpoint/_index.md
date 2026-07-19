---
title : "Test API Endpoints"
date : 2024-01-01
weight : 3
chapter : false
pre : " <b> 5.4.3 </b> "
---

#### Test order

Test the APIs in the same order as the user journey. This makes it easier to find the exact broken dependency.

#### 1. Authentication

- Sign in through Cognito Hosted UI.
- Confirm the frontend receives tokens after redirect.
- Confirm the request header contains `Authorization: Bearer <token>`.
- Decode the ID token and verify `sub`, `email`, and `cognito:groups`.

#### 2. Profile API

Test:

- `GET /profile`
- `POST /profile`

Expected result:

- The user profile is stored in `Users`.
- Full name, email, phone, and avatar fields can be shown beside the user avatar in the app.

#### 3. CV APIs

Test:

- `POST /upload-cv`
- `POST /analyze-cv`

Expected result:

- S3 contains the uploaded CV object.
- `CVs` contains one item per CV.
- Uploading two CVs creates two `cvId` values instead of replacing the old record.
- CV analysis updates the correct selected CV.

#### 4. Interview APIs

Test:

- `POST /interviews`
- `POST /interviews/answer`

Expected result:

- Generated questions match the selected role.
- Question count matches the value selected in AI Interview or Settings.
- Answers are saved as attempts.
- Final score is calculated after the interview is completed.

#### 5. Voice APIs

Test:

- `POST /voice/question-audio`
- `POST /voice/transcribe`

Expected result:

- English uses an English Polly/Transcribe language configuration.
- Vietnamese uses a Vietnamese-compatible voice/transcription language code or a browser speech fallback if AWS voice quality is not acceptable.
- Generated audio and transcript files are stored under the voice prefixes.

#### 6. History and result

Test:

- `GET /history`
- History detail view
- Result page after finishing interview

Expected result:

- The history list shows completed interviews.
- Detail view shows role, score, questions, answers, feedback, and advice.
- The result page does not show `NaN`, empty score, or stale localStorage data.

#### 7. Admin console

Sign in with a user in the `admin` group and test:

- Users list
- CV list
- Interviews list
- Review queue
- Audit log
- CSV export
- Feedback email workflow

Then sign in as a normal user and confirm admin routes return `403`.

#### Common errors

| Symptom | Likely cause |
| --- | --- |
| `401 Unauthorized` | Missing/expired token or wrong authorizer audience |
| `403 Forbidden` | User is not in the required Cognito group |
| Browser request blocked | CORS origin/header/method mismatch |
| Lambda `500` | Missing environment variable or IAM permission |
| Bedrock error | Model access not enabled or wrong region |
| Transcribe error | Audio format, S3 permission, or language code mismatch |
