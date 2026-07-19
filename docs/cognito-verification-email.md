# Cognito Verification Email Template

File HTML:

```text
docs/cognito-verification-email-template.html
```

Template này dùng cho email xác nhận tài khoản Cognito. Phần quan trọng nhất là placeholder:

```text
{####}
```

Cognito sẽ tự thay `{####}` bằng mã xác nhận thật.

## Cấu hình trong AWS Console

1. Mở **Amazon Cognito**.
2. Vào **User pools**.
3. Chọn user pool của dự án.
4. Ở menu trái, chọn **Branding** > **Message templates**.
5. Chọn **Verification message**.
6. Bấm **Edit**.
7. Chọn **Verification type** là **Code**.
8. Đặt subject:

```text
Your Vertex-IntervAI verification code
```

9. Ở phần email message, chuyển sang HTML nếu có lựa chọn.
10. Paste toàn bộ nội dung trong `docs/cognito-verification-email-template.html`.
11. Bấm **Save changes**.
12. Đăng ký tài khoản mới hoặc bấm gửi lại code để test email.

## Lưu ý

- Không xóa `{####}`.
- Email template của Cognito hỗ trợ HTML, nhưng nên dùng inline CSS để Gmail hiển thị ổn.
- Nếu muốn đổi email sender từ `no-reply@verificationemail.com` sang domain riêng, bạn cần cấu hình Amazon SES cho Cognito.
- Nếu muốn logic email động hơn nữa, dùng **Custom message Lambda trigger**.
