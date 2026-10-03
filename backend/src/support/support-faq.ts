// Curated guidance, explicitly distinguished from generated AI responses.
export function supportFaq(message: string) {
  const text = message.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase();
  const topics: [RegExp, string][] = [
    [/huy.*don|don.*huy/, 'Bạn chỉ tự hủy được đơn đang Chờ xác nhận. Mở Đơn của tôi → Chi tiết → Hủy đơn. Nếu quán đã xác nhận, hãy nhắn tin với quán; hệ thống không bảo đảm có thể hủy. Voucher đã dùng không tự hoàn khi hủy.'],
    [/vnpay|thanh toan|tru tien|hoan tien/, 'RouteBite hỗ trợ tiền mặt khi ghé lấy và VNPAY. Nếu thanh toán lỗi, mở Đơn của tôi → Chi tiết để kiểm tra trạng thái. Nếu đã bị trừ tiền, không thanh toán lại; giữ mã giao dịch và nhắn tin với quán. Không gửi mật khẩu, số thẻ hoặc OTP. Trợ lý không kiểm tra ngân hàng hay thực hiện hoàn tiền.'],
    [/chua.*xac nhan|cho.*xac nhan/, 'Mở Đơn của tôi để kiểm tra trạng thái và nhắn tin hỏi quán trong chi tiết đơn. Nếu đơn vẫn Chờ xác nhận, bạn có thể tự hủy.'],
    [/voucher|\bxu\b|tich diem|giam gia/, 'Đơn hoàn thành và đã thanh toán được tích 1 xu cho mỗi 100.000đ thực trả (làm tròn xuống). Xu dùng đổi voucher, không rút thành tiền mặt. Mỗi đơn dùng một voucher và phải đáp ứng điều kiện của voucher.'],
    [/nhan tin|lien he|chat|ho tro/, 'Bạn có thể nhắn tin với quán trong Chi tiết đơn hoặc mở mục Tin nhắn trên thanh điều hướng. Đây là hộp giải đáp hướng dẫn, không phải nhân viên của quán và không thao tác đơn thay bạn.'],
    [/tim.*quan|lo trinh|duong di|dat mon/, 'Tại Trang chủ, chọn điểm đi và điểm đến rồi bấm Tìm gợi ý. Mở quán, chọn món và vào giỏ hàng để chọn thời gian ghé lấy cùng phương thức thanh toán. Bạn cần đăng nhập và tài khoản có số điện thoại để đặt đơn.'],
  ];
  return { source: 'faq' as const, reply: topics.find(([pattern]) => pattern.test(text))?.[1] || 'AI hiện chưa sẵn sàng. Mình có thể cung cấp hướng dẫn có sẵn về tìm quán, đặt món, hủy đơn, thanh toán VNPAY, xu/voucher và nhắn tin với quán. Bạn muốn tìm hiểu mục nào? Với tình huống riêng của đơn hàng, hãy mở Chi tiết đơn để nhắn tin với quán.' };
}
