import { ServiceUnavailableException } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { readFileSync } from 'fs';
import { resolve } from 'path';

function key() {
  let value = process.env.MERCHANT_DOCUMENT_ENCRYPTION_KEY;
  if (!value) {
    try { value = readFileSync(resolve(__dirname, '../../.merchant-documents.key'), 'utf8').trim(); } catch { /* Không tự tạo khóa thay thế làm mất khả năng đọc hồ sơ cũ. */ }
  }
  if (!value || !/^[a-fA-F0-9]{64}$/.test(value)) throw new ServiceUnavailableException('Chưa cấu hình khóa bảo vệ hồ sơ đối tác.');
  return Buffer.from(value, 'hex');
}
export function encryptPrivate(content: Buffer): Buffer {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key(), iv);
  const encrypted = Buffer.concat([cipher.update(content), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]);
}
export function decryptPrivate(content: Buffer): Buffer {
  const decipher = createDecipheriv('aes-256-gcm', key(), content.subarray(0, 12));
  decipher.setAuthTag(content.subarray(12, 28));
  return Buffer.concat([decipher.update(content.subarray(28)), decipher.final()]);
}
