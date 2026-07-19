---
title : "Kết nối Frontend và Cognito Hosted UI"
date : 2024-01-01
weight : 4
chapter : false
pre : " <b> 5.4.4 </b> "
---

#### Kết nối frontend

Frontend đọc API và Cognito settings từ `frontend/.env`. Sau khi deploy API Gateway và Cognito, cập nhật các biến Vite rồi restart dev server.

Các giá trị quan trọng:

- API base URL cho CV, profile, interview, voice, history và admin services.
- Cognito Hosted UI domain.
- Cognito App Client ID.
- Redirect URI.
- Logout URI.
- Scopes: `openid email profile`.

#### Hành vi đăng nhập

Trang login nên chỉ hiển thị hành động đăng nhập Cognito cho real authentication. Sau khi user đăng nhập:

1. Cognito redirect về React app.
2. Frontend xử lý authorization response.
3. Token được lưu để gọi API.
4. App đọc profile claims và load/tạo user profile.
5. Header hiển thị fullname thay vì chỉ hiển thị email.

#### Tuỳ chọn ngôn ngữ và giao diện

Dự án hỗ trợ English/Vietnamese UI và light/black theme. Nên lưu các tùy chọn này vào localStorage để không bị tắt khi user chuyển trang.

Voice behavior cần đi theo ngôn ngữ đã chọn:

- English: prompt text tiếng Anh, audio câu hỏi tiếng Anh, speech recognition/transcription tiếng Anh.
- Vietnamese: prompt text tiếng Việt, voice phù hợp tiếng Việt, speech recognition/transcription tiếng Việt.

#### Chạy frontend local

Trong `frontend/`, cài dependencies và chạy Vite dev server. URL local là `http://localhost:5173`, URL này phải tồn tại trong Cognito callback/logout URLs.

#### Deploy frontend static

Ở giai đoạn hiện tại, có thể dùng S3 static hosting trong lúc CloudFront/WAF đang tạm hoãn:

1. Build frontend.
2. Upload các file trong `dist/` lên frontend S3 bucket.
3. Cấu hình index document fallback về `index.html`.
4. Thêm S3 website URL hoặc CloudFront URL sau này vào Cognito callback/logout URLs.
5. Thêm deployed origin vào API Gateway CORS settings.

Khi AWS account đã verified đầy đủ, đặt CloudFront và WAF trước S3 frontend để dùng production.
