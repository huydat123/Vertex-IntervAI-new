---
title : "Test CV Upload, Analysis, and History Data"
date : 2024-01-01
weight : 2
chapter : false
pre : " <b> 5.3.2 </b> "
---

#### Test goal

This test confirms that multiple CVs can exist for the same user without overwriting each other, and that the dashboard, upload page, and history page can read the correct selected CV/interview data.

#### Step 1: Upload more than one CV

From the frontend:

1. Sign in as a normal user.
2. Open **Upload CV**.
3. Upload the first CV and wait until metadata is saved.
4. Upload a second CV.
5. Confirm both CVs appear in the Upload CV list and Dashboard CV status section.

Expected result:

- Each uploaded CV has a unique `cvId`.
- Each S3 object uses a unique key such as `cv/{userId}/{cvId}.pdf`.
- The newest CV should not delete or overwrite the old CV.

#### Step 2: Verify DynamoDB records

In DynamoDB, open the `CVs` table and query by the test `userId`. You should see multiple records under the same partition key with different `cvId` sort keys.

Recommended fields to inspect:

- `fileName`
- `s3Key`
- `status`
- `analysis`
- `createdAt`
- `updatedAt`

#### Step 3: Analyze each CV

Select each CV from the frontend and run analysis. Confirm that:

- Analysis updates the selected CV only.
- Dashboard detail changes when another CV is selected.
- Role hints and extracted skills match the selected CV.

#### Step 4: Create an interview from the selected CV

Open **AI Interview**:

1. Select the CV-based role or choose another AI role.
2. Set question count, default 5 and minimum 2.
3. Generate questions.
4. Submit at least one answer.
5. Finish the interview and open the Result page.

Expected result:

- `Interviews` contains an item with `cvId`, `role`, `questionCount`, questions, attempts, and score.
- The displayed progress uses the selected question count, for example `0/5` or `0/3`.

#### Step 5: Verify history

Open **History** and check:

- Interview list loads from DynamoDB when the history API is enabled.
- Detail button opens the selected interview.
- Detail view shows role, score, questions, answers, feedback, and advice.

If the app falls back to localStorage, make sure the UI clearly keeps the same behavior while the DynamoDB flow is being completed.
