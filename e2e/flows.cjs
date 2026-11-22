// End-to-end check against a running app on a freshly seeded database:
//   npm run seed -- --force && npm run dev
//   BASE_URL=http://localhost:3000 node e2e/flows.cjs
// Uses the Playwright installed on the machine (require('playwright')).
const { chromium } = require('playwright');
const base = process.env.BASE_URL || 'http://localhost:3000';
const PASSWORD = process.env.ADMIN_PASSWORD || 'change-me-now';
const PW = PASSWORD;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('  ✓', m); };
async function login(b, email) {
  const ctx = await b.newContext({ viewport: { width: 1400, height: 900 } });
  const p = await ctx.newPage();
  p.on('pageerror', e => console.log('PAGEERROR', e.message));
  await p.goto(base + '/login');
  await p.fill('input[name=email]', email);
  await p.fill('input[name=password]', PW);
  await Promise.all([p.waitForURL(u => !u.pathname.startsWith('/login')), p.click('button[type=submit]')]);
  return p;
}
const toast = async (p, re) => { await p.locator('.toast').filter({ hasText: re }).first().waitFor({ timeout: 15000 }); };
(async () => {
  const b = await chromium.launch();
  const no = 'E2E' + Date.now().toString().slice(-6);

  console.log('planner creates a 2-line work order');
  const pl = await login(b, 'planner@lotfybronze.com');
  await pl.goto(base + '/work-orders/new');
  await pl.fill('input[pattern]', no);
  const card = pl.locator('fieldset').first();
  await card.locator('select').nth(0).selectOption({ label: 'Bushings' });
  await card.locator('select').nth(1).selectOption({ label: 'BRZ-08 — C90500' });
  await card.locator('select').nth(2).selectOption({ label: 'PRC-03 — Continuous Casting' });
  const nums = card.locator('input[type=number]');
  await nums.nth(0).fill('100'); await nums.nth(1).fill('20'); await nums.nth(2).fill('100'); await nums.nth(3).fill('10');
  // the live weight: OD100 ID20 L100 ×10 at 8.91 → 67.18 kg total, 77.26 raw
  await pl.waitForTimeout(200);
  const stat = await card.locator('.stat-line').innerText();
  ok(stat.includes('67.18') && stat.includes('77.26'), `live weights shown (${stat.replace(/\s+/g, ' ').slice(0, 90)})`);
  await pl.click('button:has-text("Duplicate")');
  await pl.click('button:has-text("Save Work Order")');
  await pl.waitForURL(/\/work-orders$/);
  await toast(pl, /saved — 2 lines/);
  ok(await pl.locator(`text=${no}-2`).count() > 0, 'both lines listed');

  console.log('duplicate number refused');
  await pl.goto(base + '/work-orders/new');
  await pl.fill('input[pattern]', no);
  const c2 = pl.locator('fieldset').first();
  await c2.locator('select').nth(0).selectOption({ label: 'Bars' });
  await c2.locator('select').nth(1).selectOption({ label: 'BRZ-08 — C90500' });
  await c2.locator('select').nth(2).selectOption({ label: 'PRC-03 — Continuous Casting' });
  await c2.locator('input[type=number]').nth(3).fill('5');
  await pl.click('button:has-text("Save Work Order")');
  await toast(pl, /already exists/);
  ok(true, 'duplicate WO number refused');

  console.log('planner moves line 1 to its QC stage');
  await pl.goto(base + '/planning');
  await pl.fill('input[placeholder="e.g. 14444"]', `${no}-1`);
  const art = () => pl.locator('article', { hasText: `${no}-1` });
  await art().locator('button:has-text("Start Stage")').click(); await toast(pl, /Start Stage done/);
  await art().locator('button:has-text("Next Stage")').click(); await toast(pl, /Next Stage done/);
  await pl.waitForTimeout(500);
  await art().locator('button:has-text("Start Stage")').click(); await toast(pl, /Start Stage done/);
  await pl.waitForTimeout(500);
  await art().locator('button:has-text("Next Stage")').click(); await toast(pl, /Next Stage done/);
  await pl.waitForTimeout(500);
  ok((await art().innerText()).includes('Under Inspection'), 'order reached QC: Under Inspection');

  console.log('rework needs a reason');
  await pl.fill('input[placeholder="e.g. 14444"]', `${no}-2`);
  await pl.locator('article', { hasText: `${no}-2` }).locator('button:has-text("Start Stage")').click(); await toast(pl, /Start Stage done/);
  await pl.waitForTimeout(500);
  await pl.locator('article', { hasText: `${no}-2` }).locator('button:has-text("Rework")').click();
  ok(await pl.locator('.modal button:has-text("Rework")').isDisabled(), 'rework button disabled until a reason is typed');
  await pl.fill('.modal textarea', 'Cold shut on two pieces');
  await pl.click('.modal button:has-text("Rework")'); await toast(pl, /Rework done/);

  console.log('stale screen is refused');
  const pl2 = await login(b, 'planner@lotfybronze.com');
  await pl2.goto(base + '/planning');
  await pl2.fill('input[placeholder="e.g. 14444"]', `${no}-2`);
  await pl.locator('article', { hasText: `${no}-2` }).locator('button:has-text("Start Stage")').click(); await toast(pl, /Start Stage done/);
  await pl2.locator('article', { hasText: `${no}-2` }).locator('button:has-text("Start Stage")').click();
  await toast(pl2, /Someone else changed|already started/);
  ok(true, 'second click on an old screen refused');

  console.log('QC inspector passes line 1 → completed → FG stock');
  const qc = await login(b, 'qc@lotfybronze.com');
  ok(qc.url().endsWith('/'), 'QC lands on the apps');
  await qc.goto(base + '/quality');
  const qa = qc.locator('article', { hasText: `${no}-1` });
  await qa.locator('button:has-text("Pass Stage")').click();
  await qc.fill('.modal input[type=number] >> nth=1', '1');
  ok(await qc.locator('.modal button:has-text("Pass Stage")').isDisabled(), 'a rejected piece needs its reason');
  await qc.locator('.modal select').selectOption({ index: 1 });
  await qc.click('.modal button:has-text("Pass Stage")');
  await toast(qc, /complete and in FG stock/);
  await qc.goto(base + '/inventory/fg');
  ok(await qc.locator(`text=${no}-1 - 1/2`).count() > 0, 'FG line created for the completed order');
  await qc.goto(base + '/planning');
  ok(qc.url().includes('/no-access'), 'QC cannot open Planning');

  console.log('supervisor records activity (own workshop only) and requests overtime + metal');
  const sv = await login(b, 'melting@lotfybronze.com');
  await sv.goto(base + '/workshop');
  const wsOptions = await sv.locator('form select').first().locator('option').allInnerTexts();
  ok(wsOptions.length === 1 && wsOptions[0] === 'Melting & Pouring', 'supervisor sees own workshop only');
  await sv.locator('form select').nth(1).selectOption({ index: 1 });
  await sv.locator('form select').nth(3).selectOption({ index: 1 });
  await sv.fill('input[type=time] >> nth=0', '09:00');
  await sv.fill('input[type=time] >> nth=1', '11:30');
  await sv.click('button:has-text("Record Activity")');
  await toast(sv, /Activity recorded/);
  // the same machine, overlapping time → refused
  await sv.locator('form select').nth(1).selectOption({ index: 1 });
  await sv.fill('input[type=time] >> nth=0', '10:00');
  await sv.fill('input[type=time] >> nth=1', '10:30');
  await sv.click('button:has-text("Record Activity")');
  await toast(sv, /already has a record/);
  ok(true, 'overlapping record on one machine refused');
  await sv.goto(base + '/overtime');
  await sv.click('button:has-text("New Request")');
  await sv.locator('.modal select').nth(1).selectOption({ index: 1 });
  await sv.fill('.modal input[type=date]', '2026-12-01');
  await sv.fill('.modal textarea', 'E2E pour');
  await sv.click('.modal button:has-text("Send for approval")');
  await toast(sv, /Request sent/);
  ok(await sv.locator('button:has-text("Approve")').count() === 0, 'supervisor cannot approve');
  await sv.goto(base + '/inventory/issues');
  await sv.click('button:has-text("New request")');
  await sv.locator('.modal select').nth(0).selectOption({ label: 'BRZ-10 — C95400' });
  await sv.fill('.modal input[type=number]', '99999');
  await sv.click('.modal button:has-text("Send to store")');
  await toast(sv, /Request sent to the store/);

  console.log('planner approves overtime; store refuses an issue beyond stock');
  await pl.goto(base + '/planning/notifications');
  const row = pl.locator('tr', { hasText: 'E2E pour' });
  await row.locator('button:has-text("Approve")').click();
  await toast(pl, /Approved/);
  const st = await login(b, 'store@lotfybronze.com');
  await st.goto(base + '/inventory/issues');
  const ir = st.locator('tr', { hasText: '99,999' });
  ok(await ir.locator('button:has-text("Issue")').isDisabled(), 'issue disabled when stock is short');

  console.log('a new sign-up sees only My Work and Manufacturing (its reports)');
  const u = await b.newContext().then(c => c.newPage());
  await u.goto(base + '/signup');
  await u.fill('input[name=name]', 'E2E Viewer');
  await u.fill('input[name=email]', `viewer${no}@x.com`);
  await u.fill('input[name=password]', 'longpassword1');
  await Promise.all([u.waitForURL(base + '/'), u.click('button[type=submit]')]);
  const apps = await u.locator('.app-tile-label').allInnerTexts();
  ok(apps.join('|') === 'My Work|Manufacturing', 'only My Work and Manufacturing on the home screen: ' + apps.join('|'));
  await u.goto(base + '/settings');
  ok(u.url().includes('/no-access'), 'settings blocked');

  console.log('wrong password refused');
  const bad = await b.newContext().then(c => c.newPage());
  await bad.goto(base + '/login');
  await bad.fill('input[name=email]', 'planner@lotfybronze.com');
  await bad.fill('input[name=password]', 'nope-nope');
  await bad.click('button[type=submit]');
  await bad.locator('text=The email or password is not right').waitFor();
  ok(true, 'bad password message');

  await b.close();
  console.log('ALL E2E CHECKS PASSED', no);
})().catch(e => { console.error(e.message); process.exit(1); });
