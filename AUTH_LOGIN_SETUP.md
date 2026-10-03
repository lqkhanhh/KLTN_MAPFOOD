# Đăng nhập Google, Apple và số điện thoại

> Luồng đăng nhập mới nhất: [mật khẩu + OTP email, giữ phiên trên thiết bị](./AUTH_PASSWORD_OTP_FLOW.md). Google không yêu cầu OTP email bổ sung.

> Cập nhật: giao diện hiện dùng **Google + OTP qua email Brevo**, theo yêu cầu mới. Xem [BREVO_EMAIL_OTP_SETUP.md](./BREVO_EMAIL_OTP_SETUP.md) để cấu hình. Phần Apple/Phone bên dưới ghi lại tích hợp backend trước đó; các nút này đã được bỏ khỏi trang đăng nhập hiện tại. Hướng dẫn Google/Firebase vẫn áp dụng.

Đã tích hợp trên **web React và backend NestJS**. Đăng nhập email/mật khẩu tiếp tục hoạt động. Ứng dụng Flutter chưa có giao diện đăng nhập Firebase trong đợt này.

## Bật dịch vụ

1. Vào [Firebase Console](https://console.firebase.google.com/), tạo/chọn project và thêm ứng dụng Web. Không bắt buộc tạo Firestore.
2. Trong Project settings → General → ứng dụng Web, lấy `apiKey`, `authDomain`, `projectId`, `appId`.
3. Trong Authentication → Sign-in method, bật từng phương thức cần dùng:
   - **Google:** chọn email hỗ trợ của project.
   - **Phone:** bật xác thực điện thoại, cấu hình SMS region policy cho Việt Nam, kiểm tra billing/hạn mức SMS trong Console. Giao diện hiện nhận số di động Việt Nam và chuẩn hóa `09…` sang `+849…`.
   - **Apple:** cần cấu hình Apple Developer (App ID hỗ trợ Sign in with Apple, Services ID, Team ID, Key ID và khóa riêng). Nhập các thông tin này vào cấu hình Apple của Firebase. Đăng ký Return URL `https://PROJECT_ID.firebaseapp.com/__/auth/handler` hoặc handler của authDomain tùy chỉnh. Không đưa khóa Apple lên web.
4. Trong Authentication → Settings → Authorized domains, thêm tên miền web sử dụng. Dùng HTTPS và tên miền được cho phép để kiểm thử OTP thật; tài liệu Firebase nêu `localhost` không được hỗ trợ làm hosted domain cho phone auth. Đừng mặc định việc Google đăng nhập được ở local có nghĩa SMS cũng hoạt động ở đó.
5. Backend cần Application Default Credentials. Khi chạy local: Project settings → Service accounts → Generate new private key, lưu file ngoài thư mục `web`, ví dụ `D:/KLTN_MAPFOOD/secrets/firebase-service-account.json`. Không commit hoặc gửi file khóa qua chat. Môi trường Google Cloud có thể dùng service account gắn với workload thay cho file.

Hướng dẫn nhà cung cấp: [Google](https://firebase.google.com/docs/auth/web/google-signin), [Phone/reCAPTCHA](https://firebase.google.com/docs/auth/web/phone-auth), [Apple](https://firebase.google.com/docs/auth/web/apple), [Admin SDK](https://firebase.google.com/docs/admin/setup).

## Biến môi trường

Thêm vào **`backend/.env`**; tất cả giá trị phải thuộc cùng một Firebase project:

```dotenv
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_WEB_API_KEY=your-firebase-web-api-key
FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
FIREBASE_WEB_APP_ID=1:your-project-number:web:your-app-id
GOOGLE_APPLICATION_CREDENTIALS=D:/KLTN_MAPFOOD/secrets/firebase-service-account.json
AUTH_GOOGLE_ENABLED=true
AUTH_APPLE_ENABLED=false
AUTH_PHONE_ENABLED=false
```

Bật Apple/Phone bằng `true` sau khi cấu hình xong từng nhà cung cấp. Khóa Google Maps/Routes không thay thế cấu hình Firebase. API `/api/auth/providers` chỉ công khai cấu hình Web và trạng thái bật/tắt; không trả service account, private key hay JWT secret.

Khi triển khai lên tên miền thật, cập nhật `window.ROUTEBITE_CONFIG.apiBase` trong `web/index.html` thành địa chỉ HTTPS của backend. Không để `127.0.0.1:3000` cho người dùng từ máy khác. Static server hiện phục vụ trên loopback; có thể dùng reverse proxy HTTPS trước nó. Không đặt bất kỳ file bí mật nào trong thư mục web.

Dùng Node.js 22 trở lên (máy hiện tại đang chạy Node.js 24; Firebase Admin SDK 14 yêu cầu Node.js ≥22). Chạy từ từng thư mục:

```powershell
cd D:\KLTN_MAPFOOD\backend
npm install
npm run migration:run
npm run build
npm run start:prod
```

```powershell
cd D:\KLTN_MAPFOOD\web
npm install
npm run build
npm start
```

Nếu server đã chạy, khởi động lại sau khi đổi `.env`; không chạy thêm tiến trình trùng cổng. Trên máy hiện tại migration `AddFirebaseIdentity1789200000000` đã được áp dụng.

## Hành vi tài khoản

- Google/Apple mở popup. Điện thoại yêu cầu đồng ý nhận SMS, reCAPTCHA, nhập OTP 6 số; gửi lại sau 60 giây. Việc phát/gia hạn OTP và hạn mức SMS do Firebase quản lý.
- Backend dùng Admin SDK `verifyIdToken(token, true)` để kiểm tra token và trạng thái thu hồi, chỉ chấp nhận Google/Apple/Phone đã bật, yêu cầu xác thực mới trong 5 phút. Email Google/Apple phải được xác minh; OTP phải có số điện thoại chuẩn trong token. Không chấp nhận Firebase Auth Emulator.
- Sau xác minh, backend cấp access/refresh token RouteBite như đăng nhập mật khẩu; điều hướng theo vai trò trong database. Tài khoản mới luôn là khách hàng.
- Danh tính gắn với Firebase UID duy nhất. Không tìm hoặc gộp tài khoản bằng số điện thoại liên hệ tự nhập trong Hồ sơ.
- Nếu email đã tồn tại: đăng nhập bằng mật khẩu → Hồ sơ → Phương thức đăng nhập → nhập mật khẩu hiện tại → xác minh Google/Apple/OTP để liên kết. Đơn hàng, vai trò và điểm vẫn thuộc tài khoản cũ. Không tự gộp hai tài khoản đã tồn tại hoặc thay thế danh tính đã liên kết.
- Hiện mỗi tài khoản liên kết một Firebase UID; chưa có màn hình thêm nhiều danh tính Firebase khác nhau, hủy liên kết hoặc đặt mật khẩu cho tài khoản chỉ dùng nhà cung cấp.
- Tài khoản điện thoại không có email dùng địa chỉ kỹ thuật `…@identity.routebite.invalid` để tương thích schema hiện tại. Đây không phải hộp thư và không được dùng gửi mail. Hồ sơ hiển thị “Chưa cung cấp email”. Không tạo mật khẩu mặc định.
- Phiên RouteBite có vòng đời riêng (access 15 phút, refresh 30 ngày). Thu hồi phiên Firebase được kiểm tra khi đổi Firebase token lấy phiên mới; không tự động chấm dứt các JWT RouteBite đã cấp.
- Giới hạn exchange/link: 20 lần/phút/IP trên từng tiến trình. Khi chạy nhiều backend cần rate limit chung ở reverse proxy/gateway. Định cấu hình proxy tin cậy chính xác; không tin `X-Forwarded-For` từ mọi nguồn.

## Kiểm thử đã chạy

```powershell
# backend/
npm run lint
npm test -- --runInBand auth
node scripts/test-firebase-auth.cjs
node scripts/test-profile.cjs

# web/
node tests/firebase-auth.smoke.mjs
```

- 18 unit tests xác thực và đổi mật khẩu: lỗi token, thu hồi/hết hạn, provider bị tắt, thiếu cấu hình, token giả lập, email chưa xác minh, thời gian xác thực, rate limit.
- Script Firebase dùng HTTP và PostgreSQL thật, thay riêng bộ xác minh bên ngoài bằng fixture: đăng nhập mới/lặp/đồng thời, Google/Apple/Phone, refresh, cấm gộp theo contact phone, liên kết cần mật khẩu, giữ role và points. Tài khoản tạm được dọn sau test.
- Browser test chạy source giao diện thật với SDK adapter giả lập trong bundle chỉ dành cho test: cấu hình thiếu, mật khẩu, điều hướng 3 vai trò, popup bị đóng, email trùng, OTP sai/đúng/gửi lại, liên kết, viewport 320/375/1440.
- Script Hồ sơ kiểm tra lưu tên/số điện thoại qua API và trình duyệt thật.
- Tổng bộ unit backend không gồm thanh toán: 60 tests / 8 suites đều đạt. Browser Material 3 cũng đạt cho trang đăng nhập và các vai trò ở 320/375/1440px.

**Chưa kiểm chứng OAuth/SMS thật:** môi trường hiện tại chưa có cấu hình Firebase/Apple. Các test không gửi SMS, không dùng tài khoản Google/Apple thật. Sau cấu hình, cần thử trên tên miền được phép: Google popup, Apple (kể cả Hide My Email), OTP sai/đúng/hết hạn, đăng nhập lại tài khoản đã liên kết. Có thể dùng test phone numbers được đăng ký trong Firebase Console trước khi gửi SMS thật; không hardcode OTP vào ứng dụng.
