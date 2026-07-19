---
title : "Cấu hình API Gateway và Cognito Authorizer"
date : 2024-01-01
weight : 2
chapter : false
pre : " <b> 5.4.2 </b> "
---

#### Bước 1: Tạo API Gateway routes

Tạo routes khớp với các frontend service files:

| Frontend service | Route group |
| --- | --- |
| `cvApi.js` | `/upload-cv`, `/analyze-cv` |
| `profileApi.js` | `/profile` |
| `interviewApi.js` | `/interviews`, `/interviews/answer` |
| `voiceApi.js` | `/voice/question-audio`, `/voice/transcribe` |
| History page | `/history` |
| Admin console | `/admin/*` |

Kết nối từng route với Lambda integration tương ứng và deploy API stage.

#### Bước 2: Bật CORS

Với local development, cho phép:

- Origin: `http://localhost:5173`
- Methods: `GET`, `POST`, `OPTIONS`, `DELETE` nếu đã bật route xóa
- Headers: `Authorization`, `Content-Type`, `X-Requested-With`

Khi deploy frontend thật, thêm production origin sau. Nếu browser không hiện lỗi đỏ rõ ràng nhưng request vẫn không chạy, kiểm tra Network tab để xem preflight CORS có bị block không.

#### Bước 3: Tạo Cognito JWT authorizer

Dùng Cognito User Pool làm identity provider:

- Issuer URL: `https://cognito-idp.{region}.amazonaws.com/{userPoolId}`
- Audience: Cognito App Client ID
- Identity source: `Authorization` header

Gắn authorizer vào các protected routes. Public route chỉ nên dùng cho health check hoặc documentation.

#### Bước 4: Truyền user identity vào Lambda

Trong Lambda, đọc claims từ API Gateway authorizer context. Các giá trị quan trọng:

- `sub` làm `userId` ổn định.
- `email`.
- `name` hoặc `given_name`/`family_name` cho fullname.
- `phone_number`.
- `picture` nếu có cấu hình avatar URL.
- `cognito:groups` để biết `user` hoặc `admin`.

Nên dùng `sub` làm định danh chính thay vì email, vì email có thể thay đổi.

#### Bước 5: Enforce admin role

Frontend có thể ẩn admin page, nhưng backend vẫn phải kiểm tra quyền admin. Với admin routes:

1. Đọc `cognito:groups` từ JWT claims.
2. Kiểm tra group có `admin`.
3. Trả `403` nếu user không phải admin.

Cách này bảo vệ `admin_api` kể cả khi user thường tự gọi endpoint.
