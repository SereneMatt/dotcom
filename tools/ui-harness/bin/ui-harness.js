#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { startHarness } from '../src/server.js';

const help = `UI harness — inspect a running site at multiple viewport sizes.

Usage: ui-harness [URL] [options]

  --config PATH  Settings file (default: ./ui-harness.config.json)
  --port NUMBER  Listen port (default: PORT environment variable or 4317)
  --origin URL   Public workspace origin (default: PORTLESS_URL or listen URL)
  --no-open      Print the workspace URL without opening a browser
  --help         Show this help
  --version      Print the package version

Examples:
  ui-harness http://localhost:4173
  ui-harness http://dotcom.localhost
  portless harness ui-harness https://dotcom.localhost
  ui-harness --config ./ui-harness.config.json

Port-free targets must already be served on HTTP port 80 or HTTPS port 443.
The harness does not configure DNS, certificates, or a reverse proxy.
`;

try {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    config: { type: 'string' }, port: { type: 'string' }, origin: { type: 'string' },
    'no-open': { type: 'boolean' }, help: { type: 'boolean' }, version: { type: 'boolean' },
  } });
  if (values.help) process.stdout.write(help);
  else if (values.version) {
    const { readFile } = await import('node:fs/promises');
    const { version } = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
    process.stdout.write(`${version}\n`);
  } else {
    if (positionals.length > 1) throw new Error('Pass one development URL. Use --help for usage.');
    const port = Number(values.port ?? process.env.PORT ?? 4317);
    if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Port must be a whole number between 0 and 65535.');
    const configPath = resolve(values.config || 'ui-harness.config.json');
    const harness = await startHarness({
      url: positionals[0], configPath, port, publicOrigin: values.origin ?? process.env.PORTLESS_URL,
    });
    process.stdout.write(`UI harness: ${harness.origin}\nSettings: ${configPath}\nPress Ctrl+C to stop.\n`);
    if (!values['no-open']) {
      const command = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'explorer.exe' : 'xdg-open';
      const browser = spawn(command, [harness.origin], { stdio: 'ignore', detached: true });
      browser.on('error', () => process.stderr.write(`Open ${harness.origin} in your browser.\n`));
      browser.unref();
    }
    let stopping = false;
    const stop = async () => {
      if (stopping) return;
      stopping = true;
      await harness.close();
    };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
  }
} catch (error) {
  process.stderr.write(`UI harness: ${error.message}\n`);
  process.exitCode = 1;
}
