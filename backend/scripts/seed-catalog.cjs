// Thêm dữ liệu mẫu thật vào PostgreSQL, không sửa/xóa bản ghi đã có.
// Xem trước: node scripts/seed-catalog.cjs
// Ghi dữ liệu: node scripts/seed-catalog.cjs --apply
// Kiểm tra API: node scripts/seed-catalog.cjs --verify
const fs = require('node:fs');
const path = require('node:path');
const bcrypt = require('bcrypt');
const { Client } = require('pg');
const env = require('dotenv').parse(fs.readFileSync(path.join(__dirname, '../.env')));
const credentialPath = path.join(__dirname, '../.seed-catalog-accounts.json');
const apply = process.argv.includes('--apply'), verify = process.argv.includes('--verify');
const userId = (role, index) => `db2a0000-0000-4000-8000-${String((role === 'merchant' ? 200 : 100) + index).padStart(12, '0')}`;
const shopId = (index) => `db2b0000-0000-4000-8000-${String(index).padStart(12, '0')}`;
const itemId = (shop, item) => `db2c0000-0000-4000-8000-${String(shop * 100 + item).padStart(12, '0')}`;
const line = 'LINESTRING(106.6991514 10.7792374,106.63995928016547 10.855143404526695)';
const customerNames = ['Nguyễn Minh Anh', 'Trần Gia Huy', 'Lê Bảo Ngọc', 'Phạm Tuấn Khang', 'Võ Thanh Mai'];
const merchantNames = ['Nguyễn Hoàng Phúc', 'Trần Thảo Vy', 'Lê Minh Quân', 'Phạm Ngọc Hà', 'Võ Quốc Bảo', 'Đặng Thu Trang'];
const catalog = [
  { name: 'Cà phê Sáng Phố (Mẫu)', category: 'ca-phe', fraction: .08, hours: '06:30-22:00', menu: [
    ['Cà phê đen đá', 22000, 'Cà phê phin rang đậm, dùng với đá.'], ['Cà phê sữa đá', 28000, 'Cà phê phin và sữa đặc.'], ['Bạc xỉu', 32000, 'Sữa tươi, sữa đặc và cà phê.'], ['Cà phê muối', 35000, 'Cà phê cùng lớp kem muối.'],
    ['Latte nóng', 42000, 'Espresso và sữa nóng.'], ['Trà đào cam sả', 35000, 'Trà đào với cam và sả.'], ['Bánh mì trứng', 25000, 'Bánh mì, trứng ốp la và rau.'], ['Bánh croissant', 30000, 'Bánh sừng bò bơ.'],
  ] },
  { name: 'Cơm Tấm Góc Nhỏ (Mẫu)', category: 'com', fraction: .24, hours: '07:00-21:00', menu: [
    ['Cơm sườn nướng', 45000, 'Cơm tấm, sườn nướng, dưa leo và đồ chua.'], ['Cơm sườn bì chả', 60000, 'Sườn nướng, bì và chả trứng.'], ['Cơm gà nướng', 50000, 'Đùi gà nướng và cơm tấm.'], ['Cơm ba rọi nướng', 48000, 'Ba rọi nướng và rau ăn kèm.'],
    ['Trứng ốp la thêm', 8000, 'Một trứng ốp la.'], ['Chả trứng thêm', 12000, 'Một phần chả trứng.'], ['Canh rong biển', 12000, 'Canh rong biển nấu thịt bằm.'], ['Trà tắc', 15000, 'Trà tắc pha tươi.'],
  ] },
  { name: 'Bún Phở Hẹn Ghé (Mẫu)', category: 'bun-pho', fraction: .41, hours: '06:00-21:30', menu: [
    ['Phở bò tái', 50000, 'Bánh phở, bò tái và nước dùng.'], ['Phở bò chín', 50000, 'Bánh phở và thịt bò chín.'], ['Phở đặc biệt', 65000, 'Bò tái, nạm và bò viên.'], ['Bún bò Huế', 55000, 'Bún bò với giò và rau thơm.'],
    ['Bún thịt nướng', 42000, 'Bún, thịt nướng, rau và nước mắm.'], ['Bún chả giò', 40000, 'Bún tươi và chả giò.'], ['Chả giò thêm', 20000, 'Hai cuốn chả giò.'], ['Nước suối', 10000, 'Chai nước suối 500 ml.'],
  ] },
  { name: 'Trà Nhà Dọc Tuyến (Mẫu)', category: 'do-uong', fraction: .59, hours: '09:00-22:30', menu: [
    ['Trà đào', 30000, 'Trà trái cây vị đào.'], ['Trà vải', 30000, 'Trà với vải và đá.'], ['Trà chanh', 20000, 'Trà chanh tươi.'], ['Trà sữa truyền thống', 32000, 'Trà sữa và trân châu.'],
    ['Trà sữa ô long', 35000, 'Ô long sữa và trân châu.'], ['Sữa tươi đường đen', 38000, 'Sữa tươi cùng trân châu đường đen.'], ['Nước cam', 35000, 'Cam ép dùng với đá.'], ['Trân châu thêm', 5000, 'Một phần trân châu đen.'],
  ] },
  { name: 'Ăn Vặt Ghé Chút (Mẫu)', category: 'an-vat', fraction: .77, hours: '10:00-22:00', menu: [
    ['Bánh tráng trộn', 25000, 'Bánh tráng, xoài, trứng cút và rau răm.'], ['Bánh tráng cuốn', 30000, 'Bánh tráng cuốn với sốt chấm.'], ['Khoai tây chiên', 30000, 'Khoai tây chiên giòn.'], ['Cá viên chiên', 30000, 'Một phần cá viên chiên.'],
    ['Gà viên chiên', 35000, 'Gà viên với sốt chấm.'], ['Xúc xích chiên', 20000, 'Hai cây xúc xích chiên.'], ['Combo ăn vặt', 65000, 'Khoai tây, cá viên và xúc xích.'], ['Trà tắc lớn', 20000, 'Trà tắc ly lớn.'],
  ] },
  { name: 'Cơm Nhà Cuối Tuyến (Mẫu)', category: 'com', fraction: .94, hours: '09:00-20:30', menu: [
    ['Cơm thịt kho trứng', 45000, 'Cơm trắng, thịt kho và trứng.'], ['Cơm cá kho', 45000, 'Cơm trắng, cá kho và rau.'], ['Cơm gà xào sả ớt', 45000, 'Gà xào sả ớt ăn cùng cơm.'], ['Cơm đậu hũ sốt cà', 35000, 'Đậu hũ sốt cà và cơm trắng.'],
    ['Canh chua', 18000, 'Một phần canh chua.'], ['Rau xào tỏi', 20000, 'Rau xanh xào tỏi.'], ['Cơm trắng thêm', 7000, 'Một phần cơm trắng.'], ['Nước sâm', 15000, 'Nước sâm thảo mộc.'],
  ] },
];
const accounts = [
  ...customerNames.map((name, index) => ({ id: userId('customer', index + 1), email: `customer${String(index + 1).padStart(2, '0')}@routebite.local`, role: 'customer', fullName: name + ' (Mẫu)', phone: '00000001' + String(index + 1).padStart(2, '0') })),
  ...merchantNames.map((name, index) => ({ id: userId('merchant', index + 1), email: `merchant${String(index + 1).padStart(2, '0')}@routebite.local`, role: 'merchant', fullName: name + ' (Mẫu)', phone: '00000002' + String(index + 1).padStart(2, '0') })),
];

