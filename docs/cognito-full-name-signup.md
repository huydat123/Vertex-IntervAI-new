# Cognito Full Name Khi Đăng Ký

Nếu bạn muốn người dùng nhập `Full name` ngay lúc đăng ký Cognito:

## Trường nên dùng

- Standard attribute: `name`
- Tùy chọn thêm: `given_name`, `family_name`
- Nếu muốn tự lưu thêm dữ liệu riêng: dùng custom attribute
- App client nên có quyền đọc/ghi `name`, `email`, `phone_number`, `picture` nếu bạn muốn token và Profile nhận đủ dữ liệu

## Cách làm nếu tạo user pool mới

1. Mở **Amazon Cognito**.
2. Vào **User pools**.
3. Tạo user pool mới.
4. Trong phần **Sign-up** hoặc **Attributes**, bật `name`.
5. Nếu muốn bắt buộc nhập, chọn `name` là required attribute.
6. Ở **App client** hoặc **Managed login**, bảo đảm client có quyền đọc/ghi `name`.

## Cách làm nếu user pool đã tạo rồi

- Nếu `name` chưa được đặt là required ngay từ đầu, AWS thường không cho đổi required attribute sau này.
- Khi đó có 2 hướng:
  1. Tạo user pool mới với `name` là required.
  2. Để user đăng ký xong rồi nhập Full name trong trang Profile của app.

## Gợi ý cho dự án này

- Đăng ký Cognito chỉ cần email/password.
- Full name để trống ở Profile.
- Người dùng tự điền sau khi đăng nhập.
- Ứng dụng sẽ lấy `name` từ token nếu Cognito có trả về.
