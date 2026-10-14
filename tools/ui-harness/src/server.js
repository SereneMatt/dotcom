import { createServer } from 'node:http';
import { readFile, rename, writeFile, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { defaultViewports, parseSettings } from './settings.js';

const files = new Map([
  ['/', ['../web/index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['../web/app.js', 'text/javascript; charset=utf-8']],
  ['/style.css', ['../web/style.css', 'text/css; charset=utf-8']],
  ['/settings.js', ['./settings.js', 'text/javascript; charset=utf-8']],
]);

export async function startHarness({ url, configPath, port = 4317, publicOrigin }) {
  if (publicOrigin !== undefined) {
    const parsed = new URL(publicOrigin);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) {
      throw new Error('Public origin must be an HTTP or HTTPS origin without a path or credentials.');
    }
    publicOrigin = parsed.origin;
  }
  let saved;
  try {
    saved = parseSettings(JSON.parse(await readFile(configPath, 'utf8')));
  } catch (error) {
    if (error.code !== 'ENOENT') throw new Error(`Cannot read ${configPath}: ${error.message}`);
  }
  let settings = parseSettings({ version: 1, viewports: defaultViewports, scale: 'fit', ...saved, ...(url ? { url } : {}) });
  const catalog = JSON.parse(await readFile(new URL('../data/chromium-viewports.json', import.meta.url), 'utf8'));
  const token = randomUUID();
  let saveQueue = Promise.resolve();
  let origin;

  const server = createServer(async (request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; frame-src http: https:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
    const send = (status, body, type = 'application/json') => {
      response.writeHead(status, { 'Content-Type': type });
      response.end(type === 'application/json' ? JSON.stringify(body) : body);
    };
    try {
      if (request.headers.host !== new URL(origin).host) return send(403, { error: 'Use the workspace URL printed by the CLI.' });
      const pathname = new URL(request.url, origin).pathname;
      if (request.method === 'GET' && pathname === '/api/workspace') {
        return send(200, { settings, catalog, token, configPath });
      }
      if (request.method === 'POST' && pathname === '/api/settings') {
        if (request.headers.origin !== origin || request.headers['x-harness-token'] !== token) {
          return send(403, { error: 'Save settings from the workspace tab.' });
        }
        let body = '';
        for await (const chunk of request) {
          body += chunk;
          if (body.length > 32768) return send(413, { error: 'Configuration is too large.' });
        }
        let next;
        try { next = parseSettings(JSON.parse(body)); }
        catch (error) { return send(400, { error: error.message }); }
        const persist = async () => {
          const temporary = `${configPath}.${randomUUID()}.tmp`;
          try {
            await writeFile(temporary, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
            await rename(temporary, configPath);
            settings = next;
          } finally { await rm(temporary, { force: true }); }
        };
        const saving = saveQueue.then(persist);
        saveQueue = saving.catch(() => {});
        await saving;
        return send(200, { settings });
      }
      if (request.method === 'GET' && files.has(pathname)) {
        const [file, type] = files.get(pathname);
        return send(200, await readFile(new URL(file, import.meta.url)), type);
      }
      return send(404, { error: 'Not found.' });
    } catch (error) {
      return send(500, { error: error.message });
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  const listenOrigin = new URL(`http://127.0.0.1:${server.address().port}`).origin;
  origin = publicOrigin ?? listenOrigin;
  return { server, origin, listenOrigin, close: async () => {
    await saveQueue;
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  } };
}
