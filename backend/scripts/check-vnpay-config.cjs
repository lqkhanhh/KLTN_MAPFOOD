// Chỉ in tình trạng cấu hình, không in khóa bí mật hoặc liên kết có chữ ký.
const fs = require('node:fs');
const path = require('node:path');
const env = require('dotenv').parse(fs.readFileSync(path.join(__dirname, '../.env')));
for (const key of ['VNPAY_TMN_CODE', 'VNPAY_HASH_SECRET', 'VNPAY_RETURN_URL', 'VNPAY_URL']) {
  const value = env[key] || '';
  console.log(key, { configured: !!value, length: value.length, whitespace: value !== value.trim(), placeholder: /your|xxx|placeholder/i.test(value) });
}
