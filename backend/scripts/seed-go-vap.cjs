// Additive, repeatable local demo. All shops are fictional; coordinates are illustrative.
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Client } = require('pg');
const catalog = [
  ['Cơm Tấm Nắng Gò Vấp', 'com', 10.8350, 106.6740, [['Cơm sườn bì chả',55000],['Cơm sườn trứng',48000],['Cơm gà nướng',50000],['Canh rong biển',12000],['Trà tắc',15000]]],
  ['Phở Sớm Gò Vấp', 'bun-pho', 10.8370, 106.6720, [['Phở bò tái',50000],['Phở tái nạm',60000],['Phở gà',45000],['Bún bò Huế',55000],['Nước suối',10000]]],
  ['Cà Phê Hiên Nhà', 'ca-phe', 10.8390, 106.6700, [['Cà phê đen đá',22000],['Cà phê sữa đá',28000],['Bạc xỉu',32000],['Cà phê muối',35000],['Bánh croissant',30000]]],
  ['Trà Sữa Mây Nhỏ', 'do-uong', 10.8410, 106.6685, [['Trà sữa truyền thống',30000],['Trà sữa ô long',35000],['Trà đào cam sả',35000],['Trà vải',32000],['Sữa tươi trân châu đường đen',38000]]],
  ['Ăn Vặt Ghé Chơi', 'an-vat', 10.8430, 106.6665, [['Bánh tráng trộn',25000],['Bánh tráng cuốn',30000],['Khoai tây chiên',25000],['Cá viên chiên',30000],['Combo ăn vặt',65000]]],
  ['Bún Nhà Gò Vấp', 'bun-pho', 10.8450, 106.6645, [['Bún thịt nướng',40000],['Bún chả giò',40000],['Bún nem nướng',45000],['Bún đặc biệt',60000],['Chả giò thêm',20000]]],
  ['Cơm Gà Vườn Nhỏ', 'com', 10.8415, 106.6745, [['Cơm gà xối mỡ',45000],['Cơm gà luộc',45000],['Cơm gà sốt mắm',50000],['Cơm chiên gà',55000],['Canh rau củ',12000]]],
  ['Nước Ép Lá Xanh', 'do-uong', 10.8385, 106.6770, [['Nước ép cam',35000],['Nước ép ổi',28000],['Nước ép dưa hấu',28000],['Sinh tố bơ',40000],['Sinh tố xoài',35000]]],
];
const shopId = i => `ab670000-0000-4000-8000-${String(i+1).padStart(12,'0')}`;
async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Local demo only');
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('demo-go-vap-v1'))");
    const owner = (await client.query('SELECT id FROM users WHERE email=$1 AND role=$2', ['merchant.1817369@example.com','merchant'])).rows[0];
    if (!owner) throw new Error('Demo merchant account not found');
    let addedShops=0, addedItems=0;
    for (const [i,[name,category,lat,lng,items]] of catalog.entries()) {
      const id=shopId(i);
      const old=(await client.query('SELECT "ownerId",source FROM restaurants WHERE id=$1',[id])).rows[0];
      if(old && (old.ownerId!==owner.id || old.source!=='demo')) throw new Error('Seed ID collision');
      const inserted=await client.query(`INSERT INTO restaurants (id,name,address,category,"imageUrl",location,"openingHours",active,source,rating,"reviewCount","ownerId")
        VALUES ($1,$2,$3,$4,'/placeholder-food.svg',ST_SetSRID(ST_MakePoint($5,$6),4326)::geography,'06:00-22:00',true,'demo',0,0,$7) ON CONFLICT (id) DO NOTHING`,
        [id,name+' (Demo)',`Điểm demo ${i+1}, khu vực Gò Vấp, TP.HCM — vị trí minh họa, không phải quán kinh doanh thật`,category,lng,lat,owner.id]);
      addedShops+=inserted.rowCount;
      for(const [j,[item,price]] of items.entries()) {
        const itemId=`ab671000-0000-4000-8000-${String(i*100+j+1).padStart(12,'0')}`;
        const oldItem=(await client.query('SELECT "restaurantId" FROM menu_items WHERE id=$1',[itemId])).rows[0];
        if(oldItem && oldItem.restaurantId!==id) throw new Error('Menu ID collision');
        addedItems+=(await client.query(`INSERT INTO menu_items (id,"restaurantId",name,price,description,available,"imageUrl") VALUES ($1,$2,$3,$4,$5,true,'/placeholder-food.svg') ON CONFLICT (id) DO NOTHING`,[itemId,id,item,price,'Món demo dùng để thử đặt hàng và thanh toán tiền mặt.'])).rowCount;
      }
    }
    await client.query('COMMIT');
    for(const [i,[name,,, ,items]] of catalog.entries()) {
      const response=await fetch('http://127.0.0.1:3000/api/restaurants/'+shopId(i));
      const data=await response.json();
      if(!response.ok || data.menuItems?.length!==items.length) throw new Error('API verification failed: '+name);
    }
    console.log(JSON.stringify({addedShops,addedItems,verifiedShops:catalog.length,owner:'merchant.1817369@example.com'}));
  } catch(e) {await client.query('ROLLBACK'); throw e;} finally {await client.end();}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
