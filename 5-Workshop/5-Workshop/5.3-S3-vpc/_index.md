---
title : "Data Layer: S3 and DynamoDB"
date : 2024-01-01
weight : 3
chapter : false
pre : " <b> 5.3. </b> "
---

#### Data layer overview

Vertex-IntervAI separates file storage from structured application data:

- **Amazon S3** stores uploaded CV files and voice artifacts.
- **Amazon DynamoDB** stores users, CV metadata, interview records, answers, attempts, scores, and history.

This approach keeps the application simple and serverless. Lambda functions read or write small metadata records in DynamoDB and store larger binary files in S3.

#### S3 object layout

Use predictable prefixes so data is easy to inspect and clean up:

| Data type | Example key |
| --- | --- |
| Uploaded CV | `cv/{userId}/{cvId}.{extension}` |
| Question audio | `voice/question/{userId}/{interviewId}/{questionId}.mp3` |
| Answer audio | `voice/answer/{userId}/{interviewId}/{questionId}.webm` |
| Transcript | `voice/transcript/{userId}/{interviewId}/{questionId}.json` |

#### DynamoDB tables

| Table | Partition key | Sort key | Purpose |
| --- | --- | --- | --- |
| `Users` | `userId` | none | User profile, role, email, full name, phone, avatar metadata |
| `CVs` | `userId` | `cvId` | CV metadata, S3 key, analysis result, selected role hints |
| `Interviews` | `userId` | `interviewId` | Interview questions, answers, attempts, scores, final result, feedback |

#### In this section

1. [Create S3 buckets and DynamoDB tables](5.3.1-create-gwe/)
2. [Test CV upload, analysis, and history data](5.3.2-test-gwe/)
