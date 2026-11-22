// End-to-end check against a running app on a freshly seeded database:
//   npm run seed -- --force && npm run dev
//   BASE_URL=http://localhost:3000 node e2e/enterprise.cjs
// Uses the Playwright installed on the machine (require('playwright')).
const { chromium } = require('playwright');
const base = process.env.BASE_URL || 'http://localhost:3000';
const PASSWORD = process.env.ADMIN_PASSWORD || 'change-me-now';
const S = require('node:path').join(__dirname, 'fixtures') + '/';
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('  ✓', m); };
async function login(b, email) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  p.on('pageerror', e => console.log('PAGEERROR', e.message));
  await p.goto(base + '/login');
  await p.fill('input[name=email]', email);
  await p.fill('input[name=password]', PASSWORD);
  await Promise.all([p.waitForURL(u => !u.pathname.startsWith('/login')), p.click('button[type=submit]')]);
  return p;
}
const toast = async (p, re) => p.locator('.toast').filter({ hasText: re }).first().waitFor({ timeout: 15000 });
(async () => {
  const b = await chromium.launch();
  const tag = 'porosity-' + Date.now().toString(36);

  console.log('planner: My Work, command palette');
  const pl = await login(b, 'planner@lotfybronze.com');
  ok(pl.url() === base + '/', 'lands on the apps');
  const tiles = (await pl.locator('.app-tile-label').allInnerTexts()).join('|');
  ok(tiles === 'My Work|Manufacturing|Planning|Shop Floor|Quality|Inventory|Overtime|Reporting|Master Data', 'planner sees their apps: ' + tiles);
  await pl.click('.app-tile:has-text("Manufacturing")');
  await pl.waitForURL(/\/work-orders$/);
  const appBar = (await pl.locator('.appbar-nav .menu-btn').allInnerTexts()).map(t => t.trim()).join('|');
  ok(appBar === 'Work Orders|New Work Order|Work Order History', 'inside Manufacturing the bar has its menus only: ' + appBar);
  await pl.click('a[aria-label="All apps"]');
  await pl.click('.app-tile:has-text("Planning")');
  await pl.waitForURL(/\/planning$/);
  await pl.click('.appbar-nav a:has-text("Weekly Plan")');
  await pl.waitForURL(/\/planning\/weekly/);
  ok(true, 'Planning app ▸ Weekly Plan from its bar');
  // a dropdown of the bar must really show — on top, inside the window, not clipped by the bar
  await pl.goto(base + '/inventory/raw');
  await pl.click('.appbar-nav button:has-text("Stock")');
  const item = pl.locator('.dropdown-item:has-text("FG Products")');
  await item.waitFor();
  const visible = await item.evaluate((el) => { const r = el.getBoundingClientRect(); const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return r.top > 48 && !!top && el.contains(top); });
  ok(visible, 'the Stock dropdown shows below the bar, on top of the page');
  await item.click();
  await pl.waitForURL(/\/inventory\/fg/);
  await pl.click('a[aria-label="All apps"]');
  await pl.waitForURL(base + '/');
  await pl.fill('.launcher-search input', 'capac');
  await pl.locator('.launcher-pages a', { hasText: 'Capacity' }).waitFor();
  await pl.keyboard.press('Enter');
  await pl.waitForURL(/\/planning\/capacity/);
  ok(true, 'home search opens a page');
  await pl.goto(base + '/my-work');
  await pl.locator('text=Ready to release').first().waitFor({ timeout: 30000 });
  ok(true, 'My Work shows Ready to release');
  await pl.keyboard.press('Control+k');
  await pl.locator('.palette input').fill('2526');
  await pl.locator('.palette .dropdown-item').filter({ hasText: '2526-1' }).first().waitFor();
  await pl.keyboard.press('Enter');
  await pl.waitForURL(/\/work-orders\/\d+$/);
  await pl.locator('.crumbs h1', { hasText: '2526-1' }).waitFor();
  ok(true, 'palette opened the record, breadcrumb names it');

  console.log('chatter: mention + file');
  await pl.fill('.chatter textarea', `Please check ${tag} on these @Mon`);
  await pl.locator('.chatter [role=option]').filter({ hasText: 'Mona Adel' }).click();
  ok((await pl.inputValue('.chatter textarea')).includes('@Mona Adel'), 'mention picked');
  await pl.click('.chatter button:has-text("Send")');
  await pl.locator('.msg-body', { hasText: tag }).waitFor({ timeout: 15000 }).catch(async () => { console.log('toasts:', await pl.locator('.toast').allInnerTexts()); throw new Error('FAIL: message in the timeline'); });
  ok(await pl.locator('.msg-body', { hasText: tag }).locator('.mention').count() === 1, 'message in the timeline with its mention');
  await pl.setInputFiles('.chatter input[type=file]', S + 'drawing.pdf');
  await toast(pl, /File attached/);
  const href = await pl.locator('.chatter a.file-chip', { hasText: 'drawing.pdf' }).getAttribute('href');
  const r = await pl.request.get(base + href);
  ok(r.status() === 200 && r.headers()['content-type'] === 'application/pdf', 'file served inline as PDF to the owner');
  await pl.setInputFiles('.chatter input[type=file]', S + 'evil.html');
  await toast(pl, /cannot be attached/);
  ok(true, 'HTML file refused');

  console.log('QC sees the mention');
  const qc = await login(b, 'qc@lotfybronze.com');
  const n = Number(await qc.locator('.dot-count').innerText());
  ok(n >= 1, `bell shows ${n} unread`);
  await qc.click('button[aria-label^="Notifications"]');
  await qc.locator('.dropdown-item', { hasText: 'Nour Elsayed mentioned you on 2526-1' }).first().click();
  await qc.waitForURL(/\/work-orders\/\d+$/);
  ok(true, 'notification opens the record');
  const anon = await (await b.newContext()).request.get(base + href, { maxRedirects: 0 });
  ok(anon.status() !== 200, `signed-out request refused (${anon.status()})`);

  console.log('kanban: drag a card');
  await pl.goto(base + '/work-orders?view=kanban');
  const card = pl.locator('.kcard', { hasText: '2560-1' });
  await card.dragTo(pl.locator('.kcol').filter({ has: pl.locator('.kcol-head', { hasText: /^Melting/ }) }));
  await toast(pl, /starts at Mold Prepare/);
  ok(true, 'wrong column refused with the reason');
  await card.dragTo(pl.locator('.kcol').filter({ has: pl.locator('.kcol-head', { hasText: /^Mold Prepare/ }) }));
  await toast(pl, /Start Stage done/);
  await pl.waitForTimeout(800);
  ok(await pl.locator('.kcol').filter({ has: pl.locator('.kcol-head', { hasText: /^Mold Prepare/ }) }).locator('.kcard', { hasText: '2560-1' }).count() === 1, 'card moved to Mold Prepare');

  console.log('saved view');
  await pl.goto(base + '/work-orders?f=late');
  await pl.click('button:has-text("Favorites")');
  await pl.click('text=Save current search');
  await pl.fill('.modal input', 'My late orders');
  await pl.click('.modal button:has-text("Save")');
  await toast(pl, /saved/);
  await pl.goto(base + '/work-orders?f=open');
  await pl.click('button:has-text("Favorites")');
  await pl.click('.dropdown-item:has-text("My late orders")');
  await pl.waitForURL(/f=late/);
  ok(true, 'favorite reopens its filters');

  console.log('gantt: drag a bar');
  await pl.goto(base + '/work-orders?view=gantt');
  const bar = pl.locator('.g-bar', { hasText: '2561-1' });
  await bar.waitFor();
  await bar.scrollIntoViewIfNeeded();
  const box = await bar.boundingBox();
  await pl.mouse.move(box.x + 40, box.y + 10);
  await pl.mouse.down();
  await pl.mouse.move(box.x + 40 + 34 * 3, box.y + 10, { steps: 6 });
  await pl.mouse.up();
  await toast(pl, /Rescheduled/);
  ok(true, 'bar moved 3 days → rescheduled');

  console.log('traveler');
  await pl.goto(base + '/work-orders');
  await pl.locator('tr', { hasText: '2526-1' }).locator('input[type=checkbox]').check();
  await pl.locator('tr', { hasText: '2547-1' }).locator('input[type=checkbox]').check();
  const [tp] = await Promise.all([pl.context().waitForEvent('page'), pl.click('button:has-text("Print travelers")')]);
  await tp.waitForLoadState();
  ok(await tp.locator('section svg').count() === 2, 'two travelers, each with its QR');

  console.log('kiosk: supervisor of Melting & Pouring');
  const sv = await login(b, 'melting@lotfybronze.com');
  await sv.goto(base + '/floor');
  await sv.fill('input[aria-label="Order number"]', '2547-2');
  await sv.click('button:has-text("Open")');
  await sv.waitForURL(/\/floor\/wo\/\d+$/);
  await sv.click('button.kbtn:has-text("Start the stage")');
  await toast(sv, /started/);
  await sv.locator('text=Report this stage').waitFor();
  ok(true, '2547-2 started at Melting & Pouring from the kiosk; report form shown');
  await sv.click('button[aria-label="More Good pieces"]');
  await sv.click('button[aria-label="More Good pieces"]');
  await sv.fill('input[type=time] >> nth=0', '13:00');
  await sv.fill('input[type=time] >> nth=1', '14:30');
  await sv.click('button:has-text("Save & finish stage")');
  await sv.locator('.toast').filter({ hasText: /Stage finished|recorded|not|Could|refreshed/ }).first().waitFor({ timeout: 20000 }).catch(() => {});
  const msgs = await sv.locator('.toast').allInnerTexts();
  if (!msgs.some(m => /Stage finished/.test(m))) throw new Error('FAIL kiosk finish: ' + msgs.join(' | '));
  ok(true, 'output recorded and stage finished from the kiosk');
  await sv.goto(base + '/floor');
  await sv.fill('input[aria-label="Order number"]', '2544-1');
  await sv.click('button:has-text("Open")');
  await sv.waitForURL(/\/floor\/wo\/\d+$/);
  ok(await sv.locator('text=belongs to').count() === 1, 'another workshop’s stage cannot be confirmed');

  await b.close();
  console.log('ALL ENTERPRISE E2E CHECKS PASSED');
})().catch(e => { console.error(e.message); process.exit(1); });
