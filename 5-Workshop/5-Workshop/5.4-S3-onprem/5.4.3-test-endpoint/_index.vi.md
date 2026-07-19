---
title : "Test API Endpoints"
date : 2024-01-01
weight : 3
chapter : false
pre : " <b> 5.4.3 </b> "
---

#### Thứ tự test

Nên test API theo đúng luồng người dùng. Như vậy dễ biết lỗi đang nằm ở bước nào.

#### 1. Authentication

- Đăng nhập qua Cognito Hosted UI.
- Kiểm tra frontend nhận token sau khi redirect.
- Kiểm tra request header có `Authorization: Bearer <token>`.
- Decode ID token và kiểm tra `sub`, `email`, `cognito:groups`.

#### 2. Profile API

Test:

- `GET /profile`
- `POST /profile`

Kết quả mong đợi:

- Profile được lưu trong bảng `Users`.
- Fullname, email, phone và avatar hiển thị được cạnh user trong app.

#### 3. CV APIs

Test:

- `POST /upload-cv`
- `POST /analyze-cv`

Kết quả mong đợi:

- S3 có object CV đã upload.
- `CVs` có một item cho mỗi CV.
- Upload hai CV tạo hai `cvId`, không ghi đè record cũ.
- Analysis cập nhật đúng CV đang chọn.

#### 4. Interview APIs

Test:

- `POST /interviews`
- `POST /interviews/answer`

Kết quả mong đợi:

- Câu hỏi được tạo đúng theo role đã chọn.
- Số câu hỏi khớp giá trị chọn trong AI Interview hoặc Settings.
- Câu trả lời được lưu vào attempts.
- Final score được tính sau khi hoàn thành interview.

#### 5. Voice APIs

Test:

- `POST /voice/question-audio`
- `POST /voice/transcribe`

Kết quả mong đợi:

- Tiếng Anh dùng cấu hình Polly/Transcribe tiếng Anh.
- Tiếng Việt dùng voice/language code phù hợp hoặc browser speech fallback nếu voice AWS đọc tiếng Việt chưa ổn.
- Audio và transcript được lưu đúng voice prefixes.

#### 6. History và result

Test:

- `GET /history`
- History detail view
- Result page sau khi hoàn thành interview

Kết quả mong đợi:

- History list hiển thị các interview đã hoàn thành.
- Detail view hiển thị role, score, questions, answers, feedback và advice.
- Result page không hiển thị `NaN`, score rỗng hoặc dữ liệu localStorage cũ.

#### 7. Admin console

Đăng nhập bằng user thuộc group `admin` và test:

- Users list
- CV list
- Interviews list
- Review queue
- Audit log
- CSV export
- Feedback email workflow

Sau đó đăng nhập bằng user thường và kiểm tra admin routes trả `403`.

#### Lỗi thường gặp

| Hiện tượng | Nguyên nhân có thể |
| --- | --- |
| `401 Unauthorized` | Thiếu/hết hạn token hoặc sai authorizer audience |
| `403 Forbidden` | User không thuộc Cognito group cần thiết |
| Browser request bị block | Sai CORS origin/header/method |
| Lambda `500` | Thiếu environment variable hoặc IAM permission |
| Bedrock error | Chưa bật model access hoặc sai region |
| Transcribe error | Sai audio format, S3 permission hoặc language code |
