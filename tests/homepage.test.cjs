const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn, execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

let browser;
let server;
const url = process.env.TEST_URL || 'http://127.0.0.1:4174';

before(async () => {
  if (!process.env.TEST_URL) {
    server = spawn('python3', ['-m', 'http.server', '4174', '--bind', '127.0.0.1', '--directory', 'dist']);
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

test('unknown paths return a real not found response', async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const response = await page.goto(new URL('/not-a-page', url).href);
  assert.equal(response.status(), 404);
  assert.notEqual(await page.locator('h1').textContent(), 'Serene');
  await context.close();
});

test('visitors can read the homepage and follow social links without JavaScript', async () => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  const response = await page.goto(url);
  assert.equal(response.status(), 200);
  assert.equal(await page.locator('h1').textContent(), 'Serene');
  assert.ok(await page.getByText('/səˈriːn/', { exact: true }).isVisible());
  assert.equal(await page.getByRole('link', { name: 'X', exact: true }).getAttribute('href'), 'https://x.com/serene_matt');
  assert.equal(await page.getByRole('link', { name: 'GitHub', exact: true }).getAttribute('href'), 'https://github.com/serenematt');
  assert.equal(await page.getByRole('link', { name: 'Learnings', exact: true }).getAttribute('href'), '/learnings');
  await context.close();
});

async function assertResume(page) {
  assert.equal(await page.locator('h1').textContent(), 'Resume');
  assert.ok(await page.getByText('Serene', { exact: true }).isVisible());
  assert.ok(await page.getByText('/səˈriːn/', { exact: true }).isVisible());
  assert.ok(await page.getByText('Serene. Find me on X and GitHub.', { exact: true }).isVisible());
  assert.equal(await page.getByRole('link', { name: 'X', exact: true }).getAttribute('href'), 'https://x.com/serene_matt');
  assert.equal(await page.getByRole('link', { name: 'GitHub', exact: true }).getAttribute('href'), 'https://github.com/serenematt');
  assert.equal(await page.getByRole('link', { name: 'Resume', exact: true }).getAttribute('aria-current'), 'page');
  assert.equal(await page.getByRole('link', { name: 'Learnings', exact: true }).getAttribute('href'), '/learnings');
  const hrefs = await page.locator('a').evaluateAll((els) => els.map((el) => el.getAttribute('href') || ''));
  assert.equal(hrefs.some((href) => href.includes('/hot-takes')), false);
}

test('direct entry and refresh keep the resume document', async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const response = await page.goto(new URL('/me', url).href);
  assert.equal(response.status(), 200);
  assert.equal(new URL(page.url()).pathname.replace(/\/$/, ''), '/me');
  const html = await response.text();
  assert.match(html, /<h1>Resume<\/h1>/);
  assert.match(html, /Serene\. Find me on X and GitHub\./);
  assert.match(html, /href="\/learnings"/);
  assert.doesNotMatch(html, /\/hot-takes/);
  await assertResume(page);
  await page.reload();
  await assertResume(page);
  await context.close();
});

test('keyboard and links move between the homepage and resume', async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(url);
  const homeHref = await page.locator('a').evaluateAll((els) => els.map((el) => el.getAttribute('href') || ''));
  assert.equal(homeHref.some((href) => href.includes('/hot-takes')), false);
  assert.equal(await page.getByRole('link', { name: 'Learnings', exact: true }).getAttribute('href'), '/learnings');
  assert.equal(await page.getByRole('link', { name: 'Home', exact: true }).getAttribute('aria-current'), 'page');
  const resumeLink = page.getByRole('link', { name: 'Resume', exact: true });
  assert.equal(await resumeLink.getAttribute('href'), '/me');
  await resumeLink.focus();
  await page.keyboard.press('Enter');
  await page.waitForURL((next) => new URL(next).pathname.replace(/\/$/, '') === '/me');
  await assertResume(page);
  await page.getByRole('link', { name: 'Home', exact: true }).click();
  await page.getByRole('heading', { name: 'Serene', exact: true }).waitFor();
  assert.equal(await page.locator('h1').textContent(), 'Serene');
  assert.equal(await page.getByRole('link', { name: 'X', exact: true }).count(), 1);
  assert.equal(await page.getByRole('link', { name: 'GitHub', exact: true }).count(), 1);
  await context.close();
});

