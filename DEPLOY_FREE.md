# Triển khai RouteBite phục vụ đồ án với gói miễn phí

Chuẩn bị ngày 03/10/2026. Chưa tạo tài nguyên hay công bố website trong tài khoản hosting. Các URL ví dụ phải thay bằng URL Render thực sự cấp. Bộ cấu hình này dành cho demo, giữ VNPAY sandbox; không coi đây là môi trường thu tiền thật.

## Kiến trúc và chi phí

| Phần | Dịch vụ | Lưu ý |
|---|---|---|
| Frontend | Render Static Site Free | HTTPS và tên miền con `*.onrender.com` ổn định khi giữ service |
| Backend | Render Web Service Free | Ngủ sau 15 phút không có traffic, có thể mất khoảng một phút để khởi động |
| PostgreSQL/PostGIS | Neon Free | Kiểm tra hạn mức storage/compute trong dashboard, không nâng gói tự động |
| Google login | Firebase hiện có | Thêm domain frontend mới; không bật SMS cho đồ án |
| Email OTP | Brevo Free hiện có | 300 email/ngày theo tài liệu hiện tại; ứng dụng giới hạn 250, tính cả đăng ký và đăng nhập |
| Ảnh quán/món | Cloudinary hiện có | Kiểm tra gói Free và mức dùng trên tài khoản; hạn chế định dạng, kích thước upload |
| Hồ sơ đối tác | Mã hóa trong PostgreSQL | Dùng dữ liệu giả khi demo, chiếm hạn mức database; giữ khóa mã hóa |
| Thanh toán | VNPAY Sandbox | Không nhận tiền thật |
| AI hỗ trợ | FAQ dự phòng trong ứng dụng | Không cấp ANTHROPIC_API_KEY nếu muốn tránh chi phí gọi model |
| Maps/Routes | Google Maps hiện có | KHÔNG bảo đảm 0 đồng: có billing/hạn mức theo API; quota và giới hạn key là bắt buộc để kiểm soát |

Không mua domain riêng: dùng subdomain nhà cung cấp. Không dùng Render Postgres Free vì database đó hết hạn sau 30 ngày. Free hosting không cam kết chạy liên tục, không phù hợp để bảo đảm nhận IPN thanh toán tiền thật. Mở hệ thống trước buổi bảo vệ, không tạo bot ping chỉ nhằm né giới hạn miễn phí.

## 1. Chuẩn bị GitHub

Repo hiện tại có remote `https://github.com/lqkhanhh/KLTN_MAPFOOD.git`. Cần xác nhận bạn có quyền quản lý và các thay đổi mới đã được push. Có nhiều thay đổi chưa commit; không dùng `git add .` mà chưa rà soát.

Không đưa `.env`, Firebase service account, khóa mã hóa, database dump hoặc thông tin đăng nhập demo lên Git. File `.gitignore` đã loại phần lớn các dữ liệu này; file từng bị track vẫn phải kiểm tra riêng. Chỉ build/publish `web/dist`, tuyệt đối không publish toàn bộ `web/`.

## 2. Tạo database Neon Free

