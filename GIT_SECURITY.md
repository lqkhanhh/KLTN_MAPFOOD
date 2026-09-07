# Giữ bí mật khi dùng Git

`.gitignore` loại file môi trường thật, khóa, tài khoản seed, tài liệu private, database backup, log, dependencies và dist. Chỉ commit `.env.example` chứa placeholder. `web/app.js` vẫn được giữ vì static server hiện dùng trực tiếp bundle này.

## Kiểm tra trước khi commit

```powershell
node scripts/check-git-secrets.cjs
git diff --cached --stat
```

Script kiểm tra snapshot đã stage: đường dẫn bị cấm, một số định dạng khóa phổ biến và việc copy nhầm bí mật local vào mã nguồn. Không in giá trị bí mật. Không phải công cụ phát hiện mọi loại secret.

Hooks trong `.githooks` đã có pre-commit/pre-push. Sau khi clone máy khác, chạy:

```powershell
git config core.hooksPath .githooks
```

Pre-push kiểm tra HEAD, không kiểm tra mọi commit cũ/nhánh khác. Hooks local có thể bị bỏ qua, không thay thế kiểm tra trên dịch vụ Git/CI. Không dùng `git add -f` để ép thêm file bí mật.

## Lịch sử đã commit

`backend/.env` đã xuất hiện trong lịch sử của repository này. `git rm --cached` chỉ gỡ khỏi commit tiếp theo, không xóa phiên bản cũ. Nếu lịch sử đó đã được push/chia sẻ, coi các bí mật còn hiệu lực trong đó là có nguy cơ lộ: thay mật khẩu database, JWT secrets và khóa dịch vụ liên quan. Thay JWT secrets sẽ yêu cầu đăng nhập lại. Cần rà soát và phối hợp trước khi viết lại lịch sử/force-push; không tự rewrite lịch sử của cả nhóm.

Không tự đổi/xóa `.merchant-documents.key`: khóa này dùng đọc hồ sơ đã mã hóa, mất khóa sẽ mất khả năng giải mã. Khóa đã được gitignore, cần sao lưu riêng qua kênh quản lý bí mật. Tương tự, file tài khoản seed chỉ giữ local, không gửi kèm source.

## Trước khi đưa hệ thống lên Internet

Không dùng tài khoản mẫu cho production. Không đưa nguyên thư mục dự án vào thư mục static public. Dùng secret manager hoặc biến môi trường của nơi triển khai, không chép khóa vào React, bundle, Dockerfile hay script CI.
