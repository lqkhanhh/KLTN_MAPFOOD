# Khảo sát và kiểm thử RouteBite — 13/09/2026

Mã nguồn nền: commit `9d906c21`. Working tree sạch trước khi khảo sát. Kết quả dưới đây là những kịch bản đã chạy trên máy local, không phải chứng nhận mọi trường hợp hoặc dịch vụ production đều hoạt động.

## 1. Kiến trúc và phạm vi hiện tại

- Web: React 19 + React Router + esbuild, phục vụ tại `http://127.0.0.1:4173`. Ba nhóm giao diện customer, merchant, admin.
- Backend: NestJS 10 + TypeORM, REST `/api`, Swagger `/api/docs`, Socket.IO cho đơn hàng, thông báo và chat.
- Database: PostgreSQL 16/PostGIS, 16 entity nghiệp vụ, 12 migration. LoyaltyModule được import qua OrdersModule; các API xu/voucher có trong ứng dụng.
- Mobile: Flutter, hai file Dart cho API client và giao diện cơ bản; chưa đạt bước phân tích mã/biên dịch.
- So với lần trước: thêm yêu thích, khám phá trên bản đồ, chia sẻ quán, gợi ý đặt lại, đánh giá trên web, chat/hộp thư, xu/voucher, hỗ trợ AI, xử lý đình chỉ quán chặt hơn.
- Luồng đơn: lấy sớm/hẹn giờ → tiền mặt hoặc VNPAY → xác nhận → chuẩn bị → sẵn sàng → hoàn thành. Voucher áp dụng khi tạo đơn; xu cộng khi hoàn thành và đã thanh toán. Chat gắn với đơn, chỉ hai bên được đọc/gửi.

## 2. Chuẩn bị môi trường

- Backend thiếu node_modules; đã cài lại bằng `npm ci --no-audit --no-fund`.
- Khởi động PostgreSQL qua Docker Compose, build backend/web và khởi động hai server.
- Database ban đầu có 8 migration. Đã chạy thành công 4 migration còn thiếu: Favorites, Messages, Loyalty, EnforceRestaurantSuspension. Migration Loyalty thêm 3 voucher đổi xu mặc định.
- API danh sách quán, Swagger và trang web trả HTTP 200 ở cuối lần kiểm thử. Database có 1 quán công khai.
- Không thay khóa thật, không gọi ngân hàng hoặc LLM thật trong kiểm thử.

## 3. Kết quả tổng hợp

| Nhóm | Kết quả |
|---|---|
| Backend build | Đạt |
| Web build | Đạt |
| Backend typecheck | Không đạt: 8 diagnostic trong các test dùng OrderType/schema cũ |
| Backend lint | Không đạt: 4 lỗi |
| Backend unit | 8/10 suite đạt; 46 test đạt; 2 suite không biên dịch |
| Backend Jest e2e | 3 test đạt, 1 test thất bại; suite socket không biên dịch |
| Web smoke | Ban đầu 14/18 script đạt; cuối cùng 18/18 đạt sau chỉnh 4 lỗi trong test |
| API integration có sẵn | Ban đầu 9/11 script đạt; cuối cùng cả 11 đã chạy đạt sau sửa test menu và cung cấp admin fixture |
| API integration bổ sung | `test-session-payments.cjs` đạt: auth, thanh toán có chữ ký giả lập, duyệt đối tác |
| Web payment type assertions | Đạt: `tsc --noEmit --skipLibCheck --target ES2020 --moduleResolution node tests/payment-methods.types.ts` |
| Flutter analyze | Không đạt: 5 lỗi trong main.dart |

Không cộng số script/suite thành số test case: mỗi script có nhiều assertion. Kết quả cuối của các script sửa là lần chạy lại riêng, không phải một lần chạy cả bộ đều xanh.

## 4. Ma trận chức năng đã kiểm tra

