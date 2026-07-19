---
title : "Test Upload CV, Phân tích và History Data"
date : 2024-01-01
weight : 2
chapter : false
pre : " <b> 5.3.2 </b> "
---

#### Mục tiêu test

Bài test này kiểm tra việc một user có thể có nhiều CV mà không bị ghi đè, đồng thời dashboard, upload page và history page đọc đúng dữ liệu của CV/interview đang được chọn.

#### Bước 1: Upload nhiều hơn một CV

Từ frontend:

1. Đăng nhập bằng user thường.
2. Mở **Upload CV**.
3. Upload CV thứ nhất và chờ metadata được lưu.
4. Upload CV thứ hai.
5. Kiểm tra cả hai CV đều xuất hiện trong Upload CV list và Dashboard CV status.

Kết quả mong đợi:

- Mỗi CV có `cvId` riêng.
- Mỗi S3 object có key riêng như `cv/{userId}/{cvId}.pdf`.
- CV mới không xóa hoặc ghi đè CV cũ.

#### Bước 2: Kiểm tra DynamoDB records

Trong DynamoDB, mở bảng `CVs` và query theo `userId` đang test. Bạn cần thấy nhiều record cùng partition key nhưng khác `cvId` sort key.

Các fields nên kiểm tra:

- `fileName`
- `s3Key`
- `status`
- `analysis`
- `createdAt`
- `updatedAt`

#### Bước 3: Phân tích từng CV

Chọn từng CV trên frontend và chạy analysis. Kiểm tra:

- Analysis chỉ cập nhật CV đang chọn.
- Dashboard detail thay đổi khi chọn CV khác.
- Role hints và extracted skills đúng với CV đang chọn.

#### Bước 4: Tạo interview từ CV đang chọn

Mở **AI Interview**:

1. Chọn role theo CV hoặc chọn role AI khác.
2. Chọn số câu hỏi, mặc định 5 và tối thiểu 2.
3. Generate questions.
4. Submit ít nhất một câu trả lời.
5. Finish interview và mở Result page.

Kết quả mong đợi:

- `Interviews` có item gồm `cvId`, `role`, `questionCount`, questions, attempts và score.
- Progress hiển thị đúng số câu đã chọn, ví dụ `0/5` hoặc `0/3`.

#### Bước 5: Kiểm tra history

Mở **History** và kiểm tra:

- Interview list đọc từ DynamoDB khi history API đã bật.
- Nút detail mở đúng interview đã chọn.
- Detail view hiển thị role, score, questions, answers, feedback và advice.

Nếu app đang fallback qua localStorage, UI vẫn nên giữ cùng hành vi trong lúc hoàn thiện DynamoDB history flow.
