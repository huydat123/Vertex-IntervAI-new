---
title : "Connect Frontend and Cognito Hosted UI"
date : 2024-01-01
weight : 4
chapter : false
pre : " <b> 5.4.4 </b> "
---

#### Frontend connection

The frontend reads API and Cognito settings from `frontend/.env`. After deploying API Gateway and Cognito, update the Vite variables and restart the dev server.

Important values:

- API base URL for CV, profile, interview, voice, history, and admin services.
- Cognito Hosted UI domain.
- Cognito App Client ID.
- Redirect URI.
- Logout URI.
- Scopes: `openid email profile`.

#### Login behavior

The login page should only show the Cognito sign-in action for real authentication. After the user signs in:

1. Cognito redirects back to the React app.
2. The frontend parses the authorization response.
3. Tokens are stored safely for API calls.
4. The app reads profile claims and loads/creates the user profile.
5. The header shows the user's full name instead of only the email.

#### Language and theme preferences

The project supports English and Vietnamese UI modes, plus light and black themes. Store these preferences in localStorage so they remain active when the user moves between pages.

Voice behavior should follow the selected language:

- English: English prompt text, English question audio, English speech recognition/transcription.
- Vietnamese: Vietnamese prompt text, Vietnamese-compatible voice, Vietnamese speech recognition/transcription.

#### Local frontend run

From `frontend/`, install dependencies and run the Vite dev server. The local URL should be `http://localhost:5173`, which must also exist in Cognito callback/logout URLs.

#### Static frontend deployment

For the current project phase, S3 static hosting can be used while CloudFront/WAF are postponed:

1. Build the frontend.
2. Upload the generated `dist/` files to the frontend S3 bucket.
3. Configure index document fallback to `index.html`.
4. Add the S3 website or future CloudFront URL to Cognito callback/logout URLs.
5. Add the deployed origin to API Gateway CORS settings.

When the AWS account is fully verified, add CloudFront and WAF in front of the S3 frontend for production.
