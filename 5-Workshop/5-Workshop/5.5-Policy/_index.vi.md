---
title : "Security, Roles và Observability"
date : 2024-01-01
weight : 5
chapter : false
pre : " <b> 5.5 </b> "
---

#### Cognito roles

Tạo hai Cognito groups:

- `user`: quyền candidate bình thường.
- `admin`: quyền truy cập admin console.

Frontend dùng group claim để hiện/ẩn admin navigation. Backend vẫn phải kiểm tra `cognito:groups` trước khi trả dữ liệu admin.

#### Authorization rules

Quy tắc cơ bản:

| Khu vực | Quyền cần có |
| --- | --- |
| Profile | User đã đăng nhập chỉ đọc/cập nhật profile của chính mình |
| CV upload/analyze/delete | User đã đăng nhập chỉ quản lý CV của chính mình |
| Interview create/answer/history | User đã đăng nhập chỉ quản lý interview của chính mình |
| Admin users/CVs/interviews | Chỉ group `admin` |
| CSV export | Chỉ group `admin` |
| Feedback email | Chỉ group `admin` |

Không nên tin `userId` gửi từ browser. Hãy lấy `userId` từ Cognito token claim `sub`.

#### IAM least privilege

Giữ IAM policy hẹp:

- Giới hạn S3 access trong project bucket và prefix cần thiết.
- Giới hạn DynamoDB access theo đúng table mỗi Lambda cần.
- Cho phép `bedrock:InvokeModel` theo model/resource pattern đã chọn.
- Polly chỉ cần `polly:SynthesizeSpeech`.
- Transcribe chỉ cần các job actions cần thiết.
- `admin_api` chỉ có quyền đúng với chức năng admin console.

#### CORS security

Trong local development, cho phép `http://localhost:5173`. Khi production, thêm hoặc thay bằng frontend origin thật. Không nên dùng `*` chung với authorization headers trong production.

#### Audit và logs

Dùng CloudWatch Logs cho mọi Lambda. Chỉ log metadata cần debug/vận hành, không log dữ liệu nhạy cảm như toàn bộ CV text, raw token hoặc thông tin riêng tư không cần thiết.

Audit events nên có:

- User cập nhật profile.
- CV được upload, analyzed hoặc deleted.
- Interview được tạo hoặc hoàn thành.
- Admin xem/export dữ liệu.
- Feedback email được yêu cầu gửi.

#### Lưu ý SES sandbox

Amazon SES thường bắt đầu ở sandbox mode. Khi còn sandbox, email chỉ gửi được đến địa chỉ đã verify. Muốn gửi feedback đến mọi candidate email, cần xin SES production access và mô tả use case, cách xử lý bounce/complaint và volume dự kiến.

#### Production hardening

Trước khi production:

- Bật JWT authorizer cho mọi protected routes.
- Kiểm tra admin enforcement trong Lambda.
- Thêm WAF khi CloudFront dùng được.
- Tạo AWS Budgets alerts.
- Đặt CloudWatch log retention.
- Kiểm tra S3 public access settings.
- Test voice flow tiếng Anh và tiếng Việt.
- Backup DynamoDB data quan trọng trước khi đổi schema lớn.
