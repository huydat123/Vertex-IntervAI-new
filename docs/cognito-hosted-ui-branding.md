# Cognito Hosted UI Branding

Tài liệu này dùng để chỉnh giao diện 2 trang Cognito trong ảnh:

- `Sign in` với ô `Email address`
- `Enter your password`

Hai trang này do Amazon Cognito render, không nằm trong React app. Vì vậy không sửa được bằng `frontend/src/pages/Login/Login.css`. Cần chỉnh trong AWS Cognito.

## Chọn đúng hướng cho 2 trang trong ảnh

Ảnh của bạn đang là **Managed Login** mới của Cognito. Với loại này, mình đã chuẩn bị sẵn bộ ảnh branding trong repo, còn phần màu, nền, nút, input, khoảng cách sẽ cấu hình bằng **Branding Editor** trong AWS Console.

Nếu bạn muốn trang Cognito có form **email + password chung một màn hình** giống kiểu login truyền thống, có 2 hướng:

1. Dùng **Hosted UI (classic)** và upload CSS trong file này. Cách này vẫn là trang Cognito, nhưng giao diện và flow sẽ khác Managed Login.
2. Tự làm form login/register trong React rồi gọi Cognito API. Cách này sửa được mọi bố cục, nhưng không còn dùng Hosted UI mặc định.

Với đồ án hiện tại, mình khuyên dùng **Managed Login** trước vì ổn định, dễ trình bày AWS, có branding editor và hỗ trợ flow Cognito đầy đủ.

## Cách 1: Managed Login Branding Editor

Dùng cách này nếu domain Cognito của bạn đang để `Branding version = Managed login`.

Vào AWS Console:

1. Mở **Amazon Cognito**.
2. Chọn **User pools**.
3. Chọn user pool của dự án.
4. Vào **Managed login**.
5. Trong **Styles**, chọn style đang gắn với app client.
6. Bấm **Edit in branding editor**. Ở một số giao diện AWS cũ, nút này có thể ghi là **Launch branding editor**.
7. Dùng tab **Preview** để xem lần lượt trang `Sign in` và `Enter your password`.

Thiết lập gợi ý:

| Khu vực | Giá trị đề xuất |
| --- | --- |
| Display mode | Light mode only |
| Page background | Upload `frontend/src/assets/cognito-branding/cognito-background-vertex-intervai.jpg` |
| Page background color | `#050816` |
| Page text color | `#0f172a` |
| Form container background | `#f8fafc` |
| Form container border | `#bae6fd` |
| Form container radius | 20px |
| Form container shadow | mạnh hơn mặc định |
| Form width | khoảng 500px đến 540px |
| Input background | `#ffffff` |
| Input border | `#94a3b8` |
| Input focus color | `#06b6d4` |
| Primary button background | `#0f172a` |
| Primary button text | `#ffffff` |
| Primary button hover | `#0891b2` |
| Link color | `#0284c7` |
| Logo | Upload `frontend/src/assets/cognito-branding/cognito-logo-dark-neon.png` |
| Favicon | Upload `frontend/src/assets/cognito-branding/cognito-mark-dark-neon.png` |

Thiết lập nên dùng cho đúng style dự án:

- Bật background image `cognito-background-vertex-intervai.jpg` để trang hợp với AI interview, CV analysis và talent graph.
- Xem trước bố cục bằng file `frontend/src/assets/cognito-branding/cognito-managed-login-preview-vertex-intervai.png`.
- Đặt form ở giữa hoặc hơi lệch phải, width khoảng `520px`.
- Dùng logo `Vertex-IntervAI` trong form.
- Dùng form nền trắng hoặc gần trắng để chữ Cognito mặc định không bị chìm.
- Dùng radius `20px` cho form, `12px` đến `14px` cho input và button.
- Đặt primary button màu đen/xanh đậm `#0f172a`, hover xanh `#0891b2`.
- Nếu có header/footer, dùng ảnh `cognito-header-dark-neon.png` và `cognito-footer-dark-neon.png`; nếu thấy rối thì tắt header/footer và chỉ dùng logo trong form.

Nếu bạn muốn dùng lại nền neon cũ, file nằm ở `frontend/src/assets/cognito-branding/cognito-background-dark-neon.png`.

Không nên dùng **Dark mode only** cho form hiện tại, vì Cognito Managed Login có một số chữ mặc định dễ bị đen trên nền tối. Cách đẹp và an toàn nhất là nền trang tối, form sáng.

Managed Login không cho sửa HTML/DOM của form. Bạn có thể đổi màu, logo, background, khoảng cách, border, nút, input, header/footer, nhưng không thể tự ý gộp hoặc đổi cấu trúc các bước `Email -> Password` bằng React.

## Cách 2: Hosted UI Classic CSS

Dùng cách này nếu bạn đổi domain sang `Branding version = Hosted UI (classic)`. Classic UI cho upload CSS nhưng giao diện và flow sẽ khác Managed Login. Đây là hướng phù hợp hơn nếu bạn muốn Cognito hiển thị kiểu form truyền thống với username/email và password cùng một màn hình.

File CSS đã chuẩn bị:

```text
frontend/src/assets/cognito-branding/cognito-hosted-ui-classic.css
```

Vào AWS Console:

1. Mở **Amazon Cognito**.
2. Chọn **User pools**.
3. Vào **Domain**.
4. Đổi **Branding version** sang **Hosted UI (classic)**.
5. Vào **Managed login**.
6. Trong **Hosted UI settings**, chọn **Edit** hoặc **Override** cho app client.
7. Upload logo:

```text
frontend/src/assets/cognito-branding/cognito-logo-dark-neon.png
```

8. Upload CSS:

```text
frontend/src/assets/cognito-branding/cognito-hosted-ui-classic.css
```

AWS có thể mất khoảng một phút để trang Hosted UI cập nhật.

Sau khi upload xong, mở lại login bằng tab ẩn danh hoặc hard refresh để tránh trình duyệt giữ cache giao diện cũ.

## AWS CLI Classic

Nếu dùng classic và muốn áp bằng CLI:

```powershell
aws cognito-idp set-ui-customization `
  --user-pool-id YOUR_USER_POOL_ID `
  --client-id 75grv32mht5gvgjhognfrp7jsk `
  --image-file fileb://frontend/src/assets/cognito-branding/cognito-logo-dark-neon.png `
  --css file://frontend/src/assets/cognito-branding/cognito-hosted-ui-classic.css
```

Thay `YOUR_USER_POOL_ID` bằng User pool ID thật, ví dụ dạng `ap-southeast-1_xxxxxxxx`.

## Lưu ý về giới hạn AWS

- Managed Login dùng Branding Editor, không upload CSS tự do như classic.
- Classic Hosted UI cho CSS nhưng chỉ hỗ trợ một danh sách class cố định.
- Classic CSS + logo request bị giới hạn kích thước. Logo nên dưới 100 KB và CSS nên nhỏ.
- Text trên Managed Login không đổi bằng Branding Editor; nếu muốn đổi ngôn ngữ, Cognito dùng tham số `lang` trên URL.

## Tài liệu AWS

- [Apply branding to managed login pages](https://docs.aws.amazon.com/cognito/latest/developerguide/managed-login-branding.html)
- [Branding editor and customizing managed login](https://docs.aws.amazon.com/cognito/latest/developerguide/managed-login-brandingeditor.html)
- [Customizing hosted UI classic branding](https://docs.aws.amazon.com/cognito/latest/developerguide/hosted-ui-classic-branding.html)