test('resume heading and verified content are visible without JavaScript', async () => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  const response = await page.goto(new URL('/me', url).href);
  assert.equal(response.status(), 200);
  await assertResume(page);
  await page.getByRole('link', { name: 'Home', exact: true }).click();
  assert.equal(await page.locator('h1').textContent(), 'Serene');
  await context.close();
});

test('resume layouts fit mobile and desktop viewports', async () => {
  for (const width of [320, 390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    await page.goto(new URL('/me', url).href);
    await assertResume(page);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await context.close();
  }
});

const learningsDir = path.join('src', 'content', 'learnings');
const fixturePost = path.join(learningsDir, 'harbor-note.md');
const postTitle = 'Harbor water remembers the pilings';
const postBody = 'The tide left a salt line on the rope and nowhere else.';
const postPath = '/learnings/harbor-note';

function markdownPosts(dir) {
  return fs.readdirSync(dir).filter((name) => /\.(md|markdown|mdx)$/i.test(name));
}

function buildSite() {
  execFileSync(process.execPath, [path.join('node_modules', 'astro', 'bin', 'astro.mjs'), 'build'], {
    stdio: 'inherit',
  });
}

async function assertEmptyLearnings(page) {
  assert.equal(await page.locator('h1').textContent(), 'Learnings');
  assert.ok(await page.getByText('No posts yet.', { exact: true }).isVisible());
  assert.equal(await page.getByRole('link', { name: 'Learnings', exact: true }).getAttribute('aria-current'), 'page');
  assert.equal(await page.getByRole('link', { name: 'Home', exact: true }).getAttribute('href'), '/');
  assert.equal(await page.getByRole('link', { name: 'Resume', exact: true }).getAttribute('href'), '/me');
  const hrefs = await page.locator('a').evaluateAll((els) => els.map((el) => el.getAttribute('href') || ''));
  assert.equal(hrefs.some((href) => href.startsWith('/learnings/')), false);
  assert.equal(hrefs.some((href) => href.includes('/hot-takes')), false);
  assert.equal(await page.getByText(postTitle).count(), 0);
}

async function assertPost(page) {
  assert.equal(await page.locator('h1').textContent(), postTitle);
  assert.ok(await page.getByText(postBody, { exact: true }).isVisible());
  assert.equal(await page.getByRole('link', { name: 'Learnings', exact: true }).getAttribute('href'), '/learnings');
  assert.equal(await page.getByRole('link', { name: 'Home', exact: true }).getAttribute('href'), '/');
  assert.equal(await page.getByRole('link', { name: 'Resume', exact: true }).getAttribute('href'), '/me');
  assert.equal(hrefPath(page.url()), postPath);
}

function hrefPath(value) {
  return new URL(value).pathname.replace(/\/$/, '');
}

test('production learnings content has no posts', () => {
  assert.deepEqual(markdownPosts(learningsDir), []);
});

test('direct entry and refresh keep the empty learnings index', async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const response = await page.goto(new URL('/learnings', url).href);
  assert.equal(response.status(), 200);
  assert.equal(hrefPath(page.url()), '/learnings');
  const html = await response.text();
  assert.match(html, /<h1>Learnings<\/h1>/);
  assert.match(html, /No posts yet\./);
  assert.doesNotMatch(html, /Harbor water remembers the pilings/);
  await assertEmptyLearnings(page);
  await page.reload();
  await assertEmptyLearnings(page);
  await context.close();
});

test('links move between the homepage, resume, and empty learnings index', async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(url);
  await page.getByRole('link', { name: 'Learnings', exact: true }).click();
  await page.waitForURL((next) => hrefPath(next) === '/learnings');
  await assertEmptyLearnings(page);
  await page.getByRole('link', { name: 'Resume', exact: true }).click();
  await page.waitForURL((next) => hrefPath(next) === '/me');
  await assertResume(page);
  await page.getByRole('link', { name: 'Learnings', exact: true }).click();
  await page.getByRole('link', { name: 'Home', exact: true }).click();
  await page.getByRole('heading', { name: 'Serene', exact: true }).waitFor();
  assert.equal(await page.locator('h1').textContent(), 'Serene');
  await context.close();
});

test('empty learnings index is readable without JavaScript', async () => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  const response = await page.goto(new URL('/learnings', url).href);
  assert.equal(response.status(), 200);
  await assertEmptyLearnings(page);
  await page.getByRole('link', { name: 'Home', exact: true }).click();
  assert.equal(await page.locator('h1').textContent(), 'Serene');
  await context.close();
});

