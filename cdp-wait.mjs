// Minimal CDP driver (Node 22+, no deps): open a URL in headless Chrome, wait for a
// window flag, print document.title. Usage:
//   node cdp-wait.mjs <url> <flag> <timeoutMs>
import { spawn } from 'node:child_process';

const [url, flag, timeoutMs] = [process.argv[2], process.argv[3], Number(process.argv[4] || 240000)];
const CHROME = process.env.CHROME || '/home/hatch/workspace/x-session/chrome-extracted/opt/google/chrome/chrome';
const PORT = 9223;
const chrome = spawn(CHROME, [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
  '--no-proxy-server', `--remote-debugging-port=${PORT}`,
  '--user-data-dir=/tmp/chrome-cdp-profile', '--window-size=1280,720', 'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(path) {
  for (let i = 0; i < 60; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}${path}`);
      if (res.ok) return await res.json();
    } catch { /* retry */ }
    await sleep(500);
  }
  throw new Error(`no devtools endpoint ${path}`);
}

const targets = await getJson('/json/list');
let page = targets.find((t) => t.type === 'page');
if (!page) throw new Error('no page target');
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const mid = ++id;
  pending.set(mid, { resolve, reject });
  ws.send(JSON.stringify({ id: mid, method, params }));
});
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    if (msg.error) pending.get(msg.id).reject(new Error(msg.error.message));
    else pending.get(msg.id).resolve(msg.result);
    pending.delete(msg.id);
  }
};
await new Promise((r) => { ws.onopen = r; });
await send('Page.enable');
await send('Runtime.enable');
await send('Page.navigate', { url });
const t0 = Date.now();
let title = '';
let done = false;
while (Date.now() - t0 < timeoutMs) {
  const r = await send('Runtime.evaluate', { expression: `window.${flag} ? document.title : ''`, returnByValue: true });
  if (r && r.result && r.result.value) { title = r.result.value; done = true; break; }
  await sleep(500);
}
if (!done) {
  const r = await send('Runtime.evaluate', { expression: 'document.title', returnByValue: true });
  title = `TIMEOUT title=${r && r.result ? r.result.value : '?'}`;
}
console.log(title);
chrome.kill();
process.exit(done ? 0 : 1);
