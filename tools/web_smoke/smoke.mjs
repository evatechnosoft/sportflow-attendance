// Playwright smoke test for the Vite build (npm run build -> dist).
// Serves dist, boots the app headless and fails on uncaught page errors or if
// the app shell does not render. Without Firebase env the app runs on mock data,
// so this proves the guarded Remote Config init is skipped without breaking boot.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { chromium } from 'playwright';

const root = resolve(process.argv[2] ?? '../../dist');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.wasm': 'application/wasm', '.json': 'application/json', '.css': 'text/css',
  '.png': 'image/png', '.otf': 'font/otf', '.ttf': 'font/ttf' };

const server = createServer(async (req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path.endsWith('/')) path += 'index.html';
  const file = join(root, normalize(path));
  if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
  let body;
  try { body = await readFile(file); } catch { console.log('[404]', path); res.writeHead(404).end(); return; }
  res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' }).end(body);
}).listen(0);
const url = `http://127.0.0.1:${server.address().port}/`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 412, height: 915 } });
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));
page.on('console', (m) => { console.log('[' + m.type() + ']', m.text().slice(0, 200)); });

let ok = false;
try {
  await page.goto(url);
  await page.waitForSelector('h1', { timeout: 30000 });
  await page.waitForSelector('nav button', { timeout: 30000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'smoke.png' });
  const tabs = await page.$$eval('nav button', (b) => b.map((x) => x.textContent?.trim()));
  console.log('tabs:', tabs.join(','));
  if (!tabs.includes('Yoklama') || !tabs.includes('Geçmiş')) pageErrors.push('expected default-on tabs missing');
  ok = pageErrors.length === 0;
} catch (e) {
  pageErrors.push(String(e));
}
console.log(ok ? 'SMOKE PASS' : `SMOKE FAIL\n${pageErrors.join('\n')}`);
await browser.close();
server.close();
process.exit(ok ? 0 : 1);