| Chức năng | Bằng chứng và giới hạn |
|---|---|
| Đăng ký, đăng nhập, refresh, đổi mật khẩu | API + DB thật; sai mật khẩu bị chặn, đổi mật khẩu chặn đăng nhập/refresh cũ |
| Khám phá/tìm món/yêu thích | API + PostGIS thật; tìm tên/món giữ đầy đủ menu, phân trang distinct, thêm trùng đồng thời, cô lập tài khoản, bỏ thích lặp |
| Tuyến đường, vị trí, chia sẻ | Web smoke: bản đồ Leaflet, marker/popup, định vị giả lập, URL chia sẻ bỏ thông tin tuyến riêng, clipboard/native-share/manual fallback; Directions bên ngoài chưa gọi thật |
| Menu/ảnh quán | API thật CRUD/toggle/xóa hết menu, ownership và rollback ID khác quán; upload Cloudinary trong browser được giả lập |
| Giỏ/đặt lại | Web smoke lưu giỏ, nhiều quán, FIFO 10, reload, số lượng, tổng tiền, gợi ý đơn hoàn thành, responsive |
| Đơn hàng | Checkout tiền mặt + DB thật + hai trình duyệt khách/merchant, chuyển trạng thái realtime, stepper, hủy, fallback polling khi mất socket |
| Đánh giá | API thật: ownership, completed-only, duplicate, rating/comment validation, hasReview, trung bình/số lượng; web modal và danh sách công khai |
| VNPAY | DB thật, tạo/tái sử dụng checkout; chữ ký sai/số tiền sai bị chặn; IPN/return hợp lệ và trùng; đã trả không tạo lại. Chữ ký và provider dùng cấu hình thử |
| Xu/voucher | DB thật: cộng xu, ledger/idempotency, đổi và dùng voucher đồng thời, quyền sở hữu, điều kiện tối thiểu, tắt voucher, claim một lần, làm tròn/clamp, đơn 0đ, tiền sau giảm gửi adapter giả |
| Đối tác | API + DB thật: đăng ký, khóa quyền, nháp, bốn giấy tờ, mã hóa, tải riêng tư, MIME/size, điều khoản/phiên bản, gửi/từ chối/gửi lại/duyệt lặp và đăng nhập merchant |
| Admin | API thật thống kê, phân trang/lọc, không trả passwordHash; web điều hướng, voucher, duyệt hồ sơ, đình chỉ/kích hoạt |
| Thông báo | DB + HTTP/socket thật; phòng không giả mạo, recipient isolation, giới hạn 50 dòng, tổng chưa đọc, đọc lặp |
| Chat/hộp thư | DB + hai trình duyệt thật; lưu/reload, latest/unread, tin đầu tiên, đọc đúng người/đơn, badge, revoked owner không nhận nội dung, admin bị chặn; fallback REST |
| Trợ lý AI | 7 unit test hỗ trợ cùng integration/web dùng provider giả: quyền, validation, quota/busy, lỗi/thiếu khóa, không lộ lỗi provider; chưa đánh giá câu trả lời LLM thật |

## 5. Đối chiếu lỗi lần trước

### Đã sửa trong mã nguồn hiện tại

**Merchant tự bật lại quán bị admin đình chỉ:** kiểm thử `test-restaurant-suspension.cjs` đạt. API từ chối `active: true` khi còn dấu đình chỉ; sửa menu/ảnh không bỏ đình chỉ; chỉ API admin riêng được kích hoạt. Có CHECK constraint database và kiểm thử concurrent suspend/update. Public menu, khám phá/tìm tuyến, đơn mới và thêm yêu thích đều được bảo vệ.

### Còn tồn tại

