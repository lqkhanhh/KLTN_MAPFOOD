// Dữ liệu minh họa, không đại diện cho quán thật. Không sửa/xóa dữ liệu đã tồn tại.
// Chạy xem trước: node scripts/seed-duc-ba-tan-thoi-hiep.cjs
// Thêm dữ liệu: node scripts/seed-duc-ba-tan-thoi-hiep.cjs --apply
const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');
const env = require('dotenv').parse(fs.readFileSync(path.join(__dirname, '../.env')));
const apply = process.argv.includes('--apply');
// Tọa độ lấy từ lịch sử tìm kiếm hiện có của ứng dụng (hai chiều cùng tuyến).
const start = { latitude: 10.7792374, longitude: 106.6991514 };
const end = { latitude: 10.855143404526695, longitude: 106.63995928016547 };
const line = `LINESTRING(${start.longitude} ${start.latitude},${end.longitude} ${end.latitude})`;
const fixtures = [
  ['Cà phê Điểm Đi (Mẫu)', 'ca-phe', 0.04, [['Cà phê sữa đá', 25000], ['Bạc xỉu', 30000], ['Bánh mì trứng', 25000]]],
  ['Cơm tấm Tiện Đường (Mẫu)', 'com', 0.22, [['Cơm sườn bì chả', 55000], ['Cơm gà nướng', 50000], ['Trà tắc', 15000]]],
  ['Bún Phở Ghé Lấy (Mẫu)', 'bun-pho', 0.40, [['Phở bò', 55000], ['Bún bò Huế', 50000], ['Nước suối', 10000]]],
  ['Trà trái cây Giữa Tuyến (Mẫu)', 'do-uong', 0.59, [['Trà đào cam sả', 35000], ['Trà vải', 30000], ['Nước cam', 30000]]],
  ['Ăn vặt Điểm Dừng (Mẫu)', 'an-vat', 0.78, [['Bánh tráng trộn', 25000], ['Khoai tây chiên', 30000], ['Cá viên chiên', 30000]]],
  ['Cơm nhà Tân Thới Hiệp (Mẫu)', 'com', 0.96, [['Cơm thịt kho trứng', 45000], ['Cơm cá kho', 45000], ['Canh rau', 15000]]],
];

async function main() {
  const client = new Client({ connectionString: env.DATABASE_URL });
  await client.connect();
  try {
    const owner = (await client.query('SELECT id FROM users WHERE email=$1 AND role=$2', ['merchant@routebite.local', 'merchant'])).rows[0];
    if (!owner) throw new Error('Không tìm thấy tài khoản merchant mẫu; dừng, không tự sửa tài khoản khác.');
    console.log({ apply, route: 'Nhà thờ Đức Bà → Tân Thới Hiệp 29', routeType: 'straight-line-fallback', restaurants: fixtures.length, menuItems: 18 });
    await client.query('BEGIN');
    let restaurantCount = 0; let menuCount = 0;
    for (const [index, [name, category, fraction, menu]] of fixtures.entries()) {
      const id = `db290000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`;
      const point = (await client.query(`SELECT ST_AsText(ST_Project(ST_LineInterpolatePoint(ST_GeomFromText($1,4326),$2)::geography,80,0)) AS wkt`, [line, fraction])).rows[0].wkt;
      const distance = (await client.query('SELECT round(ST_Distance(ST_GeogFromText($1),ST_GeogFromText($2))) AS meters', [point, line])).rows[0].meters;
      if (distance > 500) throw new Error('Điểm mẫu nằm ngoài phạm vi 500m; dừng toàn bộ.');
      if (apply) {
        const inserted = await client.query(`INSERT INTO restaurants (id,name,address,category,"imageUrl",location,"openingHours",active,source,rating,"reviewCount","ownerId")
          VALUES ($1,$2,$3,$4,$5,ST_GeogFromText($6),'00:00-23:59',true,'demo',0,0,$7) ON CONFLICT (id) DO NOTHING RETURNING id`,
          [id, name, `Điểm dừng mẫu ${index + 1} trên tuyến Nhà thờ Đức Bà – Tân Thới Hiệp 29, TP.HCM (dữ liệu demo)`, category, '/placeholder-food.svg', point, owner.id]);
        restaurantCount += inserted.rowCount;
        // Không thêm món vào một bản ghi khác nếu UUID đã được sử dụng ngoài bộ seed này.
        const existing = (await client.query('SELECT name,source,"ownerId" FROM restaurants WHERE id=$1', [id])).rows[0];
        if (existing.name !== name || existing.source !== 'demo' || existing.ownerId !== owner.id) throw new Error('UUID bị trùng dữ liệu ngoài bộ mẫu; đã rollback.');
        for (const [menuIndex, [itemName, price]] of menu.entries()) {
          const itemId = `db291000-0000-4000-8000-${String((index + 1) * 100 + menuIndex + 1).padStart(12, '0')}`;
          const result = await client.query(`INSERT INTO menu_items (id,name,price,description,available,"restaurantId") VALUES ($1,$2,$3,$4,true,$5) ON CONFLICT (id) DO NOTHING`,
            [itemId, itemName, price, 'Món mẫu để kiểm thử giỏ hàng và đặt món ghé lấy.', id]);
          menuCount += result.rowCount;
        }
      }
      console.log({ id, name, distanceMeters: Number(distance), menuItems: menu.length });
    }
    await client.query(apply ? 'COMMIT' : 'ROLLBACK');
    console.log({ insertedRestaurants: restaurantCount, insertedMenuItems: menuCount, existingData: 'preserved' });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    // Không in chuỗi kết nối hoặc thông tin nhạy cảm từ lỗi driver.
    console.error({ error: error.code || (error instanceof Error ? error.message : 'Seed failed') });
    process.exitCode = 1;
  } finally { await client.end(); }
}
main().catch((error) => { console.error({ error: error.code || 'Database connection failed' }); process.exitCode = 1; });
