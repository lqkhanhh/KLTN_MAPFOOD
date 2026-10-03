# Google + OTP email Brevo

> Đăng ký web hiện cũng yêu cầu OTP email: tài khoản chỉ được tạo sau xác minh thành công. Xem API đăng ký và kiểm thử trong [AUTH_PASSWORD_OTP_FLOW.md](./AUTH_PASSWORD_OTP_FLOW.md).

> **Luồng hiện tại đã đổi:** email/mật khẩu đúng mới gửi OTP; chỉ sau OTP đúng mới cấp phiên. Nút đăng nhập chỉ bằng OTP đã được bỏ. Web và Flutter giữ/khôi phục phiên khi mở lại. Xem [AUTH_PASSWORD_OTP_FLOW.md](./AUTH_PASSWORD_OTP_FLOW.md). Các bước cấu hình Brevo/Google dưới đây vẫn áp dụng; mô tả luồng OTP-only bên dưới là lịch sử triển khai cũ.

Đã tích hợp trên web React và backend NestJS. Trang `/login` có email/mật khẩu, Google và OTP qua email; không còn nút Apple/SMS. Google vẫn dùng Firebase Authentication. OTP email dùng Brevo API trực tiếp, không cần Firebase. Flutter chưa có giao diện OTP email.

## Cấu hình Brevo

