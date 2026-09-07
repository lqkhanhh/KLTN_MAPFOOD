// Nội dung tạm thời cho luồng đồng ý điều khoản, không phải hợp đồng đã ký điện tử.
export const PARTNER_TERMS = {
  version: 'partner-consent-2026-09-v1',
  title: 'Điều khoản đăng ký đối tác RouteBite — bản tạm thời',
  notice: 'Xác nhận dưới đây ghi nhận sự đồng ý khi gửi hồ sơ. Chưa tích hợp dịch vụ ký điện tử và không tạo trạng thái hợp đồng đã ký.',
  sections: [
    { title: '1. Thông tin đăng ký', text: 'Cung cấp thông tin quán, người đại diện và tài khoản ngân hàng chính xác. Chỉ nộp giấy tờ của mình hoặc giấy tờ mà mình được quyền cung cấp.' },
    { title: '2. Hồ sơ xét duyệt', text: 'Hồ sơ gồm CCCD hai mặt, giấy phép kinh doanh, giấy tờ vệ sinh an toàn thực phẩm và thông tin tài khoản ngân hàng. Quản trị viên kiểm tra hồ sơ và có thể yêu cầu bổ sung trước khi phê duyệt.' },
    { title: '3. Quyền truy cập và sử dụng hồ sơ', text: 'Hồ sơ được cung cấp để RouteBite xét duyệt đăng ký đối tác. Chỉ chủ hồ sơ và quản trị viên được cấp quyền mới được xem nội dung qua hệ thống; hồ sơ không hiển thị trên trang quán công khai.' },
    { title: '4. Kích hoạt tài khoản', text: 'Gửi hồ sơ không đồng nghĩa đã trở thành đối tác. Tài khoản chỉ được cấp quyền Merchant sau khi Admin duyệt. Nếu bị từ chối, xem lý do, bổ sung hồ sơ và gửi lại.' },
    { title: '5. Phạm vi xác nhận', text: 'Các ô xác nhận chỉ ghi nhận nội dung đồng ý và thời điểm gửi hồ sơ. Phí dịch vụ, đối soát và hợp đồng thương mại chính thức chưa được thiết lập trong bản điều khoản tạm thời này.' },
  ],
};
