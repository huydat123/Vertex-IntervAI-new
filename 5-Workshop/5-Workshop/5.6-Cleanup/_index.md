---
title : "Clean Up"
date : 2024-01-01
weight : 6
chapter : false
pre : " <b> 5.6. </b> "
---

#### Before deleting resources

Only clean up lab resources when you no longer need the demo environment. If the data belongs to real users, export or back it up first.

#### Clean up order

1. Disable or delete API Gateway stages and routes.
2. Delete Lambda functions after confirming no production frontend uses them.
3. Empty S3 buckets, then delete the buckets if they are lab-only.
4. Delete DynamoDB tables if the data is not needed.
5. Delete Cognito test users, groups, app client, domain, and user pool if this is not the production pool.
6. Delete CloudWatch log groups created by the Lambdas if you no longer need logs.
7. Remove SES test identities only if they are not used elsewhere.
8. Remove local `.env` values that contain deployment-specific endpoints or IDs.
9. Clear browser localStorage if you want to remove local fallback data.

#### Keep for future development

For ongoing development, keep:

- Source code in `frontend/` and `backend/`.
- Documentation in `2-Proposal/` and `5-Workshop/`.
- Architecture diagrams and screenshots.
- A sanitized `.env.example`.
- Notes about AWS resource names and regions.

#### Final validation

After cleanup, open the AWS console and confirm there are no unexpected charges from:

- Bedrock model usage.
- Transcribe jobs.
- Polly requests.
- S3 storage.
- DynamoDB tables.
- API Gateway stages.
- Lambda invocations.
- CloudWatch Logs storage.
