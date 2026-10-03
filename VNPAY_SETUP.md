# Thanh toán VNPAY

## URL demo ngày 01/10/2026

- Website: `https://wishes-includes-collapse-treasures.trycloudflare.com`
- Backend API: `https://hung-recipes-inch-compliance.trycloudflare.com/api`
- Return URL: `https://wishes-includes-collapse-treasures.trycloudflare.com/payment/vnpay-return`
- IPN URL đăng ký với VNPAY: `https://hung-recipes-inch-compliance.trycloudflare.com/api/payments/vnpay-ipn`

Các URL này chỉ hoạt động khi hai tunnel đang chạy; cập nhật lại nếu tạo tunnel mới. IPN trả mã `97` khi mở trực tiếp không có chữ ký là bình thường, chưa chứng minh thanh toán thành công. Cần đăng ký IPN với VNPAY, không chỉ khai báo trong `.env`.

Đã triển khai tạo liên kết thanh toán, trang kết quả, IPN xác thực HMAC SHA512, kiểm tra số tiền từ đơn hàng, chống xử lý lặp và lưu từng lần thử thanh toán.

## Cấu hình sandbox

Đăng ký tài khoản thử nghiệm tại https://sandbox.vnpayment.vn/devreg/ và lấy thông tin merchant do VNPAY cấp. Điền vào `backend/.env`:

```dotenv
PAYMENT_PROVIDER=VNPAY
VNPAY_TMN_CODE=<ma-website-8-ky-tu>
VNPAY_HASH_SECRET=<chuoi-bi-mat-do-vnpay-cap>
VNPAY_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
VNPAY_RETURN_URL=http://127.0.0.1:4173/payment/vnpay-return
```

Không đưa HASH_SECRET vào web/mobile hoặc Git. Khởi động lại backend sau khi đổi cấu hình.

IPN URL đăng ký với VNPAY: `https://<backend-cong-khai>/api/payments/vnpay-ipn` (GET). Backend localhost không thể nhận IPN từ VNPAY; cần backend HTTPS công khai hoặc đường hầm HTTPS tới cổng 3000. Không chỉ thêm biến môi trường IPN: phải đăng ký URL này với VNPAY. Nếu đặt reverse proxy, cấu hình địa chỉ khách qua proxy tin cậy trước khi dùng production.

Return URL là trang web để khách quay về, không phải URL IPN. Khi triển khai dùng domain HTTPS của frontend. Backend vẫn có GET `/api/payments/vnpay-return` để xác minh kết quả, nhưng endpoint này chỉ đọc trạng thái và không cập nhật tiền.

## Chạy và kiểm tra

```powershell
cd backend
npm run migration:run
npm run build
node scripts/check-vnpay-config.cjs
npm run start:prod
```

Ở terminal khác chạy `cd web`, `npm run build`, `npm start`. Đặt đơn chọn VNPAY, thanh toán bằng thông tin thử nghiệm trong tài liệu VNPAY, quay về trang kết quả. Kiểm tra IPN trả `RspCode: 00`, đơn đã thanh toán; gửi lặp trả `02`. Chữ ký sai trả `97`, số tiền sai trả `04`, không thấy giao dịch trả `01`, lỗi xử lý trả `99`.

Nếu ngân hàng đã trừ tiền nhưng IPN chưa tới, trang kết quả chờ khoảng một phút rồi hướng khách kiểm tra đơn. Không báo thành công chỉ dựa trên tham số URL. Khi thử lại, mỗi giao dịch cũ vẫn được giữ để nhận IPN trễ. Trường hợp nhiều lần thử cùng trả tiền được đánh dấu `providerPayload.reconciliationRequired` để đối soát; chưa có hoàn tiền tự động hoặc giao diện xử lý đối soát. Đơn đã hủy nhận IPN thành công vẫn ghi nhận tiền, nhưng không phát đơn mới cho quán.

## Phạm vi kiểm thử

Các kiểm thử tự động dùng chữ ký/dữ liệu giả lập và không thực hiện giao dịch ngân hàng. Chưa xác minh thanh toán trọn luồng trên VNPAY nếu chưa có TMN_CODE, HASH_SECRET và IPN công khai. Production cần thông tin merchant production và hoàn tất kiểm thử với VNPAY, không dùng thông tin sandbox để thu tiền thật.

Tài liệu chính thức: [Tích hợp thanh toán VNPAY](https://sandbox.vnpayment.vn/apis/docs/thanh-toan-pay/pay.html).