test('learnings layouts fit mobile and desktop viewports', async () => {
  for (const width of [320, 390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    await page.goto(new URL('/learnings', url).href);
    await assertEmptyLearnings(page);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await context.close();
  }
});

test('unknown learning posts return a real not found response', async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const response = await page.goto(new URL('/learnings/not-a-post', url).href);
  assert.equal(response.status(), 404);
  assert.notEqual(await page.locator('h1').textContent(), 'Serene');
  assert.equal(await page.getByText('No posts yet.', { exact: true }).count(), 0);
  await context.close();
});

test('a published post is readable static HTML and leaves production empty', { timeout: 180000 }, async () => {
  fs.copyFileSync(path.join('tests', 'fixtures', 'learnings', 'harbor-note.md'), fixturePost);
  try {
    buildSite();
    const context = await browser.newContext();
    const page = await context.newPage();
    const response = await page.goto(new URL(postPath, url).href);
    assert.equal(response.status(), 200);
    assert.equal(hrefPath(page.url()), postPath);
    const html = await response.text();
    assert.match(html, /<h1>Harbor water remembers the pilings<\/h1>/);
    assert.match(html, /The tide left a salt line on the rope and nowhere else\./);
    await assertPost(page);
    await page.reload();
    await assertPost(page);

    await page.goto(new URL('/learnings', url).href);
    assert.equal(await page.getByText('No posts yet.', { exact: true }).count(), 0);
    await page.getByRole('link', { name: postTitle, exact: true }).click();
    await page.waitForURL((next) => hrefPath(next) === postPath);
    await assertPost(page);
    await page.getByRole('link', { name: 'Home', exact: true }).click();
    await page.getByRole('heading', { name: 'Serene', exact: true }).waitFor();
    await page.getByRole('link', { name: 'Resume', exact: true }).click();
    await page.getByRole('heading', { name: 'Resume', exact: true }).waitFor();
    await page.getByRole('link', { name: 'Learnings', exact: true }).click();
    await page.getByRole('link', { name: postTitle, exact: true }).click();
    await assertPost(page);

    const missing = await page.goto(new URL('/learnings/not-a-post', url).href);
    assert.equal(missing.status(), 404);
    assert.notEqual(await page.locator('h1').textContent(), postTitle);
    assert.notEqual(await page.locator('h1').textContent(), 'Serene');
    await context.close();

    const plain = await browser.newContext({ javaScriptEnabled: false });
    const plainPage = await plain.newPage();
    const plainResponse = await plainPage.goto(new URL(postPath, url).href);
    assert.equal(plainResponse.status(), 200);
    const plainHtml = await plainResponse.text();
    assert.match(plainHtml, /<h1>Harbor water remembers the pilings<\/h1>/);
    assert.match(plainHtml, /The tide left a salt line on the rope and nowhere else\./);
    await assertPost(plainPage);
    await plainPage.goto(new URL('/learnings', url).href);
    await plainPage.getByRole('link', { name: postTitle, exact: true }).click();
    await assertPost(plainPage);
    await plain.close();

    for (const width of [320, 390, 1440]) {
      const sized = await browser.newContext({ viewport: { width, height: 900 } });
      const sizedPage = await sized.newPage();
      await sizedPage.goto(new URL(postPath, url).href);
      await assertPost(sizedPage);
      assert.equal(await sizedPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await sizedPage.goto(new URL('/learnings', url).href);
      assert.equal(await sizedPage.locator('h1').textContent(), 'Learnings');
      assert.equal(await sizedPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await sized.close();
    }
  } finally {
    fs.rmSync(fixturePost, { force: true });
    buildSite();
    assert.deepEqual(markdownPosts(learningsDir), []);
  }

  const context = await browser.newContext();
  const page = await context.newPage();
  const response = await page.goto(new URL('/learnings', url).href);
  assert.equal(response.status(), 200);
  const html = await response.text();
  assert.match(html, /No posts yet\./);
  assert.doesNotMatch(html, /Harbor water remembers the pilings/);
  await assertEmptyLearnings(page);
  const gone = await page.goto(new URL(postPath, url).href);
  assert.equal(gone.status(), 404);
  await context.close();
});
