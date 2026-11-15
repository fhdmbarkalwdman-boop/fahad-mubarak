// End-to-end UI smoke test: drives the real app (web target) against a local
// Supabase stack. Usage:
//   supabase start && npx expo start --web --port 8081
//   NODE_PATH=$(npm root -g) node tests/e2e-web.cjs [screenshotDir]
const { chromium, devices } = require('playwright');
const { execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');

const APP = process.env.APP_URL || 'http://localhost:8081';
const { url: SUPABASE_URL, serviceKey: SERVICE_KEY, dbUrl: DB_URL } = require('./local-env.cjs')();
const OUT = process.argv[2] || 'e2e-shots';
const sql = (q) => execFileSync('psql', [DB_URL, '-tAc', q], { encoding: 'utf8' }).trim();
const email = `e2e-${Date.now()}@fahdar.test`;

(async () => {
  require('node:fs').mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'ar-SA' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('response', async (r) => {
    if (r.url().includes('/rpc/') && r.status() >= 400) console.log('RPC', r.status(), r.url().split('/rpc/')[1], (await r.text()).slice(0, 200));
  });
  const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png` });
  const inputs = () => page.locator('input, textarea');
  const step = (s) => console.log('•', s);

  step('home as guest');
  await page.goto(APP);
  await page.getByText('أفكارك تبدأ من هنا').first().waitFor();
  await page.getByText('لم تُنشر مشاريع بعد.').waitFor();
  await shot('01-home-guest');

  step('guarded action redirects to sign-in');
  await page.getByText('اطلب مشروعاً برمجياً').click();
  await page.getByText('سجّل الدخول للمتابعة').waitFor();
  await shot('02-sign-in');

  step('sign up');
  await page.getByText('إنشاء حساب', { exact: true }).last().click();
  await page.getByText('تأكيد كلمة المرور').waitFor();
  await inputs().nth(0).fill('سارة أحمد');
  await inputs().nth(1).fill(email);
  await inputs().nth(2).fill('Strong-pass-123');
  await inputs().nth(3).fill('Strong-pass-123');
  await shot('03-sign-up');
  await page.getByRole('button', { name: 'إنشاء حساب' }).click();

  step('new project request');
  await page.getByText('وصف الفكرة').waitFor({ timeout: 15000 });
  await inputs().nth(0).fill('تطبيق حجوزات');
  await inputs().nth(1).fill('تطبيق جوال لإدارة حجوزات العيادات مع تذكيرات تلقائية للمرضى.');
  await page.getByText('تطبيق جوال', { exact: true }).click();
  await page.getByText('Android', { exact: true }).click();
  await page.getByText('iOS', { exact: true }).click();
  await shot('04-request-form');
  await page.getByRole('button', { name: 'إرسال الطلب' }).click();
  await page.waitForTimeout(2500);
  await shot('04b-after-submit');
  await page.getByText('تم إرسال طلبك بنجاح').waitFor({ timeout: 15000 });
  const number = await page.getByText(/^FHD-\d{2}-\d{5}$/).first().textContent();
  assert.match(number, /^FHD-\d{2}-\d{5}$/);
  await shot('05-request-created');

  step('send a message on the request');
  await page.getByPlaceholder('اكتب رسالة…').fill('هل يمكن إضافة لوحة تحكم للعيادة؟');
  await page.getByLabel('إرسال').click();
  await page.getByText('هل يمكن إضافة لوحة تحكم للعيادة؟').waitFor();

  step('start consultation (quota 2/month)');
  await page.goto(`${APP}/consultation/new`);
  await page.getByText('المتبقي هذا الشهر: 2 من 2').waitFor({ timeout: 15000 });
  await page.getByText('قواعد البيانات', { exact: true }).click();
  await inputs().nth(0).fill('اختيار قاعدة بيانات');
  await inputs().nth(1).fill('هل أستخدم PostgreSQL أم MongoDB لتطبيق حجوزات؟');
  await shot('06-consultation-form');
  await page.getByRole('button', { name: 'بدء الاستشارة' }).click();
  await page.getByText('رسائلك المتبقية: 4 من 5').waitFor({ timeout: 15000 });
  await page.getByPlaceholder('اكتب رسالة…').fill('ولدي حوالي 10 آلاف مستخدم.');
  await page.getByLabel('إرسال').click();
  await page.getByText('رسائلك المتبقية: 3 من 5').waitFor({ timeout: 15000 });
  await shot('07-consultation-chat');

  step('notifications list');
  await page.goto(`${APP}/notifications`);
  await page.getByText('تم استلام طلبك').waitFor({ timeout: 15000 });
  await shot('08-notifications');

  step('non-owner cannot open admin');
  await page.goto(`${APP}/admin`);
  await page.getByText('هذه الصفحة مخصصة للمالك فقط.').waitFor({ timeout: 15000 });

  step('sign out, then sign in as a separate owner account (role granted via SQL only)');
  await page.goto(`${APP}/account`);
  await page.locator('text=تسجيل الخروج >> visible=true').first().click();
  await page.locator('text=أهلاً بك في فهدار >> visible=true').first().waitFor({ timeout: 15000 });
  const ownerEmail = `owner-${Date.now()}@fahdar.test`;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ownerEmail, password: 'Owner-pass-123', email_confirm: true, user_metadata: { full_name: 'فهد مبارك' } }),
  });
  assert.equal(res.status, 200);
  sql(`select private.promote_to_owner('${ownerEmail}')`);
  await page.goto(`${APP}/auth/sign-in`);
  await inputs().nth(0).fill(ownerEmail);
  await inputs().nth(1).fill('Owner-pass-123');
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click();
  await page.waitForURL((u) => !u.pathname.includes('sign-in'), { timeout: 15000 });
  await page.goto(`${APP}/admin`);
  await page.getByText('إجمالي الطلبات').waitFor({ timeout: 15000 });
  await shot('09-admin-dashboard');

  step('owner replies to consultation and changes request status');
  await page.goto(`${APP}/admin/consultations`);
  await page.locator('text=اختيار قاعدة بيانات >> visible=true').first().click();
  await page.getByPlaceholder('اكتب رسالة…').waitFor({ timeout: 15000 });
  await page.getByPlaceholder('اكتب رسالة…').fill('PostgreSQL مناسب جداً هنا مع فهارس جيدة.');
  await page.getByLabel('إرسال').click();
  await page.locator('text=PostgreSQL مناسب جداً هنا مع فهارس جيدة. >> visible=true').waitFor({ timeout: 15000 });
  await page.locator('text=تم الرد >> visible=true').first().waitFor({ timeout: 15000 });
  await page.goto(`${APP}/admin/requests`);
  await page.locator(`text=${number} >> visible=true`).first().click();
  await page.getByText('تغيير الحالة').waitFor({ timeout: 15000 });
  await page.locator('text=قيد المراجعة >> visible=true').last().click();
  await page.locator('text=/تم تغيير الحالة إلى: قيد المراجعة/ >> visible=true').first().waitFor({ timeout: 15000 });
  await shot('10-admin-request');

  step('owner adds and publishes a project');
  await page.goto(`${APP}/admin/project-edit`);
  await page.getByText('صورة الغلاف').first().waitFor({ timeout: 15000 });
  await inputs().nth(0).fill('مشروع تجريبي للاختبار');
  await inputs().nth(2).fill('ملخص قصير لمشروع اختبار آلي');
  await inputs().nth(8).fill('اختبار');
  await inputs().nth(9).fill('Expo, Supabase');
  await page.getByRole('switch').first().click();
  await page.getByRole('button', { name: 'حفظ' }).click();
  await page.locator('text=مشروع جديد >> visible=true').first().waitFor({ timeout: 15000 });
  await page.goto(`${APP}/projects`);
  await page.locator('text=مشروع تجريبي للاختبار >> visible=true').first().waitFor({ timeout: 15000 });
  await shot('11-projects');

  step('dark mode');
  await ctx.close();
  const dark = await browser.newContext({ ...devices['iPhone 13'], locale: 'ar-SA', colorScheme: 'dark' });
  const dp = await dark.newPage();
  await dp.goto(APP);
  await dp.getByText('مشروع تجريبي للاختبار').first().waitFor({ timeout: 15000 });
  await dp.screenshot({ path: `${OUT}/12-home-dark.png` });

  await browser.close();
  // clean up the test project so no test data stays visible
  sql(`delete from public.projects where title = 'مشروع تجريبي للاختبار'`);
  if (errors.length) {
    console.error('Page errors:', errors);
    process.exit(1);
  }
  console.log('E2E OK —', number);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
