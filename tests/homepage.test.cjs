const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');

let browser;
let server;
const url = process.env.TEST_URL || 'http://127.0.0.1:4174';

before(async () => {
  if (!process.env.TEST_URL) {
    server = spawn('python3', ['-m', 'http.server', '4174', '--bind', '127.0.0.1', '--directory', 'public']);
    await new Promise((resolve, reject) => {
      server.on('error', reject);
      let stopped = false;
      const deadline = setTimeout(() => { stopped = true; reject(new Error('Preview did not start')); }, 5000);
      server.once('exit', () => { stopped = true; clearTimeout(deadline); reject(new Error('Preview exited before starting')); });
      const poll = async () => {
        try { await fetch(url); clearTimeout(deadline); resolve(); }
        catch { if (!stopped && !server.killed) setTimeout(poll, 50); }
      };
      poll();
    });
  }
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
});

test('audio downloads only on keyboard activation and plays successfully', async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  await page.goto(url);
  await page.waitForLoadState('networkidle');
  assert.equal(requests.some(request => request.endsWith('.mp3')), false);
  assert.ok(requests.every(request => new URL(request).origin === new URL(url).origin));
  const transfer = await page.evaluate(() => [...performance.getEntriesByType('navigation'), ...performance.getEntriesByType('resource')].reduce((sum, entry) => sum + entry.transferSize, 0));
  assert.ok(transfer > 0 && transfer <= 100000, `Initial transfer: ${transfer} bytes`);
  const button = page.getByRole('button', { name: 'Hear Serene pronounced' });
  await button.focus();
  const recording = page.waitForResponse(response => response.url().endsWith('.mp3'));
  await page.keyboard.press('Enter');
  assert.ok((await recording).ok());
  await page.getByRole('status').filter({ hasText: 'Playing pronunciation' }).waitFor();
  await page.waitForFunction(() => document.querySelector('[role=status]').textContent === '');
  assert.equal(await button.isEnabled(), true);
  await context.close();
});

test('failed audio can be retried', async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.route('**/*.mp3', route => route.abort());
  await page.goto(url);
  const button = page.getByRole('button', { name: 'Hear Serene pronounced' });
  await button.click();
  await page.getByText('Could not play. Please try again.').waitFor();
  assert.equal(await button.isEnabled(), true);
  await page.unroute('**/*.mp3');
  await button.click();
  await page.getByRole('status').filter({ hasText: 'Playing pronunciation' }).waitFor();
  await context.close();
});

test('mobile and desktop layouts fit the viewport', async () => {
  for (const width of [320, 390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    await page.goto(url);
    assert.ok(await page.getByRole('heading', { name: 'Serene' }).isVisible());
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: `test-results/homepage-${width}.png`, fullPage: true });
    await context.close();
  }
});

after(async () => { await browser?.close(); server?.kill(); });

test('visitors can read the homepage and follow social links without JavaScript', async () => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  const response = await page.goto(url);
  assert.equal(response.status(), 200);
  assert.equal(await page.locator('h1').textContent(), 'Serene');
  assert.ok(await page.getByText('/səˈriːn/', { exact: true }).isVisible());
  assert.equal(await page.getByRole('link', { name: 'X', exact: true }).getAttribute('href'), 'https://x.com/serene_matt');
  assert.equal(await page.getByRole('link', { name: 'GitHub', exact: true }).getAttribute('href'), 'https://github.com/serenematt');
  await context.close();
});