async function main() {
  if (apply && (process.env.NODE_ENV === 'production' || env.NODE_ENV === 'production')) throw new Error('Không tự nạp tài khoản mẫu vào môi trường production.');
  const credentials = fs.existsSync(credentialPath) ? JSON.parse(fs.readFileSync(credentialPath, 'utf8')).accounts : [];
  const client = new Client({ connectionString: env.DATABASE_URL });
  await client.connect();
  try {
    const counts = async () => (await client.query(`SELECT (SELECT COUNT(*)::int FROM users) AS users, (SELECT COUNT(*)::int FROM restaurants) AS restaurants, (SELECT COUNT(*)::int FROM menu_items) AS menu_items`)).rows[0];
    console.log(JSON.stringify({ mode: apply ? 'apply' : verify ? 'verify' : 'preview', currentCounts: await counts(), planned: { customers: 5, merchants: 6, restaurants: 6, menuItems: 48 }, route: 'Đức Bà → Tân Thới Hiệp (tọa độ mẫu gần tuyến đường thẳng)' }));
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('routebite-catalog-seed-v1'))");
    const inserted = { users: 0, restaurants: 0, menuItems: 0 };
    for (const account of accounts) {
      const found = (await client.query('SELECT id,email,role FROM users WHERE id=$1 OR lower(email)=lower($2)', [account.id, account.email])).rows;
      if (found.length && (found.length !== 1 || found[0].id !== account.id || found[0].email !== account.email || found[0].role !== account.role)) throw new Error('Trùng tài khoản ngoài bộ seed: ' + account.email + '. Dừng, không ghi đè.');
      if (!found.length) {
        inserted.users++;
        if (apply) {
          const credential = credentials.find((item) => item.email === account.email);
          if (!credential || typeof credential.password !== 'string' || credential.password.length < 16) throw new Error('Thiếu thông tin đăng nhập mẫu riêng tư cho ' + account.email);
          await client.query('INSERT INTO users (id,email,"passwordHash","fullName",phone,role) VALUES ($1,$2,$3,$4,$5,$6)', [account.id, account.email, await bcrypt.hash(credential.password, 10), account.fullName, account.phone, account.role]);
        }
      }
    }
    for (const [index, shop] of catalog.entries()) {
      const id = shopId(index + 1), ownerId = userId('merchant', index + 1);
      const existing = (await client.query('SELECT id,"ownerId",source FROM restaurants WHERE id=$1', [id])).rows[0];
      if (existing && (existing.ownerId !== ownerId || existing.source !== 'demo')) throw new Error('UUID quán bị dùng ngoài bộ seed. Dừng, không ghi đè.');
      if (!existing) {
        inserted.restaurants++;
        if (apply) await client.query(`INSERT INTO restaurants (id,name,address,category,"imageUrl",location,"openingHours",active,source,rating,"reviewCount","ownerId")
          VALUES ($1,$2,$3,$4,'/placeholder-food.svg',ST_Project(ST_LineInterpolatePoint(ST_GeomFromText($5,4326),$6)::geography,60,0),$7,true,'demo',0,0,$8)`,
          [id, shop.name, `Vị trí minh họa ${index + 1} trên tuyến Đức Bà – Tân Thới Hiệp, TP.HCM (không phải địa chỉ kinh doanh đã xác minh)`, shop.category, line, shop.fraction, shop.hours, ownerId]);
      }
      for (const [itemIndex, [name, price, description]] of shop.menu.entries()) {
        const menuId = itemId(index + 1, itemIndex + 1);
        const old = (await client.query('SELECT "restaurantId" FROM menu_items WHERE id=$1', [menuId])).rows[0];
        if (old && old.restaurantId !== id) throw new Error('UUID món bị dùng ngoài bộ seed. Dừng, không ghi đè.');
        if (!old) {
          inserted.menuItems++;
          if (apply) await client.query('INSERT INTO menu_items (id,"restaurantId",name,price,description,available,"imageUrl") VALUES ($1,$2,$3,$4,$5,true,$6)', [menuId, id, name, price, 'Món mẫu: ' + description, '/placeholder-food.svg']);
        }
      }
    }
    await client.query(apply ? 'COMMIT' : 'ROLLBACK');
    console.log(JSON.stringify({ [apply ? 'inserted' : 'wouldInsert']: inserted, finalCounts: await counts(), existingRecords: 'unchanged', credentials: 'backend/.seed-catalog-accounts.json (private, ignored by Git)' }));
    if (verify) {
      if (Object.values(inserted).some(Boolean)) throw new Error('Bộ seed chưa đủ dữ liệu, chưa kiểm tra đăng nhập.');
      const base = 'http://127.0.0.1:3000/api';
      for (const account of accounts) {
        const credential = credentials.find((item) => item.email === account.email);
        if (!credential) throw new Error('Thiếu mật khẩu riêng tư cho ' + account.email);
        const response = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: account.email, password: credential.password }) });
        const session = await response.json();
        if (!response.ok || session.user?.role !== account.role || !session.accessToken || 'passwordHash' in session.user) throw new Error('Kiểm tra đăng nhập không thành công: ' + account.email + '. Không tự đặt lại mật khẩu.');
        if (account.role === 'merchant') {
          const mine = await fetch(base + '/restaurants/mine', { headers: { Authorization: 'Bearer ' + session.accessToken } });
          const shops = await mine.json();
          if (!mine.ok || shops.length !== 1 || shops[0].ownerId !== account.id || shops[0].menuItems.length !== 8) throw new Error('Quán/menu chưa khớp với ' + account.email);
        }
      }
      const response = await fetch(base + '/restaurants?limit=100'); const publicList = await response.json();
      if (!response.ok || !catalog.every((_, index) => publicList.data.some((shop) => shop.id === shopId(index + 1)))) throw new Error('Danh sách công khai thiếu quán mẫu.');
      const distance = await client.query(`SELECT max(ST_Distance(location,ST_GeogFromText($1))) AS maximum FROM restaurants WHERE id=ANY($2::uuid[])`, [line, catalog.map((_, i) => shopId(i + 1))]);
      if (Number(distance.rows[0].maximum) > 500) throw new Error('Quán mẫu nằm ngoài phạm vi tuyến đã chọn.');
      console.log('PASS: 11 account logins, correct roles, 6 merchant-owned restaurants with 8 dishes each, public API and route distance <= 500 m. No orders/payments created.');
    }
  } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; }
  finally { await client.end(); }
}
main().catch((error) => { console.error(error.code ? `Seed failed (${error.code}); không ghi đè dữ liệu cũ.` : error.message); process.exitCode = 1; });