1. Đăng nhập Neon, chọn Free và tạo project `routebite-demo` với PostgreSQL 16 để gần môi trường local.
2. Chọn vùng gần backend nếu có; tạo database và role cho ứng dụng.
3. Trong SQL Editor chạy:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
SELECT PostGIS_Version();
```

4. Trong Connect, lấy **direct connection string**, có TLS (`sslmode=require`, hoặc tùy chọn xác minh được nhà cung cấp hướng dẫn). Không tắt xác minh chứng chỉ để chữa lỗi kết nối. Giữ nguyên các tham số nhà cung cấp cấp.
5. Dùng URL này cho DATABASE_URL. Với bản demo đơn instance, direct connection tránh thay đổi ngữ nghĩa transaction/advisory lock do pooler; chưa cấu hình pooler riêng.

Không gửi connection string vào chat hoặc đưa lên Git. Không chạy seed đăng ký tài khoản qua API một cách tự động vì có thể gửi OTP Brevo. Cần chọn riêng cách tạo dữ liệu demo sau khi DB khởi tạo.

## 3. Backend trên Render Free

Có thể kết nối repo qua Blueprint `render.yaml`, hoặc tạo thủ công New > Web Service:

| Trường | Giá trị |
|---|---|
| Root Directory | `backend` |
| Runtime | Node |
| Instance | Free |
| Build Command | `npm ci --include=dev && npm run build` |
| Start Command | `npm run migration:run:prod && npm run start:prod` |
| Health Check | `/api/docs` |

Migration chạy trước khi mở server, bằng JavaScript đã biên dịch. Free service không có pre-deploy job/shell như gói trả phí. Chỉ dùng một instance; không bật auto-sync schema. Khi có migration mới phải backup trước deploy. Blueprint không tạo database trả phí.

Backend env:

```dotenv
NODE_ENV=production
NODE_VERSION=22.16.0
DATABASE_URL=<NEON_DIRECT_CONNECTION_STRING>
DB_SYNCHRONIZE=false
DB_MIGRATIONS_RUN=false
JWT_ACCESS_SECRET=<SECRET_RIENG>
JWT_REFRESH_SECRET=<SECRET_RIENG_KHAC>
EMAIL_OTP_SECRET=<SECRET_IT_NHAT_32_KY_TU>
MERCHANT_DOCUMENT_ENCRYPTION_KEY=<64_KY_TU_HEX>
PAYMENT_PROVIDER=VNPAY
VNPAY_TMN_CODE=<MA_SANDBOX>
VNPAY_HASH_SECRET=<KHOA_SANDBOX>
VNPAY_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
VNPAY_RETURN_URL=https://<FRONTEND_THUC_TE>.onrender.com/payment/vnpay-return
AUTH_EMAIL_OTP_ENABLED=true
BREVO_API_KEY=<KHOA_BREVO>
BREVO_SENDER_EMAIL=<NGUOI_GUI_DA_XAC_MINH>
BREVO_SENDER_NAME=RouteBite
EMAIL_OTP_DAILY_LIMIT=250
AUTH_GOOGLE_ENABLED=true
AUTH_APPLE_ENABLED=false
AUTH_PHONE_ENABLED=false
FIREBASE_PROJECT_ID=<PROJECT_HIEN_TAI>
FIREBASE_WEB_API_KEY=<WEB_KEY_CUNG_PROJECT>
FIREBASE_AUTH_DOMAIN=<PROJECT>.firebaseapp.com
FIREBASE_WEB_APP_ID=<WEB_APP_ID>
GOOGLE_APPLICATION_CREDENTIALS=/etc/secrets/firebase-service-account.json
GOOGLE_ROUTES_API_KEY=<KEY_ROUTES_BACKEND>
```

Trong Render > Environment > Secret Files, tạo `firebase-service-account.json` bằng nội dung file credential riêng hiện có. Không upload file này vào repo. Nếu chưa tạo secret file, Google login backend chưa hoạt động dù có public config.

Blueprint sinh khóa JWT/OTP cho môi trường mới. Riêng khóa mã hóa tài liệu phải giữ nguyên nếu nhập dữ liệu hồ sơ đã mã hóa từ local. Nếu DB hoàn toàn mới, tạo khóa 32 byte dưới dạng 64 ký tự hex. Secret manager/Render env giữ khóa qua các lần restart; không dựa vào file local trên Render.

## 4. Frontend tĩnh trên Render Free

New > Static Site, cùng repo:

| Trường | Giá trị |
|---|---|
| Root Directory | `web` |
| Build Command | `npm ci && npm run build:deploy` |
| Publish Directory | `dist` |
| PUBLIC_API_BASE | `https://<BACKEND_THUC_TE>.onrender.com/api` |
| GOOGLE_MAPS_BROWSER_KEY | Browser key giới hạn theo domain frontend |

Rewrite `/*` -> `/index.html` (Rewrite, không phải Redirect) để các trang `/orders/...`, `/login` và `/payment/vnpay-return` mở trực tiếp được. Blueprint đã có rule.

Build script tạo `maps-config.json`, copy CSS/fonts và bundle; không cần chạy `web/server.js`. Không đổi .env local sang Neon. Cấu hình HTML local vẫn giữ; build tạo HTML riêng với API deployment.

Sau khi biết URL frontend thực sự, cập nhật VNPAY_RETURN_URL trên backend rồi redeploy backend. PUBLIC_API_BASE là build-time: thay đổi cần rebuild web. Không dùng tên giả định trong file này nếu Render cấp tên có hậu tố khác.

## 5. Dịch vụ ngoài

- Firebase: thêm hostname frontend (không https/path) vào Authentication > Settings > Authorized domains. Giữ đồng bộ project của web config và service account.
- Brevo: giữ sender đã xác minh; không cần mua domain chỉ để demo nếu sender hiện tại gửi được. Theo dõi cả quota ứng dụng và quota tài khoản. Backend dùng HTTPS API, không dùng SMTP bị Render Free chặn.
- Maps: thêm domain Render vào HTTP referrer restrictions của browser key; backend key chỉ cho Routes API và IP outbound phù hợp hạ tầng nếu áp dụng. Xác định quota theo từng API/SKU hiện dùng, đặt giới hạn request và theo dõi billing. Budget alert chỉ báo, không tự chặn chi phí. Nếu yêu cầu tuyệt đối không có billing thì cần đổi nhà cung cấp bản đồ/tuyến đường ở một bước riêng, không âm thầm đổi thành đường chim bay.
- Cloudinary: hiện web có public cloud name và unsigned upload preset. Kiểm tra gói miễn phí/hạn mức, giới hạn upload; không đặt API secret trong web. Backup database chỉ chứa liên kết, không chứa bản sao ảnh Cloudinary.
- Hồ sơ đối tác hiện lưu bytea mã hóa trong DB, không nằm trên ổ đĩa Render. Dung lượng hồ sơ làm tăng dung lượng DB; chỉ demo tài liệu giả.