1. Tạo tài khoản tại [Brevo](https://www.brevo.com/).
2. Trong phần **Senders, Domains & Dedicated IPs**, thêm/xác minh email gửi. Nên xác thực tên miền gửi theo hướng dẫn DNS của Brevo để tăng khả năng vào hộp thư.
3. Mở **SMTP & API → API Keys**, tạo API key. Tích hợp này cần **API key**, không phải SMTP key. Đảm bảo transactional email đã được kích hoạt/duyệt cho tài khoản.
4. Điền trong `backend/.env`:

```dotenv
AUTH_EMAIL_OTP_ENABLED=true
BREVO_API_KEY=your-brevo-api-key
BREVO_SENDER_EMAIL=email-da-xac-minh@your-domain.com
BREVO_SENDER_NAME=RouteBite
EMAIL_OTP_SECRET=chuoi-ngau-nhien-toi-thieu-32-ky-tu
EMAIL_OTP_DAILY_LIMIT=250
```

Trên máy hiện tại đã tạo `EMAIL_OTP_SECRET` ngẫu nhiên trong `backend/.env`; giữ nguyên giá trị đó. API key và sender đang để trống, tính năng chưa bật. Không đưa API key hoặc OTP secret vào `web/.env`, source frontend hoặc chat. Đổi OTP secret sẽ làm các mã đang chờ mất hiệu lực.

Hệ thống gọi `POST https://api.brevo.com/v3/smtp/email` với header `api-key`, sender, recipient và nội dung email chứa OTP. [Tài liệu chính thức](https://developers.brevo.com/docs/send-a-transactional-email).

Gói miễn phí Brevo hiện cho 300 email/ngày, dùng chung các loại email. Giới hạn 250 trong ứng dụng chỉ giới hạn yêu cầu OTP của ứng dụng; không kiểm soát các chiến dịch/email gửi từ nơi khác và không đảm bảo tài khoản Brevo còn hạn mức. [Thông tin gói Brevo](https://help.brevo.com/hc/en-us/articles/208589409-About-Brevo-s-pricing-plans).

## Cấu hình Google

Theo phần Firebase trong [AUTH_LOGIN_SETUP.md](./AUTH_LOGIN_SETUP.md), thêm Web app, bật Google provider, khai báo Authorized domains và thiết lập service account backend. Trong `backend/.env`:

```dotenv
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_WEB_API_KEY=your-firebase-web-api-key
FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
FIREBASE_WEB_APP_ID=your-firebase-web-app-id
GOOGLE_APPLICATION_CREDENTIALS=D:/KLTN_MAPFOOD/secrets/firebase-service-account.json
AUTH_GOOGLE_ENABLED=true
AUTH_APPLE_ENABLED=false
AUTH_PHONE_ENABLED=false
```

Nếu email Google đã có tài khoản và chưa liên kết, đăng nhập phương thức cũ rồi liên kết trong Hồ sơ (hiện bước liên kết yêu cầu mật khẩu tài khoản). Tài khoản chỉ dùng OTP vẫn đăng nhập bằng OTP; chưa có giao diện đặt mật khẩu hoặc liên kết Google bằng bước xác minh OTP.

## Chạy

Từ `backend/`, dùng Node.js 22 trở lên:

```powershell
npm run migration:run
npm run build
npm run start:prod
```

Từ `web/`:

```powershell
npm run build
npm start
```

Khởi động lại backend đang chạy sau khi sửa `.env`, tránh chạy trùng cổng. Migration `AddEmailOtp1789300000000` đã được áp dụng trên máy hiện tại. API `GET /api/auth/email-otp/status` trả `{ "enabled": true }` khi bật cờ và điền đủ cấu hình đúng định dạng; đây không phải phép thử API key hoặc quyền gửi thư tại Brevo.

## Luồng và giới hạn

- Nhập email → gửi mã 6 chữ số → xác minh → nhận access/refresh token RouteBite → chuyển tới trang tương ứng vai trò.
- Email được chuẩn hóa chữ thường/bỏ khoảng trắng hai đầu. Chủ hộp thư có thể đăng nhập vào tài khoản hiện có bằng OTP mà không cần mật khẩu. Mọi vai trò hiện có đều được giữ nguyên. Email chưa có tài khoản tạo customer, không tạo mật khẩu mặc định.
- OTP không xác minh số điện thoại. Không tự động gộp bằng contact phone hoặc chấp nhận role/userId từ frontend.
- Mã sinh bằng CSPRNG; database chỉ giữ HMAC-SHA256, không lưu OTP rõ. Mã không xuất hiện trong phản hồi API hoặc log ứng dụng.
- Mã hết hạn sau 5 phút; chỉ dùng một lần, tối đa 5 lần nhập sai. Mã mới thay mã trước, có challenge UUID để ràng buộc yêu cầu. Khóa hàng trong transaction ngăn hai lần xác minh đồng thời cùng thành công.
- Gửi lại cách nhau tối thiểu 60 giây, tối đa 5 lần/email/giờ. Hạn mức toàn hệ thống mặc định 250 lần/ngày UTC, lưu trong PostgreSQL và dùng chung nhiều tiến trình. Yêu cầu gửi thất bại vẫn tính hạn mức, mã bị vô hiệu hóa; không tự gửi lại khi timeout để tránh trùng thư.
- Các API OTP còn có giới hạn 20 lần/phút/IP trên từng tiến trình. Khi public nhiều instance, bổ sung giới hạn IP chung tại gateway/reverse proxy. Không cho phép giả mạo forwarded IP.
- Brevo chấp nhận yêu cầu không đồng nghĩa email đã vào inbox. Kiểm tra Spam và Transactional logs nếu thư chưa tới. Lỗi provider/timeout trả 503; quá hạn mức trả 429; OTP không hợp lệ trả 401; thiếu cấu hình tắt nút và trả 503 khi gọi gửi/xác minh.
- Dữ liệu OTP cũ hơn 1 ngày được dọn khi có yêu cầu gửi hợp lệ tiếp theo; ngân sách giữ tối đa khoảng 7 ngày bằng cùng cơ chế. Không phải tác vụ dọn định kỳ.

## Kiểm thử

```powershell
# backend/
npm run lint
npm test -- --runInBand auth
node scripts/test-email-otp.cjs
node scripts/test-firebase-auth.cjs

# web/
node tests/email-otp.smoke.mjs
node tests/firebase-auth.smoke.mjs
```

Kiểm thử OTP tích hợp dùng HTTP/PostgreSQL thật, schema OTP tạm riêng; mock duy nhất việc gửi thư. Kiểm tra mã sai/hết hạn/dùng lại, giới hạn, lỗi gửi, gửi/xác minh đồng thời và đăng nhập giữ đúng vai trò/điểm. Browser dùng HTTP fixture để kiểm tra giao diện, lỗi gửi/mã sai, thời hạn, cooldown, chuyển trang theo vai trò, phiên đăng nhập và màn hình nhỏ.

Chưa gửi email thật hoặc đăng nhập Google thật do môi trường thiếu Brevo sender/key và cấu hình Firebase. Sau khi điền cấu hình, tự nhập email của bạn ở trang đăng nhập, nhận mã thật và xác minh để kiểm tra đầu cuối.
