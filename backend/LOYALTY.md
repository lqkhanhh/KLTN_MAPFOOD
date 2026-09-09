# Xu và voucher

- Xu chỉ cộng khi chuyển đơn sang `COMPLETED` và đơn đã thanh toán. Đơn tiền mặt được ghi nhận đã thanh toán lúc hoàn thành.
- Công thức: `floor(totalAmount / 100000)` với `totalAmount` là tiền sau giảm giá. Không cộng bù đơn cũ; không chuyển xu thành tiền mặt.
- Bảng đổi: 1 xu → 1.000đ (đơn từ 10.000đ); 5 xu → 5.000đ (đơn từ 50.000đ); 10 xu → 10.000đ (đơn từ 100.000đ).
- Một đơn dùng tối đa một voucher. Voucher tiêu thụ khi tạo đơn thành công, không tự hoàn khi hủy. Một voucher công khai được nhận một lần/tài khoản; voucher đổi xu có thể đổi nhiều lần nếu đủ xu.
- Không có hạn dùng/giới hạn tổng lượt trong phiên bản này. Admin có thể tắt voucher; voucher tắt không dùng hoặc đổi/nhận được nữa.
- Giảm % làm tròn đến đồng; giảm tối đa bằng tạm tính. Đơn 0đ được ghi `PAID`, báo quán ngay, không tạo giao dịch VNPAY.
- Backend khóa số dư khi đổi; khóa voucher sở hữu khi áp dụng; cộng xu cùng transaction hoàn thành đơn. Ledger có unique index chống cộng hai lần cho một đơn.

## API (prefix `/api`, JWT bắt buộc)

| API | Quyền / chức năng |
| --- | --- |
| GET `/points/me` | Customer: số dư và lịch sử giao dịch của chính mình |
| GET `/vouchers/available` | Customer: voucher đang hoạt động |
| GET `/vouchers/my-vouchers` | Customer: voucher đã nhận/đổi, bao gồm đã dùng |
| POST `/vouchers/:id/redeem` | Customer: trừ xu, cấp một voucher |
| POST `/vouchers/:id/claim` | Customer: nhận voucher miễn phí, lặp yêu cầu không cấp trùng |
| POST `/orders` | Thêm `userVoucherId?` vào payload; không nhận tiền giảm từ client |
| GET/POST `/admin/vouchers` | Admin: liệt kê/phát hành voucher miễn phí |
| PATCH `/admin/vouchers/:id` | Admin: `{ active: boolean }`; không sửa điều kiện đã phát hành |

Trang khách `/my-points` và ô chọn voucher trong giỏ; trang Admin `/admin/vouchers`.

## Migration và kiểm thử

Chạy trong backend: `npm run build`, `npm run migration:run`, `node scripts/test-loyalty.cjs`.
Test tạo fixture riêng trong database đã cấu hình và tự xóa fixture; không dùng tài khoản thật, không gọi thanh toán thật.
Chạy trong web (server 4173 đang mở): `npm run build`, `node tests/loyalty.smoke.mjs`.
Test giao diện dùng API giả; backend integration kiểm tra giá gửi provider bằng adapter giả.
