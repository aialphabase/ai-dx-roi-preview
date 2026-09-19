// Chrome を1つだけ立ち上げ、時刻を進めながらコマを書き出す。
// 使い方: node render_frames.mjs <index.htmlのfile URL（?s= 付き）> <出力先> <コマ数> <fps> <alpha|opaque>
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [, , pageUrl, outDir, framesStr, fpsStr, mode] = process.argv;
const frames = Number(framesStr), fps = Number(fpsStr), alpha = mode === 'alpha';
const PORT = 9333 + (process.pid % 200);
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const profile = join(tmpdir(), 'scene-render-' + process.pid);

mkdirSync(outDir, { recursive: true });
mkdirSync(profile, { recursive: true });

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--mute-audio',
  '--no-first-run', '--no-default-browser-check',
  `--user-data-dir=${profile}`, `--remote-debugging-port=${PORT}`,
  '--window-size=1920,1080', 'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForDevTools() {
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (r.ok) return;
    } catch { /* まだ起きていない */ }
    await sleep(200);
  }
  throw new Error('DevTools に繋がらない');
}

let id = 0;
const pending = new Map();
function call(ws, method, params = {}) {
  const msgId = ++id;
  ws.send(JSON.stringify({ id: msgId, method, params }));
  return new Promise((resolve, reject) => pending.set(msgId, { resolve, reject }));
}

const t0 = Date.now();
try {
  await waitForDevTools();
  const target = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => { ws.onopen = r; });
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id); pending.delete(m.id);
      m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result);
    }
  };

  await call(ws, 'Page.enable');
  await call(ws, 'Emulation.setDeviceMetricsOverride',
    { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  if (alpha) {
    await call(ws, 'Emulation.setDefaultBackgroundColorOverride',
      { color: { r: 0, g: 0, b: 0, a: 0 } });
  }
  await call(ws, 'Page.navigate', { url: pageUrl });
  await sleep(1200); // フォントと初期描画

  for (let i = 0; i < frames; i++) {
    const ms = Math.round((i * 1000) / fps);
    await call(ws, 'Runtime.evaluate', { expression: `seek(${ms})`, awaitPromise: false });
    const shot = await call(ws, 'Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
    writeFileSync(join(outDir, String(i).padStart(4, '0') + '.png'), Buffer.from(shot.data, 'base64'));
    if (i % 30 === 0) process.stdout.write(`  ${i}/${frames}\n`);
  }
  console.log(`  ${frames}コマ / ${((Date.now() - t0) / 1000).toFixed(1)}秒`);
} finally {
  chrome.kill();
  await sleep(400);
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* 片付けの失敗は無視する */ }
}
