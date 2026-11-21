// NanoGloss test environment launcher (cross-platform: Windows / macOS / Linux).
//
// What it does:
//   1. Starts a static server on 127.0.0.1:8791 that serves the built-in test page.
//   2. Starts Chrome with a dedicated profile (nanogloss-test-profile under the OS temp dir)
//      and a remote debugging port on 9222.
//   3. Loads .output/chrome-mv3 through CDP `Extensions.loadUnpacked`. Branded Chrome 137+
//      removed --load-extension, and from 142 the
//      --disable-features=DisableLoadExtensionCommandLineSwitch workaround no longer works
//      either, so the only ways in are CDP and "Load unpacked" on chrome://extensions.
//   4. Opens the test page and the extension's settings page.
//
// Usage: run `pnpm test:profile` after `pnpm build`. `--fresh` wipes the profile first;
//        `--headless` runs without a display, for containers and CI (Chrome headless=new).
// NANOGLOSS_CHROME sets the Chrome path explicitly, overriding detection.
// Language packs are stored per profile, so the first translation in the test profile
// downloads the model again.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execa } from 'execa';
import { findChrome } from './lib/find-chrome.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const EXT_DIR = join(ROOT, '.output', 'chrome-mv3');
const PROFILE = join(tmpdir(), 'nanogloss-test-profile');
const CDP_PORT = 9222;
const PAGE_PORT = 8791;
const FRESH = process.argv.includes('--fresh');
const HEADLESS = process.argv.includes('--headless');

if (!existsSync(join(EXT_DIR, 'manifest.json'))) {
  console.error('.output/chrome-mv3 not found. Run pnpm build first.');
  process.exit(1);
}

// --- Stop the previous test Chrome (only processes using this test profile) ---
async function killOldChrome() {
  if (process.platform === 'win32') {
    // taskkill matches by window title, which is unreliable; match the command line through CIM:
    await execa('powershell', ['-NoProfile', '-Command',
      `Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -match 'nanogloss-test-profile' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }`
    ], { reject: false, stdio: 'ignore' });
  } else {
    await execa('pkill', ['-f', 'nanogloss-test-profile'], { reject: false, stdio: 'ignore' });
  }
  await new Promise(r => setTimeout(r, 1500));
}

// --- Built-in test page ---
const TEST_PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>nanogloss test page</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 760px; margin: 40px auto; padding: 0 20px; line-height: 1.7; }
  section { margin-bottom: 28px; }
  h2 { margin-bottom: 4px; }
  .hint { color: #888; font-size: 13px; margin-top: 0; }
  .scrollbox { height: 140px; overflow-y: auto; border: 1px solid #ddd; border-radius: 8px; padding: 12px; }
  code { background: #f2f2f2; padding: 1px 5px; border-radius: 4px; }
</style>
</head>
<body>
<h1>NanoGloss selection test page</h1>
<p class="hint">Select any paragraph to try the bubble. Covers the trigger modes, several languages, a selection inside a scroll container, the minimum length, and repeated selections.</p>

<section>
  <h2>English</h2>
  <p>The quick brown fox jumps over the lazy dog. Machine translation has improved dramatically over the past decade, and on-device models now make it possible to translate text without sending anything to a server.</p>
  <p>Chrome ships a built-in Translator API that downloads language packs on demand. Once a pack is ready, translations are fast and work offline.</p>
</section>

<section>
  <h2>German</h2>
  <p>Die maschinelle Übersetzung hat sich in den letzten zehn Jahren enorm verbessert. Lokale Modelle ermöglichen es, Texte zu übersetzen, ohne Daten an einen Server zu senden.</p>
</section>

<section>
  <h2>French</h2>
  <p>La traduction automatique a fait des progrès considérables au cours de la dernière décennie. Les modèles locaux permettent désormais de traduire du texte sans rien envoyer à un serveur.</p>
</section>

<section>
  <h2>Japanese</h2>
  <p>機械翻訳は過去10年間で飛躍的に向上しました。オンデバイスモデルのおかげで、サーバーに何も送信せずにテキストを翻訳できるようになりました。</p>
</section>

<section>
  <h2>Short text (the minCharacters boundary)</h2>
  <p>Hello world.</p>
  <p>Hi.</p>
</section>

<section>
  <h2>Selection inside a scroll container</h2>
  <div class="scrollbox">
    <p>Scrollable content starts here. Select text while this box is scrolled to different positions to verify the bubble anchors correctly.</p>
    <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer posuere erat a ante venenatis dapibus posuere velit aliquet.</p>
    <p>Cras mattis consectetur purus sit amet fermentum. Donec ullamcorper nulla non metus auctor fringilla. Vestibulum id ligula porta felis euismod semper.</p>
    <p>Aenean lacinia bibendum nulla sed consectetur. Maecenas faucibus mollis interdum. Scrollable content ends here.</p>
  </div>
</section>

<section>
  <h2>Code block</h2>
  <p><code>const answer = await translator.translate("Good morning, everyone!");</code></p>
</section>
</body>
</html>
`;

// --- Static server (an existing one on 8791 is reused) ---
const server = createServer((req, res) => {
  res.setHeader('content-type', 'text/html; charset=utf-8');
  res.end(TEST_PAGE);
});
server.on('error', () => console.log(`:${PAGE_PORT} is already in use; reusing that server`));
server.listen(PAGE_PORT, '127.0.0.1', () => console.log(`Test page: http://127.0.0.1:${PAGE_PORT}/`));

await killOldChrome();

// --- Start Chrome ---
if (FRESH) {
  rmSync(PROFILE, { recursive: true, force: true });
}
mkdirSync(PROFILE, { recursive: true });
const CHROME = await findChrome();
console.log(`Chrome: ${CHROME}`);
const chrome = spawn(CHROME, [
  ...(HEADLESS ? ['--headless=new'] : []),
  `--user-data-dir=${PROFILE}`,
  `--remote-debugging-port=${CDP_PORT}`,
  '--remote-allow-origins=*',
  '--no-first-run',
  '--no-default-browser-check',
  '--new-window',
  'about:blank',
], { detached: true, stdio: 'ignore' });
chrome.unref();

// --- Wait for CDP ---
let version = null;
for (let i = 0; i < 30; i++) {
  try { version = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).json(); break; }
  catch { await new Promise(r => setTimeout(r, 500)); }
}
if (!version) { console.error('The CDP endpoint did not come up'); process.exit(1); }

// --- Load the extension through CDP ---
const ws = new WebSocket(version.webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r, { once: true }));
const loadResult = await new Promise(res => {
  ws.addEventListener('message', e => res(JSON.parse(e.data)), { once: true });
  ws.send(JSON.stringify({ id: 1, method: 'Extensions.loadUnpacked', params: { path: EXT_DIR } }));
});
const extId = loadResult.result?.id;
if (!extId) { console.error('Loading the extension failed:', JSON.stringify(loadResult)); process.exit(1); }
ws.close();
console.log(`Extension loaded: ${extId}`);

// --- Open the pages after the extension is loaded, so the content script is injected ---
await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?http://127.0.0.1:${PAGE_PORT}/`, { method: 'PUT' });
await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?chrome-extension://${extId}/options.html`, { method: 'PUT' });

console.log('');
console.log('Test environment ready:');
console.log(`  test page  http://127.0.0.1:${PAGE_PORT}/`);
console.log(`  settings   chrome-extension://${extId}/options.html`);
console.log(`  profile    ${PROFILE}`);
console.log('');
console.log('Ctrl+C stops this script and its test page server, not Chrome. Pass --fresh for a clean profile.');