1. **Flutter không biên dịch:** `mobile/lib/main.dart:5` có 2 lỗi const; dòng 9, 11, 12 thiếu `)` (3 lỗi). Chưa thể test native. Không có Android/iOS kết nối; Flutter chỉ thấy Windows, Chrome, Edge.
2. **Test backend lỗi thời:** orders.service.spec.ts, payments.service.spec.ts, orders.gateway.e2e-spec.ts vẫn tham chiếu OrderType/type cũ. transactions.e2e-spec.ts gửi TAKE_AWAY cũ, mong 201 nhưng nhận 400. Đây là lỗi bộ kiểm thử; không dùng chúng để kết luận API mới hỏng hoặc đã đạt toàn bộ.
3. **Lint:** queryRunner không dùng trong migration AddPickupOptionToOrders; 2 any trong notifications.spec.ts; import Transform không dùng trong create-order.dto.ts.
4. **Khoảng trống chức năng từ khảo sát mã:** đăng ký cho phép bỏ số điện thoại nhưng đặt đơn bắt buộc có; ProfilePage chỉ đọc và chưa có API cập nhật hồ sơ. Câu thông báo ở profile còn nói đổi mật khẩu chưa có dù modal đổi mật khẩu đã tồn tại.
5. **Tài liệu gốc chưa đầy đủ:** README vẫn mô tả payOS/VietQR; thanh toán hiện tại dùng VNPAY. Flutter đặt món còn là nút chưa có xử lý.

## 6. Điều chỉnh chỉ phục vụ kiểm thử

- `web/tests/admin.smoke.mjs`: menu admin hiện có 5 mục; kiểm tra thêm đường dẫn Voucher.
- `web/tests/explore-nav.smoke.mjs`: chờ điều hướng hoàn tất trước khi đọc active nav.
- `web/tests/partner-registration.smoke.mjs`: chờ checkbox xuất hiện trước khi kiểm tra số lượng ở bước điều khoản.
- `web/tests/route-summary.smoke.mjs`: placeholder hiện tại “Nhập điểm đến”.
- `backend/scripts/test-merchant-menu.cjs`: quán tạm ngưng phải trả 403 qua public endpoint; dùng `/manage` kiểm tra dữ liệu rollback của chủ quán.
- Thêm `backend/scripts/test-session-payments.cjs`: server thử riêng, tài khoản ngẫu nhiên, khóa thử, callback tự ký, tạo admin fixture cho test đối tác, cleanup dữ liệu của script trong finally.

Không sửa mã nghiệp vụ hoặc test Jest cũ để làm đẹp kết quả. Chỉ sửa kỳ vọng/đồng bộ test sau khi đối chiếu hành vi hiện tại. Các script cũ tự cleanup theo triển khai của từng script; không thực hiện xóa hàng loạt dữ liệu database để dọn môi trường.

## 7. Phần chưa kiểm chứng

- VNPAY sandbox end-to-end qua website ngân hàng và callback nhà cung cấp thật; hoàn tiền thật.
- Cloudinary nhận file thật, Google Directions/Nominatim và dịch vụ AI ngoài hoạt động với khóa/billing thật. Kiểm thử dùng mock không chứng minh các cấu hình này đúng.
- Chất lượng câu trả lời AI thật, kiểm thử tải dài hạn, mọi race condition, bảo mật toàn diện và mọi thiết bị.
- Mobile runtime do lỗi Dart và thiếu thiết bị native.

## 8. Chạy lại

Backend: `npm run build`, `npm run typecheck`, `npm run lint`, `npm test -- --runInBand`, `npm run test:e2e`. Các integration chạy `node scripts/test-<nhóm>.cjs`; chat/stepper cần web cổng 4173. `test-session-payments.cjs` tự tạo admin tạm và chạy test đối tác, không cần tạo admin thật.

Web: `npm run build`, chạy từng file `node tests/<tên>.smoke.mjs` khi web phục vụ cổng 4173. Mobile: `flutter analyze`.

Flutter analyze sinh `mobile/.dart_tool/` và `mobile/pubspec.lock`; các file này chưa được commit. Backend/web/database được giữ chạy sau kiểm thử.
