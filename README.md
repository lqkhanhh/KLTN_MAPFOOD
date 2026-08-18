# RouteBite Backend

Backend NestJS cho ứng dụng tìm quán ăn tiện đường và đặt món mang đi.

## Chạy dự án

```powershell
Copy-Item .env.example .env
docker compose up -d db
cd backend
npm install
npm run start:dev
```

Mở Swagger tại `http://localhost:3000/api/docs`.

## Luồng demo thanh toán

Khi `PAYOS_CLIENT_ID` chưa được cấu hình, `POST /payments/create` trả về QR VietQR demo.
Gửi `POST /payments/webhook` với `{"orderCode":"...","status":"PAID"}` để mô phỏng callback.
