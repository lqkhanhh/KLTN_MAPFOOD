# Đăng ký đối tác Merchant

Frontend: `/partner/register`, liên kết từ trang đăng nhập. Người dùng tạo tài khoản Customer hoặc đăng nhập tài khoản có sẵn. Ba bước: thông tin quán → CCCD hai mặt/giấy phép KD/VSATTP + ngân hàng → đọc văn bản và tick ba xác nhận. Không có checkbox được chọn sẵn.

Trạng thái: DRAFT → SUBMITTED → APPROVED hoặc REJECTED. Hồ sơ bị từ chối được sửa/gửi lại. Hồ sơ chờ duyệt/đã duyệt không thể sửa giấy tờ. Khi duyệt, transaction tạo một quán và cấp role merchant; duyệt lặp không tạo quán trùng. Refresh token cũ bị vô hiệu hóa, người dùng đăng nhập lại. Không đổi quyền của Merchant/Admin có sẵn.

## API

- GET `/api/merchant-applications/terms`: văn bản và phiên bản hiện hành, public.
- GET/PUT `/api/merchant-applications/me`: đọc/lưu hồ sơ riêng, JWT.
- PUT `/api/merchant-applications/me/bank`: thông tin ngân hàng, JWT.
- POST `/api/merchant-applications/me/documents/:kind`: multipart `file`, JWT; kind: identity_front, identity_back, business_license, food_safety.
- POST `/api/merchant-applications/me/submit`: termsVersion và agreements.accuracy/terms/documentReview đều phải true.
- GET `/api/merchant-applications/:id/documents/:documentId`: chỉ chủ hồ sơ hoặc Admin, tải file đính kèm, không cache.
- GET `/api/admin/merchant-applications`: lọc status, page, limit (tối đa 100).
- GET `/api/admin/merchant-applications/:id`: chi tiết riêng tư cho Admin.
- PATCH `/api/admin/merchant-applications/:id/approve`: cấp quyền và tạo quán.
- PATCH `/api/admin/merchant-applications/:id/reject`: reason 5–500 ký tự sau khi trim.
- POST `/api/auth/upgrade-to-merchant`: không còn tự nâng quyền Customer.

## Bảo vệ hồ sơ

Nội dung tài liệu và tài khoản ngân hàng được mã hóa AES-256-GCM trong database. API danh sách chỉ có metadata, không có file/ngân hàng. File không được đưa lên Cloudinary hay thư mục web công khai. Backend giới hạn 5 MB/file và kiểm tra MIME cùng magic bytes (JPG/PNG/PDF).

Khóa lấy từ MERCHANT_DOCUMENT_ENCRYPTION_KEY (64 ký tự hex), hoặc file riêng `backend/.merchant-documents.key` đã gitignore. Không tự sinh lại/ghi đè khóa khi có hồ sơ. **Mất khóa sẽ không đọc được hồ sơ đã mã hóa.** Sao lưu khóa trong nơi quản lý bí mật, tách khỏi database; khi triển khai phải chuyển khóa qua kênh bảo mật. Không đưa khóa, file `.env` hay giấy tờ thật vào Git.

Kiểm tra loại file không thay thế quét mã độc. Trước khi thu hồ sơ thật trên Internet cần rà soát quyền vận hành, HTTPS, rate limit/quota upload, quét mã độc, nhật ký truy cập giấy tờ, chính sách lưu/xóa dữ liệu và sao lưu khóa. Không mở rộng endpoint tải file thành public.

## Phạm vi điều khoản

`src/merchant-applications/terms.ts` là văn bản tạm thời, không phải hợp đồng đã ký điện tử hoặc bằng chứng xác thực danh tính. API chỉ lưu các xác nhận, phiên bản và thời gian gửi. Không có phí/hoa hồng hoặc điều khoản thanh toán thương mại tự đặt. Tích hợp dịch vụ ký và văn bản chính thức là công việc riêng trước khi ký hợp đồng thật.

## Kiểm thử

- `node scripts/test-merchant-applications.cjs`: Nest + Postgres thật, tài khoản/giấy tờ tự tạo, xóa fixture sau test; không dùng giấy tờ thật.
- Từ web: `node tests/partner-registration.smoke.mjs`: trình duyệt với API giả lập, xác nhận luồng đăng ký, upload, checkbox, Admin từ chối/duyệt, đăng nhập theo role.
