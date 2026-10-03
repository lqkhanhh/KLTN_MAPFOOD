// Replaces only the Firebase SDK adapter in the test bundle, never in app.js.
import { request } from '../src/api';
export { normalizePhone, authError } from '../src/utils/firebaseAuth';
export async function prepareAuth() {
  const settings = await request('/auth/providers', { authorized: false });
  return { providers: settings.providers, auth: settings.config ? {} : null };
}
const credential = token => ({ user: { getIdToken: async () => token } });
export async function providerPopup(_auth, provider) {
  window.__providerCalls = [...(window.__providerCalls || []), provider];
  if (window.__popupError) throw { code: window.__popupError };
  return credential(provider + '-verified-fixture');
}
export function createCaptcha() { return { clear() {} }; }
export async function sendPhoneCode(_auth, phone) {
  window.__sentPhone = phone;
  return { confirm: async code => {
    if (code !== '123456') throw { code: 'auth/invalid-verification-code' };
    return credential('phone-verified-fixture');
  } };
}
export async function clearFirebaseSession() { window.__firebaseSignedOut = true; }