## 6. VNPAY sandbox trên URL cố định

Đăng ký/cập nhật IPN với VNPAY:

```text
https://<BACKEND_THUC_TE>.onrender.com/api/payments/vnpay-ipn
```

Return URL:

```text
https://<FRONTEND_THUC_TE>.onrender.com/payment/vnpay-return
```

IPN cần được cấu hình ở VNPAY/SIT, không tự đăng ký khi đổi .env. Mở backend trước khi thử thanh toán để tránh cold start. Nếu IPN bị trễ/thất bại, không tự đánh dấu paid dựa trên URL trình duyệt. Việc endpoint trả 97 khi mở không có chữ ký chỉ xác nhận endpoint đang chạy.

## 7. Sao lưu miễn phí

Cài PostgreSQL client `pg_dump` (version >= server, nên cùng major). Lưu connection string Neon trong `backend/.env.deploy` đã gitignore, chỉ cần DATABASE_URL. Từ thư mục gốc:

```powershell
node backend/scripts/backup-database.cjs backend/.env.deploy
```

Script tạo dump custom và SHA256 trong `backups/`, không in URL/password. Chạy trước migration, sau khi tạo đủ dữ liệu demo và trước buổi bảo vệ. Copy sang nơi riêng ngoài laptop (ổ lưu trữ cá nhân có kiểm soát truy cập), giữ vài phiên bản. Không commit hoặc upload công khai. Không đặt dump trên Render Free vì mất khi restart.

Đây là backup thủ công; chưa thiết lập lịch tự động. Có thể cấu hình Windows Task Scheduler sau khi chốt nơi lưu secret, máy phải bật khi đến lịch. Không bảo đảm backup chỉ vì script tồn tại.

Kiểm tra phục hồi vào **database thử riêng hoàn toàn mới** bằng pg_restore, không restore đè DB demo đang dùng. Truyền thông tin kết nối qua PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE và PGSSLMODE ở môi trường terminal riêng; chạy `pg_restore --no-owner --no-acl --exit-on-error --dbname=<ten_db_test> <file.dump>`. Kiểm tra extensions, số lượng bảng/đơn/quán và giải mã hồ sơ bằng đúng khóa. Kiểm tra ảnh Cloudinary riêng. Lưu khóa mã hóa tách khỏi dump.

## 8. Kiểm thử trước bảo vệ

- Sau khi tắt laptop, web vẫn mở, API vẫn trả dữ liệu từ Neon.
- Đăng ký OTP, đăng nhập OTP, Google, refresh phiên và đăng xuất.
- Khách: tìm tuyến thực tế, quán/món, giỏ, voucher, đặt đơn, theo dõi đơn.
- Quán/admin: phân quyền, cập nhật trạng thái, chat và thông báo Socket.IO.
- VNPAY: thành công, hủy, thất bại, IPN trùng, chữ ký sai, số tiền sai, IPN đến sau trang return, thanh toán thử lại.
- Refresh trực tiếp các trang con, kiểm tra Maps key trên domain mới.
- Redeploy/restart backend rồi kiểm tra dữ liệu và hồ sơ còn nguyên.
- Restore thử bản backup vào DB riêng.

Chưa có kết quả kiểm thử trên Render/Neon nếu chưa tạo tài khoản, deploy và cấp các URL thực tế.

## 9. Đối soát, hoàn tiền và production

Hiện mã nguồn có kiểm chữ ký/số tiền, chống lặp, giữ lịch sử lần thử; giao dịch trả tiền lần nữa được gắn cờ đối soát. **Chưa có API querydr/refund và màn hình đối soát/hoàn tiền đầy đủ.** Không coi thao tác đổi enum thành REFUNDED là ngân hàng đã hoàn tiền.

Với đồ án: mô tả/test các tình huống này trên sandbox, đối chiếu Merchant Admin, không thu tiền thật. Nếu triển khai querydr/refund tiếp cần endpoint xác thực admin, tham chiếu transactionNo, số tiền hoàn, chống lặp và lưu kết quả ngân hàng; cần kiểm thử với tài khoản sandbox đã cấu hình SIT.

Bước chuyển VNPAY production là tùy chọn sau đồ án: cần VNPAY kích hoạt merchant/điều kiện hợp tác, khóa production, đối soát/hoàn tiền hoàn chỉnh và backend ổn định. Không nằm trong cam kết miễn phí của hosting. Không đổi VNPAY_URL thành production trong bản demo này.

## Nguồn chính thức

- https://render.com/docs/free
- https://render.com/docs/blueprint-spec
- https://neon.com/pricing
- https://neon.com/docs/extensions/postgis
- https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan
- https://developers.google.com/maps/billing-and-pricing/manage-costs
- https://sandbox.vnpayment.vn/apis/docs/thanh-toan-pay/pay.html
