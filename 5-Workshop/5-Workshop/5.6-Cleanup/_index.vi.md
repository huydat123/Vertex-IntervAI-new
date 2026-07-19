---
title : "Dọn dẹp tài nguyên"
date : 2024-01-01
weight : 6
chapter : false
pre : " <b> 5.6. </b> "
---

#### Trước khi xóa tài nguyên

Chỉ dọn dẹp lab resources khi bạn không cần môi trường demo nữa. Nếu dữ liệu thuộc user thật, hãy export hoặc backup trước.

#### Thứ tự dọn dẹp

1. Disable hoặc delete API Gateway stages và routes.
2. Delete Lambda functions sau khi chắc chắn frontend production không còn dùng.
3. Empty S3 buckets, sau đó delete buckets nếu chỉ dùng cho lab.
4. Delete DynamoDB tables nếu dữ liệu không cần giữ.
5. Delete Cognito test users, groups, app client, domain và user pool nếu đây không phải production pool.
6. Delete CloudWatch log groups do Lambda tạo nếu không cần giữ logs.
7. Remove SES test identities nếu không dùng ở nơi khác.
8. Xóa local `.env` values chứa endpoint hoặc ID của môi trường đã xóa.
9. Clear browser localStorage nếu muốn xóa dữ liệu fallback local.

#### Nên giữ lại cho phát triển tiếp

Với môi trường còn phát triển tiếp, nên giữ:

- Source code trong `frontend/` và `backend/`.
- Documentation trong `2-Proposal/` và `5-Workshop/`.
- Architecture diagrams và screenshots.
- File `.env.example` đã được làm sạch.
- Ghi chú tên AWS resources và region đang dùng.

#### Kiểm tra cuối

Sau khi cleanup, mở AWS console và kiểm tra không còn chi phí bất thường từ:

- Bedrock model usage.
- Transcribe jobs.
- Polly requests.
- S3 storage.
- DynamoDB tables.
- API Gateway stages.
- Lambda invocations.
- CloudWatch Logs storage.
