require('reflect-metadata'); require('dotenv').config();
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { chromium } = require('../../web/node_modules/playwright');
const ds = require('../dist/database/data-source').default;
const { User } = require('../dist/database/entities');
async function main() {
  await ds.initialize(); let browser; const ids=[];
  const api = async (path, token, method='GET', body) => {
    const r=await fetch('http://127.0.0.1:3000/api'+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});
    return {status:r.status,data:await r.json()};
  };
  try {
    const account=async()=>{const r=await api('/auth/register',null,'POST',{email:`profile-${randomUUID()}@example.com`,password:randomUUID(),fullName:'Profile Test'});assert.equal(r.status,201);ids.push(r.data.user.id);return r.data;};
    const a=await account(), b=await account();
    assert.equal((await api('/auth/profile',null)).status,401);
    for(const body of [{fullName:' ',phone:'0901234567'},{fullName:'Valid',phone:'123'},{fullName:'Valid',phone:'0901234567',role:'admin'},{fullName:'Valid',phone:'0901234567',id:b.user.id},{fullName:'Valid',phone:'0901234567',email:'other@example.com'}]) assert.equal((await api('/auth/profile',a.accessToken,'PATCH',body)).status,400);
    const updated=await api('/auth/profile',a.accessToken,'PATCH',{fullName:' Updated Customer ',phone:'+84 901 234 567'});
    assert.equal(updated.status,200);assert.equal(updated.data.phone,'+84901234567');assert.equal(updated.data.fullName,'Updated Customer');
    assert.equal(updated.data.passwordHash,undefined);assert.equal(updated.data.refreshTokenHash,undefined);assert.equal(updated.data.role,'customer');
    assert.equal((await api('/auth/profile',b.accessToken)).data.fullName,'Profile Test');
    browser=await chromium.launch({channel:'msedge'});const page=await browser.newPage();
    await page.goto('http://127.0.0.1:4173');await page.evaluate(session=>{localStorage.setItem('routebite_access_token',session.accessToken);localStorage.setItem('routebite_user',JSON.stringify(session.user));},a);
    await page.goto('http://127.0.0.1:4173/profile');
    await page.waitForFunction(()=>document.querySelector('input[autocomplete="name"]')?.value==='Updated Customer');
    await page.getByLabel('Họ và tên',{exact:true}).fill('Khách hàng cập nhật');
    await page.getByLabel('Số điện thoại',{exact:true}).fill('0912345678');
    await page.getByRole('button',{name:'Lưu thay đổi'}).click();await page.getByRole('status').filter({hasText:'Đã lưu hồ sơ'}).waitFor();
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('routebite_user')).phone),'0912345678');
    await page.reload();await page.waitForFunction(()=>document.querySelector('input[type="tel"]')?.value==='0912345678');
    for(const width of [320,375,1440]) {await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
    console.log('PASS: profile auth/validation/isolation/protected fields, normalized phone, safe response, real browser save/session/reload/responsive.');
  } finally {await browser?.close();for(const id of ids)await ds.getRepository(User).delete(id);await ds.destroy();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
