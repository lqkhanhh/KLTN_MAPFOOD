# Kiểm thử tất cả vai trò — bỏ qua thanh toán trực tuyến

Thực hiện ngày 15/09/2026 trên mã nguồn local hiện tại. Phạm vi gồm customer, merchant, admin và đăng ký đối tác. Không gọi tạo giao dịch, provider thanh toán, QR, IPN hoặc webhook thanh toán. Đơn tiền mặt được dùng để kiểm tra nghiệp vụ đặt món, chuyển trạng thái và tích xu.

## Kết quả thực chạy

| Nhóm | Kết quả |
|---|---|
| Backend build / typecheck / lint | Đạt |
| Backend unit, loại thư mục payments | 6 suite, 40 test đạt |
| Backend Jest e2e | 8 test đạt; chủ động bỏ 2 test webhook/payment event |
| Backend API/database integration | 12 script khác nhau đạt; merchant-applications còn được chạy lại trong session test |
| Web build | Đạt |
| Web smoke | 17 script trong một lượt đều đạt; loyalty chạy riêng chế độ không thanh toán cũng đạt: 18 script khác nhau |
| Flutter | Analyze sạch; 3 widget test đạt |
| Dữ liệu Gò Vấp | Sau test vẫn đủ 8 quán demo và 40 món |
| Web / API danh sách quán / Swagger | HTTP 200 ở cuối lượt kiểm tra |

Không cộng số script thành số test case. Bộ thanh toán và web payment-methods không được chạy. Không ghi nhận lỗi mới trong các bài đã chạy; đây không phải chứng nhận mọi trường hợp trên mọi thiết bị đều đã được kiểm tra.

## Chức năng theo vai trò

| Vai trò | Phạm vi đã kiểm thử | Bằng chứng |
|---|---|---|
| Khách chưa đăng nhập | Xem/tìm quán, tìm món, gợi ý địa điểm, bản đồ, chia sẻ, chuyển đăng nhập khi lưu quán | Web smoke; API tìm kiếm và quán thật; geolocation/geocoding giả lập |
| Khách hàng | Đăng ký/đăng nhập, refresh, đổi mật khẩu, chặn mật khẩu và refresh cũ | test-session-payments --skip-payments; change-password unit |
| Khách hàng | Yêu thích, tìm kiếm/phân trang, giỏ nhiều quán, lưu/reload/xóa giỏ, đặt lại, chọn thời gian lấy | favorites API; explore, saved-carts, account-reorder, route-summary, commerce web |
| Khách hàng | Đặt đơn tiền mặt, theo dõi trạng thái, hủy khi được phép, realtime và polling khi mất socket | test-order-stepper; customer-cancel; gateway e2e |
| Khách hàng | Đánh giá completed-only, chống trùng, validation, rating và số lượt đánh giá | test-order-reviews + order/restaurant reviews web |
| Khách hàng | Xu, lịch sử, đổi/nhận voucher, áp dụng voucher, giới hạn/ownership, làm tròn, đơn miễn phí | loyalty API và web với --skip-payments; không gọi provider |
| Khách hàng | Chat với quán, hộp thư, unread, đọc thông báo, fallback REST | Hai trình duyệt + API/DB/Socket.IO thật; test-chat, chat-inbox, notifications |
| Khách hàng | Hỗ trợ AI, câu hỏi gợi ý khi mở, bấm gửi trực tiếp, câu hỏi liên quan, FAQ thiếu key, hội thoại mới | support unit + test-chat-inbox; provider AI giả lập, FAQ thật |
| Chủ quán | Đăng nhập/guard, dashboard, chọn quán, CRUD menu, ảnh, bật/tắt món, giữ bản nháp, rollback ID món quán khác | merchant/menu API + merchant/image-upload web; Cloudinary giả lập |
| Chủ quán | Nhận đơn và xử lý đến hoàn thành, chat khách, thông báo realtime | Hai trình duyệt trong stepper/chat/inbox |
| Chủ quán | Tạm ngừng/mở quán, không tự gỡ đình chỉ của admin | test-restaurant-suspension; DB invariant và kiểm tra đồng thời |
| Đăng ký đối tác | Đăng ký, nháp, bốn giấy tờ, MIME/size, mã hóa/tải riêng tư, điều khoản, gửi/từ chối/gửi lại/duyệt | merchant-applications API + partner-registration web |
| Admin | Dashboard, phân trang/lọc tài khoản, không lộ passwordHash, điều hướng và role guard | test-admin API + admin web |
| Admin | Duyệt/từ chối hồ sơ, duyệt lặp không tạo quán trùng, đình chỉ/kích hoạt quán | merchant-applications và restaurant-suspension API/web |
| Admin | Tạo/bật/tắt voucher, validation và chặn khách truy cập | loyalty API/web |
| Mọi vai trò | Material 3, font, responsive, giới hạn truy cập dữ liệu của người khác | material3 smoke 320/375/1440; các test nghiệp vụ riêng |

