# Đăng ký và đăng nhập mật khẩu + OTP email

Luồng hiện tại thay thế đăng nhập chỉ bằng OTP trước đây.

## Hành vi

1. Email/mật khẩu đúng → gửi OTP email qua Brevo → xác minh OTP → cấp phiên RouteBite.
2. Đăng xuất/xóa dữ liệu phiên/thiết bị mới → lần đăng nhập mật khẩu kế tiếp phải xác minh OTP.
3. Đóng/mở web hoặc ứng dụng Flutter vẫn giữ phiên đã lưu. Access token hết hạn được gia hạn bằng refresh token, không gửi OTP.
4. Refresh token không còn hợp lệ → xóa phiên, quay về đăng nhập mật khẩu + OTP. Lỗi mạng hoặc máy chủ tạm thời không xóa phiên.
5. Google login dùng xác thực Firebase hiện có, không thêm OTP Brevo. Flutter hiện chưa có giao diện Google login.

Không nhận diện sự kiện gỡ/cài app trực tiếp: dựa trên việc còn dữ liệu phiên trong bộ nhớ bảo mật hay không. Cách hệ điều hành giữ/khôi phục dữ liệu sau cài lại có thể khác nhau. Mở tab/trình duyệt riêng tư không có phiên sẽ cần đăng nhập.

## API

- `POST /api/auth/register` nhận `{ email, password, fullName, phone? }`, trả `{ requiresOtp, registrationTicket, expiresIn, retryAfter, message }`. Chưa tạo user hoặc cấp phiên.
- `POST /api/auth/register/verify` nhận `{ registrationTicket, code }`. OTP đúng mới tạo tài khoản customer, lưu hồ sơ/mật khẩu băm và cấp phiên đầu tiên.
- `POST /api/auth/register/resend` nhận `{ registrationTicket }`, gửi mã mới và trả ticket mới. Ticket cũ không xác minh được nữa.

Thông tin đăng ký tạm nằm trong ticket mã hóa AES-256-GCM có hạn 5 phút; không đưa mật khẩu rõ hoặc hash có thể đọc được vào phản hồi. Chỉ giữ ticket trong bộ nhớ trang. Đóng/tải lại trang hoặc hết hạn thì nhập lại thông tin. Email đã tồn tại trả 409; cạnh tranh tạo cùng email không ghi đè tài khoản. Khi gửi thư lỗi không tạo user. Giới hạn OTP đăng nhập và đăng ký dùng chung theo email/ngày.

- `POST /api/auth/login` nhận `{ email, password }`, trả `{ requiresOtp, loginTicket, expiresIn, retryAfter, message }`. Không trả access/refresh token ở bước này.
- `POST /api/auth/email-otp/verify` nhận `{ loginTicket, code }`. Chỉ cấp phiên khi ticket và OTP hợp lệ.
- `POST /api/auth/email-otp/resend` nhận `{ loginTicket }`, trả ticket mới và gửi mã mới. Ticket/challenge cũ mất hiệu lực.
- `POST /api/auth/email-otp/request` cũ trả 410: không còn gửi OTP đăng nhập bằng email đơn thuần.
- `POST /api/auth/refresh` vẫn gia hạn phiên mà không yêu cầu OTP.

Ticket được ký bằng `EMAIL_OTP_SECRET`, hạn 5 phút, gắn với user, challenge và phiên bản password hash. Không dùng được như access/refresh token. Đổi mật khẩu làm ticket đang chờ không còn hợp lệ. Frontend giữ ticket trong bộ nhớ, xóa mật khẩu sau bước đầu; không lưu mật khẩu, OTP hoặc ticket vào localStorage.

OTP vẫn có hạn 5 phút, tối đa 5 lần thử, một lần sử dụng; gửi lại ít nhất 60 giây, 5 mã/email/giờ, ngân sách toàn hệ thống theo `EMAIL_OTP_DAILY_LIMIT`. Gửi thất bại hoặc thiếu cấu hình không cho phép bỏ qua bước OTP.

## Phạm vi

- Web đã có đăng ký hai bước: nhập thông tin → OTP email → tạo tài khoản và đăng nhập. Flutter hiện chưa có màn hình đăng ký; luồng đăng nhập OTP Flutter đã có từ trước.
- Tài khoản đã tạo bằng OTP-only trước đây không có mật khẩu: không tự tạo mật khẩu mặc định. Nếu không có Google đã liên kết, cần hỗ trợ thiết lập mật khẩu qua quy trình riêng; chưa có màn hình khôi phục/đặt mật khẩu mới trong đợt này.
- Backend hiện lưu một refresh hash/tài khoản theo thiết kế trước đó; đăng nhập/refresh từ thiết bị khác có thể ảnh hưởng khả năng gia hạn phiên cũ. Chưa bổ sung quản lý nhiều phiên theo thiết bị.
- Đăng xuất xóa phiên ở thiết bị; không bổ sung danh sách thu hồi access JWT đã cấp trong đợt này.

## Cấu hình và kiểm thử

Dùng cấu hình Brevo/Firebase trong `backend/.env` như [BREVO_EMAIL_OTP_SETUP.md](./BREVO_EMAIL_OTP_SETUP.md). Không cần migration mới. Khởi động lại backend sau khi build.

Đã chạy:

- Backend build, lint và 27 unit tests phần auth.
- `backend/scripts/test-email-otp.cjs`: PostgreSQL/HTTP thật, gửi thư giả lập; kiểm tra mật khẩu trước OTP, không cấp phiên sớm, khóa API cũ, sai/hết hạn/dùng lại mã, gửi lại, đổi mật khẩu, ticket giả/hết hạn, giới hạn, đồng thời, giữ vai trò/điểm.
- `web/tests/email-otp.smoke.mjs`: trình duyệt với HTTP fixtures; đăng nhập hai bước, OTP sai, gửi lại, không lưu thông tin nhạy cảm, ba vai trò, đóng/mở tab, tự refresh, lỗi mạng, refresh hết hạn, đăng xuất rồi đăng nhập lại và giao diện 320/375/1440px.
- `web/tests/firebase-auth.smoke.mjs`: Google với SDK giả lập; luồng Google không yêu cầu OTP email.
- `web/tests/register-otp.smoke.mjs`: email trùng/lỗi gửi thư, không cấp phiên sớm, mã sai, gửi lại, hoàn tất đăng ký, hết hạn/sửa thông tin và màn hình nhỏ.
- Flutter analyze; 6 tests giao diện và phiên (khôi phục phiên, refresh, logout, lỗi mạng).

Không gửi OTP thật đến người dùng trong các kiểm thử tự động. Thử thực tế bằng email/mật khẩu của bạn trên trang `/login`, rồi nhận mã Brevo để hoàn tất.
