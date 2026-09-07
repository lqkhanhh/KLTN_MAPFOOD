# Ảnh quán và món ăn

Trong `web/index.html`, điền hai giá trị công khai của `window.ROUTEBITE_CONFIG`:

```js
cloudinaryCloudName: 'ten-cloud-cua-ban',
cloudinaryUploadPreset: 'ten-preset-unsigned',
```

Tạo preset unsigned trong Cloudinary Console → Settings → Upload. Cấu hình giới hạn JPG/PNG/WebP, tối đa 5 MB ở preset; giới hạn trên trình duyệt chỉ hỗ trợ UX, không thay thế kiểm soát của Cloudinary. Không đặt API secret/API key hoặc thông tin thanh toán vào cấu hình frontend. Theo dõi hạn mức tài khoản và vô hiệu hóa preset khi không dùng.

- Chọn ảnh → xem trước → upload → nhận HTTPS URL; bấm **Lưu thay đổi/Lưu ảnh quán/Tạo quán** để lưu URL vào database.
- Khi chưa cấu hình Cloudinary, có thể nhập URL ảnh HTTP/HTTPS trực tiếp.
- **Bỏ ảnh** chỉ bỏ URL trong form; sau khi lưu sẽ bỏ liên kết trong database, không xóa file trên Cloudinary.
- Nếu upload thất bại, giữ URL đã lưu; không lưu blob URL tạm vào database.
- Ảnh món trong đơn được lấy từ món hiện tại. Nếu món đã bị xóa, đơn cũ vẫn giữ tên/giá/số lượng và dùng ảnh quán hoặc ảnh mặc định.

Tài liệu: https://cloudinary.com/documentation/upload_images#unsigned_upload
