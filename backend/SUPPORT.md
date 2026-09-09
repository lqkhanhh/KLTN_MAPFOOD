# Trợ lý AI hỗ trợ RouteBite

- API `POST /api/support/ai-chat`, JWT bắt buộc; kiểm tra tài khoản Customer hiện tại trong DB.
- Payload: `{ message, history?: [{ role: 'user' | 'assistant', content }] }`. Tối đa 1.000 ký tự câu hỏi, 10 lượt lịch sử (5 cặp hỏi/đáp), tổng 14.000 ký tự; không chấp nhận system role, tool hay trường cấu hình provider từ client.
- Câu hỏi/lịch sử được chuyển tới Anthropic; không chuyển user ID, JWT, đơn hàng hay hồ sơ. Widget có nhắc không nhập thông tin nhạy cảm; lịch sử chỉ giữ trong bộ nhớ trang, xóa khi đổi tài khoản/tải lại.
- AI chỉ hướng dẫn, không có tools hoặc khả năng thay đổi đơn/thanh toán. Câu trả lời là văn bản React, không render HTML do AI trả về.
- Nguồn API: [Anthropic Messages](https://platform.claude.com/docs/en/api/messages/create).

## Cấu hình thật

Nhập `ANTHROPIC_API_KEY` vào `backend/.env` (đã gitignore), model mặc định `ANTHROPIC_MODEL=claude-sonnet-4-6`, rồi khởi động lại backend. Không đưa khóa vào config frontend.
Khi chưa có khóa, trả HTTP 503 với thông báo rõ ràng; không giả câu trả lời AI. Lỗi provider/timeout không trả nội dung lỗi gốc hay khóa cho client.
API dùng credits/billing riêng; không mặc định rằng có trial hoặc miễn phí. Kiểm tra số dư tại Console theo [hướng dẫn billing chính thức](https://support.claude.com/en/articles/8977456-how-do-i-pay-for-my-claude-api-usage).

## Giới hạn bản hiện tại

- Tối đa 500 output tokens, timeout 25 giây; 1 yêu cầu đang chạy mỗi user, 3 toàn ứng dụng.
- 5 yêu cầu/phút/user, 50/ngày/user, 500/ngày/toàn process. Giới hạn bộ nhớ reset khi restart, không phải ngân sách billing cứng. Khi triển khai nhiều instance cần Redis/DB chia sẻ và đặt spend limit ở nhà cung cấp.
- Không ghi log nội dung hỏi/đáp hoặc lỗi upstream. Không có cơ chế bảo đảm AI luôn trả lời đúng; người dùng được hướng dẫn liên hệ quán khi chưa chắc chắn.
- Unit test `npm test -- --runInBand support.spec.ts`; integration dùng provider giả. Cần khóa và credits của chủ dự án để kiểm tra LLM thật; không coi mock test là bằng chứng chất lượng câu trả lời thật.