## Phạm vi chưa hoàn thiện / chưa xác minh

- Mobile chỉ có đăng nhập, tìm tuyến và chi tiết quán; checkout vẫn là nút “sắp có”, chưa có đủ màn merchant/admin. Ba widget test không thay thế kiểm thử ứng dụng Android/iOS thực tế.
- Hồ sơ web chỉ đọc; chưa có luồng cập nhật số điện thoại, trong khi đặt đơn yêu cầu số điện thoại. Nội dung hướng dẫn trên ProfilePage còn nói đổi mật khẩu sẽ được bổ sung dù modal đã có.
- Không đánh giá chất lượng câu trả lời Anthropic thật: chưa có key. Test AI dùng provider giả lập; FAQ không phải câu trả lời sinh bởi mô hình.
- Google Directions, geocoding/GPS thật, tile mạng ngoài và upload Cloudinary thật chưa được xác nhận bởi các test dùng mock.
- Chưa thực hiện kiểm thử tải hoặc kiểm toán bảo mật toàn diện. Lỗi Leaflet gián đoạn ở báo cáo trước không xuất hiện trong lượt này; không đủ cơ sở kết luận mọi race condition đã hết.
- Thanh toán trực tuyến được bỏ qua đúng yêu cầu; không kết luận về trạng thái hoạt động của QR/VNPAY.

## Thay đổi phục vụ lần chạy này

Thêm cờ `--skip-payments` vào `backend/scripts/test-loyalty.cjs`, `backend/scripts/test-session-payments.cjs` và `web/tests/loyalty.smoke.mjs`. Mặc định vẫn giữ phạm vi kiểm thử cũ. Khi bật cờ, loyalty dùng đơn cash và xác nhận không gọi provider; session chỉ chạy auth và duyệt đối tác. Không chỉnh sửa logic sản phẩm trong lượt này.

## Chạy lại

```powershell
# Trong backend
npm run build
npm run typecheck
npm run lint
npm test -- --runInBand --testPathIgnorePatterns=payments
npm run test:e2e -- --testNamePattern='^(?!.*(webhook|payment updates)).*$'
Get-ChildItem scripts -Filter 'test-*.cjs' | Where-Object Name -notin @('test-session-payments.cjs','test-loyalty.cjs') | Sort-Object Name | ForEach-Object { node $_.FullName; if ($LASTEXITCODE) { throw $_.Name } }
node scripts/test-loyalty.cjs --skip-payments
node scripts/test-session-payments.cjs --skip-payments

# Trong web, server 4173 cần đang chạy
npm run build
Get-ChildItem tests -Filter '*.smoke.mjs' | Where-Object Name -notin @('payment-methods.smoke.mjs','loyalty.smoke.mjs') | Sort-Object Name | ForEach-Object { node $_.FullName; if ($LASTEXITCODE) { throw $_.Name } }
node tests/loyalty.smoke.mjs --skip-payments

# Trong mobile
flutter analyze
flutter test
```

Hệ thống được giữ chạy: http://127.0.0.1:4173 và http://127.0.0.1:3000/api/docs. Không reset database hoặc thay thông tin đăng nhập các tài khoản demo của người dùng.
