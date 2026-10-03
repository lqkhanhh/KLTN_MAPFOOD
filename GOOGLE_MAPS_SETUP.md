# Google Maps và tính đường ghé quán

## Cấu hình

Hiện môi trường local chưa có khóa. Bản đồ và tìm đường thực tế cần project Google Cloud bật billing và các API dưới đây. Không đưa khóa server vào frontend hoặc commit .env.

1. **Backend:** bật **Routes API**. Đặt `GOOGLE_ROUTES_API_KEY` trong `backend/.env`. Dùng khóa giới hạn API Routes và IP server khi triển khai. `GOOGLE_MAPS_API_KEY` cũ chỉ là alias dự phòng cho khóa server; cũng phải bật Routes API.
2. **Web:** bật **Maps JavaScript API** và **Geocoding API**. Copy `web/.env.example` thành `web/.env`, đặt `GOOGLE_MAPS_BROWSER_KEY`. Giới hạn khóa theo HTTP referrer, ví dụ `http://127.0.0.1:4173/*`, `http://localhost:4173/*` và domain triển khai. Đây là khóa công khai theo thiết kế của Google, không dùng chung với khóa backend.
3. Khởi động lại backend và web. Web server đọc `web/.env` bằng Node `process.loadEnvFile` (Node 20.12+; môi trường hiện tại Node 24). Endpoint `/maps-config.json` chỉ trả khóa browser. Khi host web tĩnh, đặt `window.ROUTEBITE_CONFIG.googleMapsApiKey` bằng khóa browser.

Map dùng Advanced Markers với `DEMO_MAP_ID` cho local; khi triển khai nên tạo Map ID riêng. Việc gõ tìm địa điểm hiện dùng Google Geocoding sau debounce 450 ms, tối đa 5 kết quả, không dùng Places Autocomplete. Không cần bật Places API cho bản này.

## Cách tính

- Gửi `POST /api/search/route` với pointA/pointB, `radius` (100–5000 m, mặc định 500 m), `travelMode` (`DRIVE` hoặc `TWO_WHEELER`).
- Google Routes Compute Routes lấy tuyến gốc A → B. Dùng polyline HIGH_QUALITY để PostGIS lọc quán đang hoạt động trong hành lang địa lý quanh tuyến, bỏ quán bị đình chỉ.
- Chọn tối đa **12 quán gần tuyến theo địa lý**, không phải tìm tối ưu trên toàn bộ quán trong thành phố. Response `truncated` cho biết còn ứng viên ngoài giới hạn.
- Với từng ứng viên, gọi Routes với intermediate stop để tính **A → quán → B**, cùng phương tiện và `TRAFFIC_UNAWARE`.
- `detourDistanceMeters = max(0, distanceVia − distanceBase)`; `detourDurationSeconds = max(0, durationVia − durationBase)`. Xếp tăng dần thời gian đi thêm, rồi khoảng cách đi thêm. Giá trị âm do tuyến thay thế được hiển thị là 0, nghĩa là không tăng so với tuyến gốc.
- UI phân biệt khoảng cách địa lý tới tuyến và quãng đường chạy xe đi thêm. Có bản đồ tuyến gốc, nút xem tuyến ghé từng quán và quay lại tuyến gốc.
- Thời gian là ước tính di chuyển **không xét giao thông realtime**, không bao gồm thời gian chuẩn bị món, chờ/lấy món hay đỗ xe. Chế độ xe máy cần Google hỗ trợ cho khu vực và project sử dụng; lỗi sẽ được thông báo, không tự đổi sang ô tô.
- Tối đa 13 yêu cầu Routes cho một tìm kiếm (1 tuyến gốc + 12 quán), tối đa 3 yêu cầu ứng viên đồng thời và 3 tìm kiếm đồng thời mỗi process. Timeout 10 giây mỗi request. Cần đặt quota/budget và rate limit ở gateway trước khi mở dịch vụ công khai.
- Thiếu key hoặc tuyến gốc lỗi: trả 503/502, **không fallback đường chim bay**. Một số quán lỗi: bỏ khỏi xếp hạng và trả cảnh báo; tất cả đường ghé lỗi: trả 502.

## Kiểm chứng

- Backend: `npm test -- --runInBand search.service.spec` kiểm tra thứ tự xếp hạng, waypoint, phương tiện, lỗi/mất key, giới hạn 12 ứng viên và validation.
- Web: `node tests/google-routes.smoke.mjs` dùng SDK double, kiểm tra địa điểm/chọn điểm/phương tiện/polyline gốc và ghé quán/responsive/mất key.
- Các test địa điểm, route-summary, explore-favorites đã chuyển fixture từ Leaflet/Nominatim sang Google SDK double. Những kết quả đó không chứng minh Maps/Geocoding/Routes thật đã hoạt động.
- Integration admin/suspension vẫn chạy PostGIS thật; chỉ provider đường đi được giả lập.

Chưa kiểm thử end-to-end bằng Google thật do môi trường thiếu khóa và billing. Thanh toán và đăng nhập Google/Apple/OTP không thuộc thay đổi này. Mobile tiếp tục gọi backend tìm tuyến; bản đồ Google trong thay đổi này áp dụng cho web.

Tài liệu chính thức: [Compute Routes](https://developers.google.com/maps/documentation/routes/compute_route_directions), [Load Maps JavaScript API](https://developers.google.com/maps/documentation/javascript/load-maps-js-api).
