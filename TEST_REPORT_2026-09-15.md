# Kiểm tra lại RouteBite — 15/09/2026

Kiểm tra trên working tree hiện tại, bao gồm giao diện Material Design 3 chưa commit. Báo cáo này cập nhật kết quả ngày 13/09; không thay thế lịch sử trong TEST_REPORT.md.

## Kết quả

| Hạng mục | Kết quả thực chạy |
|---|---|
| Backend build, typecheck, lint | Đạt sau sửa fixture cũ và 4 lỗi lint |
| Backend unit | 10/10 suite, 63/63 test đạt |
| Backend Jest e2e | 2/2 suite, 10/10 test đạt; HTTP/Socket.IO thật, dependency nghiệp vụ giả lập |
| API/database integration | 12/12 script đạt: 11 script chạy trực tiếp và merchant-applications chạy trong session-payments với admin tạm |
| Web build | Đạt |
| Web smoke | Lần chạy đủ sau khởi động server: 17/19 đạt. Commerce đạt sau sửa chờ URL; Explore/favorites đạt cả 4 lần chạy lại riêng, nhưng lỗi Leaflet gián đoạn chưa xác định nguyên nhân |
| Material 3 | Smoke đạt các màn khách hàng, đăng nhập, menu, merchant, admin ở 320/375/1440 px |
| Flutter | Analyze không có lỗi; 3/3 widget test đạt |
| Database | PostgreSQL/PostGIS hoạt động; đủ 12 migration, không có migration chờ chạy |
| HTTP cuối kiểm tra | Web, danh sách quán và Swagger đều trả 200 |

Lần chạy web đầu tiên bắt đầu khi server còn tắt và nhận ERR_CONNECTION_REFUSED; đã khởi động dịch vụ rồi chạy lại toàn bộ. Không tính lỗi môi trường đó là lỗi UI. Không tuyên bố có một lượt web 19/19 xanh: kết quả chạy riêng không xóa lỗi đã quan sát trong lượt đầy đủ.

## Phạm vi chức năng đã chạy

- Auth: đăng ký, đăng nhập, refresh, đổi mật khẩu và vô hiệu refresh cũ; phân quyền customer/merchant/admin.
- Quán/menu: CRUD, bật/tắt món, ownership, rollback khi ID món thuộc quán khác, đình chỉ và kích hoạt quán, tìm tên/món, yêu thích và phân trang.
- Đơn hàng: giỏ nhiều quán, lưu/reload, đặt lại, tiền mặt, chuyển trạng thái qua hai trình duyệt và Socket.IO thật, hủy, polling khi mất socket, đánh giá.
- Thanh toán: tạo/tái sử dụng giao dịch, kiểm tra quyền, từ chối chữ ký/số tiền sai, callback lặp, trạng thái PAID. Dùng database thật và provider/chữ ký thử.
- Xu/voucher: cộng xu đúng điều kiện, ledger, idempotency, đổi/dùng đồng thời, ownership, mức tối thiểu, đơn 0 đồng và số tiền sau giảm.
- Đối tác/admin: hồ sơ, bốn giấy tờ, mã hóa và tải riêng tư, consent, từ chối/gửi lại/duyệt, khóa quyền tự nâng cấp, thống kê và quản lý voucher.
- Chat/thông báo: hai trình duyệt, lưu/reload, unread, phòng và recipient isolation, chống đọc tin khi mất quyền, REST fallback. AI dùng provider giả lập.
- Web: điều hướng, chia sẻ, geolocation giả lập, Leaflet, responsive và các trạng thái tải/lỗi/rỗng; upload Cloudinary được giả lập.
- Mobile: widget đăng nhập, validation tọa độ và chi tiết quán; chưa chạy thiết bị Android/iOS thật.

## Điều chỉnh trong lần kiểm tra này

- Chuyển fixture Jest từ OrderType/BOOKING/TAKE_AWAY đã bị bỏ sang pickupOption và cash/vnpay. Test đơn hẹn giờ vẫn kiểm tra thời điểm hẹn, snapshot khách hàng, số tiền và sự kiện; các kiểm tra rollback/ownership giữ nguyên.
- Cập nhật mock payment transaction và dependency thông báo/xu của e2e socket cho service hiện tại. Provider payment unit dùng VNPAY và URL example.invalid.
- Sửa test validation để payload nền hợp lệ; quantity=0 và các trường userId/tổng tiền/status giả mạo bị chặn vì đúng điều kiện cần kiểm tra.
- Bỏ import Transform không dùng; đổi tên tham số migration down không dùng; thay hai any bằng kiểu callback cụ thể. Không thay đổi nghiệp vụ/migration SQL.
- Commerce smoke chờ URL /cart trước khi đo nút số lượng để tránh đo DOM trang cũ đang bị tháo.

## Còn tồn tại hoặc chưa xác minh

1. **Leaflet gián đoạn:** một lượt Explore/favorites báo `Cannot read properties of undefined (reading '_leaflet_pos')`. Bốn lượt chạy lại riêng đều đạt. Chưa đủ bằng chứng xác định nguyên nhân hoặc xác nhận đã sửa; cần theo dõi thao tác bản đồ/chuyển trang nhanh.
2. **VNPAY chưa cấu hình đầy đủ:** VNPAY_TMN_CODE và VNPAY_HASH_SECRET trống; URL và return URL có giá trị. Chưa thực hiện thanh toán sandbox qua nhà cung cấp thật.
3. **Mobile chưa có checkout:** nút đặt món đang vô hiệu và thông báo sắp có. Widget xanh không chứng minh đầy đủ nghiệp vụ mobile.
4. **Hồ sơ:** trang chỉ đọc, chưa có luồng cập nhật số điện thoại trong khi tạo đơn yêu cầu số điện thoại. Nội dung trang vẫn nói đổi mật khẩu chưa có dù modal đổi mật khẩu đã tồn tại.
5. README gốc còn mô tả payOS/VietQR cũ. Cloudinary, Directions/geocoding, LLM thật, kiểm thử tải và kiểm toán bảo mật toàn diện chưa được xác minh trong lượt này.

## Trạng thái bàn giao

- Web: http://127.0.0.1:4173
- API: http://127.0.0.1:3000/api
- Swagger: http://127.0.0.1:3000/api/docs

Giữ database và server chạy. Test session/payments báo đã dọn fixture của chính script; không xóa hàng loạt dữ liệu hoặc sửa khóa thật. Các chỉnh sửa Material 3 và test có sẵn trước lượt kiểm tra được giữ nguyên.
