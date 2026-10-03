# Giao diện Material Design 3

Web triển khai theme Material 3 bằng CSS trên các component React/native HTML hiện có, không sử dụng thư viện MUI hoặc thay chúng bằng Material Web custom elements. Flutter dùng component Material gốc với `useMaterial3: true` và `ColorScheme.fromSeed`.

## Hệ thống giao diện

- `material3.css` nạp cuối trong index.html, áp dụng qua `html[data-design="material3"]`.
- Màu primary #9B432B, nền #FFFAF5; primary/secondary/tertiary container và các cấp surface được đặt bằng token `--md-sys-color-*`.
- Alias `--color-*` và `--rb-*` kết nối component cũ với theme. Các CSS cũ vẫn giữ cấu trúc layout; appearance chung nằm ở material3.css.
- Be Vietnam Pro 400/500/600/700 cho nội dung và điều khiển; Lora 600 cho tiêu đề hero/giới thiệu/đăng nhập. Font được lưu trong web/fonts và mobile/assets/fonts kèm giấy phép OFL; không cần Google Fonts CDN.
- Button filled/outlined/tonal/text, chip danh mục, active navigation container, drawer, outlined field, card, dialog, menu, chat sheet và FAB AI.
- Biểu tượng SVG nội bộ trong MaterialIcon.tsx, không phụ thuộc tải font icon. Icon trang trí có aria-hidden, giữ nguyên tên truy cập của liên kết.
- Motion 180ms, hỗ trợ prefers-reduced-motion; focus-visible có viền rõ; trạng thái disabled riêng.
- Responsive: customer navigation chia 4 cột trên màn hình nhỏ; drawer merchant/admin chuyển sang hàng có thể cuộn ngang; form đăng nhập và tìm tuyến co giãn.

## Phạm vi

Theme dùng chung cho khách, merchant, admin, đối tác, yêu thích, giỏ/đơn, đánh giá, xu/voucher, chat/thông báo và AI. Nội dung dữ liệu và màu mang nghĩa trạng thái lỗi/thành công vẫn được phân biệt.

Flutter: thiết kế lại đăng nhập, tìm tuyến, danh sách/chi tiết quán; sửa lỗi cú pháp có sẵn để phân tích/test widget được. Checkout mobile chưa được triển khai, nút thể hiện rõ trạng thái sắp có thay vì nút không phản hồi.

## Kiểm tra

- `npm run build`
- `node tests/material3.smoke.mjs`: 5 màn hình × 3 kích thước, kiểm tra token/overflow/lỗi runtime, ảnh tại `test-results/material3/`.
- Các smoke test nghiệp vụ hiện có. Test giỏ thay kỳ vọng mô tả hero một dòng bằng tự xuống dòng không bị cắt; test hover tài khoản chờ transition hoàn tất.
- Trong mobile: `flutter analyze`, `flutter test`.

Nguồn thiết kế: https://m3.material.io/styles/color/roles và https://developer.android.com/codelabs/m3-design-theming.

## Nh?n di?n RouteBite

B?ng m?u ??t nung, kem ?m v? xanh l? nh?t; hero c? n?n chuy?n s?c nh?, ti?u ?? ??m, th? qu?n c? b?ng m?m v? ?nh ph?ng nh? khi hover. ? th?ng k? ph?n bi?t b?ng n?n kem/xanh. Hi?u ?ng ?nh t?n tr?ng prefers-reduced-motion. Flutter d?ng c?ng m?u seed #9B432B.
