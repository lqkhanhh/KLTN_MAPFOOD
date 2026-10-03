import { initializeApp, getApps } from 'firebase/app';
import { getAuth, inMemoryPersistence, setPersistence, GoogleAuthProvider, OAuthProvider, signInWithPopup, RecaptchaVerifier, signInWithPhoneNumber, signOut } from 'firebase/auth';
import { request } from '../api';

export async function prepareAuth() {
  const settings = await request('/auth/providers', { authorized: false });
  if (!settings.config || !Object.values(settings.providers || {}).some(Boolean)) return { providers: settings.providers || {}, auth: null };
  const app = getApps().find(app => app.name === 'routebite-auth') || initializeApp(settings.config, 'routebite-auth');
  const auth = getAuth(app);
  auth.languageCode = 'vi';
  await setPersistence(auth, inMemoryPersistence);
  return { providers: settings.providers, auth };
}

export function providerPopup(auth, name) {
  const provider = name === 'google' ? new GoogleAuthProvider() : new OAuthProvider('apple.com');
  if (name === 'google') provider.setCustomParameters({ prompt: 'select_account' });
  else { provider.addScope('email'); provider.addScope('name'); provider.setCustomParameters({ locale: 'vi_VN' }); }
  return signInWithPopup(auth, provider);
}

export function normalizePhone(value) {
  const cleaned = value.replace(/[\s().-]/g, '');
  const normalized = cleaned.startsWith('0') ? '+84' + cleaned.slice(1) : cleaned;
  if (!/^\+84[35789]\d{8}$/.test(normalized)) throw new Error('Nhập số di động Việt Nam hợp lệ, ví dụ 0901234567.');
  return normalized;
}

export function createCaptcha(auth, element) { return new RecaptchaVerifier(auth, element, { size: 'normal' }); }
export function sendPhoneCode(auth, phone, verifier) { return signInWithPhoneNumber(auth, phone, verifier); }
export async function clearFirebaseSession(auth) { if (auth) await signOut(auth).catch(() => {}); }

export function authError(error) {
  const messages = {
    'auth/popup-closed-by-user': 'Bạn đã đóng cửa sổ đăng nhập. Có thể thử lại bất cứ lúc nào.',
    'auth/cancelled-popup-request': 'Yêu cầu đăng nhập đã bị hủy. Vui lòng thử lại.',
    'auth/popup-blocked': 'Trình duyệt đang chặn cửa sổ đăng nhập. Hãy cho phép cửa sổ bật lên rồi thử lại.',
    'auth/account-exists-with-different-credential': 'Email này dùng phương thức đăng nhập khác. Vui lòng đăng nhập bằng phương thức ban đầu.',
    'auth/invalid-verification-code': 'Mã OTP không đúng. Vui lòng kiểm tra lại tin nhắn.',
    'auth/code-expired': 'Mã OTP đã hết hạn. Vui lòng gửi mã mới.',
    'auth/session-expired': 'Phiên xác minh đã hết hạn. Vui lòng gửi mã mới.',
    'auth/too-many-requests': 'Bạn đã thử quá nhiều lần. Vui lòng đợi trước khi thử lại.',
    'auth/quota-exceeded': 'Dịch vụ SMS đã hết hạn mức. Vui lòng dùng phương thức đăng nhập khác.',
    'auth/captcha-check-failed': 'Xác minh reCAPTCHA chưa thành công. Vui lòng thử lại.',
    'auth/invalid-phone-number': 'Số điện thoại không hợp lệ.',
    'auth/unauthorized-domain': 'Tên miền này chưa được cấu hình để đăng nhập. Vui lòng liên hệ quản trị viên.',
    'auth/operation-not-allowed': 'Phương thức đăng nhập chưa được bật tại nhà cung cấp.',
    'auth/network-request-failed': 'Không kết nối được dịch vụ đăng nhập. Kiểm tra mạng và thử lại.',
  };
  return messages[error.code] || (error.code?.startsWith('auth/') ? 'Không thể đăng nhập lúc này. Vui lòng thử lại hoặc dùng email và mật khẩu.' : error.message) || 'Đăng nhập thất bại.';
}
