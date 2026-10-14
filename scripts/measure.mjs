import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const url = process.argv[2] || 'https://www.serenematt.com/';
const outDir = mkdtempSync(join(tmpdir(), 'serenematt-lighthouse-'));
const outPath = join(outDir, 'report.json');
const lighthouseCli = fileURLToPath(import.meta.resolve('lighthouse/cli/index.js'));

const result = spawnSync(
  process.execPath,
  [
    lighthouseCli,
    url,
    '--quiet',
    '--chrome-flags=--headless --no-sandbox',
    '--output=json',
    `--output-path=${outPath}`,
  ],
  { stdio: 'inherit' },
);

if (result.status !== 0) {
  process.exit(result.status || 1);
}

const report = JSON.parse(readFileSync(outPath, 'utf8'));
rmSync(outDir, { recursive: true, force: true });

const audits = report.audits;
const rows = [
  ['Performance score', `${Math.round(report.categories.performance.score * 100)}/100`],
  ['First Contentful Paint', audits['first-contentful-paint'].displayValue],
  ['Largest Contentful Paint', audits['largest-contentful-paint'].displayValue],
  ['Total Blocking Time', audits['total-blocking-time'].displayValue],
  ['Cumulative Layout Shift', audits['cumulative-layout-shift'].displayValue],
  ['Speed Index', audits['speed-index'].displayValue],
  ['Time to Interactive', audits.interactive.displayValue],
  ['Server response time', audits['server-response-time'].displayValue],
];

console.log(`# Web vitals for ${url}`);
console.log(`Measured: ${report.fetchTime}`);
console.log('Environment: Lighthouse 13.5.0, headless Chrome, default mobile throttling.');
console.log('');
console.log('| Metric | Result |');
console.log('| --- | --- |');
for (const [metric, value] of rows) {
  console.log(`| ${metric} | ${value} |`);
}
