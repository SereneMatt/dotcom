import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const exec = promisify(execFile);
const packageDirectory = fileURLToPath(new URL('../', import.meta.url));

function launch(args, cwd, env) {
  const child = spawn('npx', args, { cwd, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  let resolveReady;
  let rejectReady;
  const ready = new Promise((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
  const deadline = setTimeout(() => rejectReady(new Error(`CLI startup timed out:\n${output}`)), 30_000);
  const exited = new Promise((resolve, reject) => {
    child.once('error', error => { rejectReady(error); reject(error); });
    child.once('exit', (code, signal) => {
      clearTimeout(deadline);
      rejectReady(new Error(`CLI exited before startup (${code ?? signal}):\n${output}`));
      resolve({ code, signal });
    });
  });
  // Attach immediately so a launch failure cannot become an unhandled rejection.
  exited.catch(() => {});
  for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => {
    output += chunk;
    const match = output.match(/UI harness: (http:\/\/127\.0\.0\.1:\d+)\nSettings: (.+)\n/);
    if (match) {
      clearTimeout(deadline);
      resolveReady({ origin: match[1], configPath: match[2] });
    }
  });
  return {
    ready,
    async stop() {
      clearTimeout(deadline);
      // Signal the runner and CLI together, as terminal Ctrl+C does.
      try { process.kill(-child.pid, 'SIGINT'); }
      catch (error) { if (error.code !== 'ESRCH') throw error; }
      let timedOut = false;
      const shutdownDeadline = setTimeout(() => {
        timedOut = true;
        try { process.kill(-child.pid, 'SIGKILL'); }
        catch (error) { if (error.code !== 'ESRCH') throw error; }
      }, 5_000);
      try {
        const result = await exited;
        assert.equal(timedOut, false, `CLI shutdown timed out:\n${output}`);
        assert.ok(result.code === 0 || result.code === 130 || result.signal === 'SIGINT', JSON.stringify(result));
      } finally { clearTimeout(shutdownDeadline); }
    },
  };
}

test('npm tarball CLI renders, saves in the target project, restores on restart, and shuts down', {
  timeout: 120_000,
  skip: process.platform === 'win32' ? 'Uses POSIX process groups to reproduce terminal Ctrl+C' : false,
}, async t => {
  const directory = await mkdtemp(join(tmpdir(), 'ui-harness-packed-'));
  let running;
  let browser;
  let target;
  t.after(async () => {
    try {
      await browser?.close();
      await running?.stop();
    } finally {
      if (target) await new Promise(resolve => target.close(resolve));
      await rm(directory, { recursive: true, force: true });
    }
  });
  const project = join(directory, 'target project');
  await mkdir(project);
  const manifest = '{"name":"clean-target-project","private":true}\n';
  await writeFile(join(project, 'package.json'), manifest);
  const env = {
    ...process.env,
    PATH: `${dirname(process.execPath)}${delimiter}${process.env.PATH}`,
    npm_config_cache: join(directory, 'npm-cache'),
    npm_config_update_notifier: 'false',
  };
  for (const name of ['NODE_PATH', 'NODE_OPTIONS', 'PORT', 'PORTLESS_URL']) delete env[name];
  const { stdout } = await exec('npm', ['pack', '--json', '--pack-destination', directory], {
    cwd: packageDirectory, env, timeout: 30_000,
  });
  const [{ filename }] = JSON.parse(stdout);
  const runner = ['--yes', `--package=${join(directory, filename)}`, 'ui-harness', '--no-open', '--port', '0'];
  target = createServer((request, response) => {
    response.writeHead(200, { 'Content-Type': 'text/html' });
    response.end('<!doctype html><h1>Standalone target</h1><label>Draft<input></label>');
  });
  await new Promise(resolve => target.listen(0, '127.0.0.1', resolve));
  const targetUrl = `http://127.0.0.1:${target.address().port}`;
  running = launch([...runner, targetUrl], project, env);
  const first = await running.ready;
  const configPath = join(project, 'ui-harness.config.json');
  assert.equal(first.configPath, configPath);
  assert.deepEqual((await readdir(project)).sort(), ['package.json']);
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  const page = await browser.newPage();
  page.setDefaultTimeout(10_000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const path of ['/', '/app.js', '/style.css', '/settings.js']) {
    const response = await fetch(`${first.origin}${path}`);
    assert.equal(response.status, 200, `${path} is included in the tarball`);
    assert.ok((await response.text()).length > 0);
  }
  await page.goto(first.origin);
  for (let index = 0; index < 4; index++) {
    await page.frameLocator('iframe').nth(index).getByRole('heading', { name: 'Standalone target' }).waitFor();
  }
  await page.frameLocator('iframe').first().getByLabel('Draft').fill('Works from the tarball');
  assert.equal(await page.frameLocator('iframe').first().getByLabel('Draft').inputValue(), 'Works from the tarball');
  await page.getByLabel('Project URL', { exact: true }).fill(`${targetUrl}/saved`);
  await page.getByRole('button', { name: 'Open URL', exact: true }).click();
  await page.getByRole('spinbutton', { name: 'Width', exact: true }).fill('500');
  await page.getByRole('spinbutton', { name: 'Height', exact: true }).fill('700');
  await page.getByRole('button', { name: 'Add viewport', exact: true }).click();
  for (const size of ['390 × 664', '768 × 1024', '1280 × 720', '1440 × 900']) {
    await page.getByRole('button', { name: `Remove ${size}`, exact: true }).click();
  }
  await page.getByLabel('Display scale').selectOption('0.5');
  assert.deepEqual((await readdir(project)).sort(), ['package.json']);
  await page.getByRole('button', { name: 'Save settings', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Settings saved' }).waitFor();
  const saved = { version: 1, url: `${targetUrl}/saved`, viewports: [{ width: 500, height: 700 }], scale: 0.5 };
  assert.deepEqual(JSON.parse(await readFile(configPath, 'utf8')), saved);
  await page.getByLabel('Display scale').selectOption('1');
  await page.getByRole('button', { name: 'Restore starting sizes', exact: true }).click();
  await page.getByLabel('Project URL', { exact: true }).fill(`${targetUrl}/temporary`);
  await page.getByRole('button', { name: 'Open URL', exact: true }).click();
  await page.reload();
  await page.locator('iframe').first().waitFor();
  assert.deepEqual(JSON.parse(await readFile(configPath, 'utf8')), saved);
  await page.goto('about:blank');
  await running.stop();
  running = undefined;
  await assert.rejects(fetch(first.origin, { signal: AbortSignal.timeout(2_000) }), TypeError);

  running = launch(runner, project, env);
  const restored = await running.ready;
  assert.equal(restored.configPath, configPath);
  await page.goto(restored.origin);
  await page.frameLocator('iframe').first().getByRole('heading', { name: 'Standalone target' }).waitFor();
  assert.equal(await page.locator('iframe').count(), 1);
  assert.equal(await page.getByLabel('Project URL', { exact: true }).inputValue(), `${targetUrl}/saved`);
  assert.equal(await page.getByLabel('Display scale').inputValue(), '0.5');
  const frame = await page.locator('iframe').elementHandle().then(handle => handle.contentFrame());
  assert.deepEqual(await frame.evaluate(() => [innerWidth, innerHeight]), [500, 700]);
  assert.equal(frame.url(), `${targetUrl}/saved`);
  assert.deepEqual(errors, []);
  await browser.close();
  browser = undefined;
  await running.stop();
  running = undefined;
  await assert.rejects(fetch(restored.origin, { signal: AbortSignal.timeout(2_000) }), TypeError);
  assert.equal(await readFile(join(project, 'package.json'), 'utf8'), manifest);
  assert.deepEqual((await readdir(project)).sort(), ['package.json', 'ui-harness.config.json']);
});
