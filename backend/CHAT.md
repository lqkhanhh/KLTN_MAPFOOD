# Chat theo đơn hàng

- `GET /api/orders/:orderId/messages`: lịch sử theo thời gian tăng dần.
- `POST /api/orders/:orderId/messages`: `{ "content": "..." }`, 1–2.000 ký tự sau trim, JWT bắt buộc.
- Namespace Socket.IO `/chat`, xác thực `auth.token`. Sự kiện `join` / `leave` nhận `{ orderId }`, ack `{ ok }`; server phát `message.new`.
- Chỉ khách sở hữu đơn và merchant hiện sở hữu quán được truy cập. Admin không có quyền đọc chat. Không nhận `senderId`/`senderRole` do client tự gán.
- Kiểm tra quyền cả khi join lẫn trước lúc phát tin. Socket chat bị ngắt khi access token hết hạn; không ngắt namespace đơn hàng/thông báo.
- Tin được lưu trước khi phát realtime. UI loại trùng theo ID giữa phản hồi POST, lịch sử và socket; tải dự phòng mỗi 15 giây khi mở chat.
- Đơn hoàn thành/hủy vẫn xem và nhắn được để hỗ trợ sau giao dịch.
- `GET /api/messages/conversations`: tổng hợp tin mới nhất, tên quán/khách, mã đơn và số chưa đọc cho đúng người tham gia. Không trả đơn chưa có tin, không cho Admin đọc.
- `PATCH /api/orders/:orderId/messages/read`: `{ messageIds: string[] }` tối đa 200 UUID; chỉ đánh dấu tin của phía đối diện thuộc chính đơn này, trả các ID vừa đánh dấu. Mở dropdown không đánh dấu đã đọc; mở drawer/đến cuối danh sách trong tab hiển thị mới đánh dấu các tin đã tải.
- `join-all-my-conversations`: server tự xác định room hộp thư cá nhân từ JWT, không nhận ID người dùng từ body. Tin đầu tiên của đơn mới vẫn tới hộp thư; quyền được kiểm tra lại trước khi phát nội dung. `messages.read` làm mới số đếm giữa các tab.
- Tin nhắn và notification lưu trong cùng transaction; phát sự kiện sau commit. Mỗi tin gửi thông báo cho phía nhận, không phải người gửi. Đọc thông báo và đọc tin nhắn là hai thao tác riêng.
- Chat dùng chung socket suốt phiên khách/merchant. Đóng drawer chỉ rời room đơn, không ngắt hộp thư. Nút hộp thư mở đúng route chi tiết theo role và tự mở drawer bằng `?chat=1`.
- Phạm vi cơ bản: văn bản; chưa có ảnh/tệp, phân trang lịch sử hay giới hạn tốc độ gửi chat thường. Cần bổ sung các phần này trước khi triển khai quy mô lớn.

## Chạy và kiểm thử

Tại `backend`: `npm run build`, `npm run migration:run`, sau đó khởi động lại backend.

`node scripts/test-chat.cjs` dùng database cấu hình trong `.env`, tạo fixture riêng và dọn lại sau test; mở hai phiên Edge ẩn để kiểm tra realtime khách/merchant, quyền truy cập và lịch sử sau F5. Cần web chạy ở cổng 4173, PostgreSQL và Edge.

`node scripts/test-chat-inbox.cjs`: hộp thư + badge notification/chat, đã đọc, tin đầu tiên, role và AI widget (provider giả, không phát sinh phí).
