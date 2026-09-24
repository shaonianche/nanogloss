// nanogloss 测试环境启动器
//
// 做什么：
//   1. 在 %TEMP%\nanogloss-test 起一个静态服务器（127.0.0.1:8791），serve 内置测试页
//   2. 用独立 profile（%TEMP%\nanogloss-test-profile）启动 Chrome，带远程调试端口 9222
//   3. 通过 CDP `Extensions.loadUnpacked` 加载 .output/chrome-mv3
//      （Chrome 137+  branded 版移除了 --load-extension，142+ 连
//       --disable-features=DisableLoadExtensionCommandLineSwitch  workaround 也失效，
//       只能走 CDP 或 chrome://extensions 手动 Load unpacked）
//   4. 打开测试页和扩展设置页
//
// 用法：pnpm build 之后运行 `node scripts/test-profile.mjs`
// 注意：语言包按 profile 存储，测试 profile 里首次翻译需要重新下载模型。
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const EXT_DIR = join(ROOT, '.output', 'chrome-mv3');
const TMP = process.env.TEMP || 'C:\\Users\\duanfei\\AppData\\Local\\Temp';
const PROFILE = join(TMP, 'nanogloss-test-profile');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const CDP_PORT = 9222;
const PAGE_PORT = 8791;

if (!existsSync(join(EXT_DIR, 'manifest.json'))) {
  console.error('没有找到 .output/chrome-mv3，先跑 pnpm build');
  process.exit(1);
}

// --- 内置测试页 ---
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
<h1>nanogloss 划词翻译测试页</h1>
<p class="hint">选中任意段落测试气泡翻译。覆盖：auto/alt/manual 触发、多语言、滚动容器选区、短文本边界、连续重复选择。</p>

<section>
  <h2>English → 中文</h2>
  <p>The quick brown fox jumps over the lazy dog. Machine translation has improved dramatically over the past decade, and on-device models now make it possible to translate text without sending anything to a server.</p>
  <p>Chrome ships a built-in Translator API that downloads language packs on demand. Once a pack is ready, translations are fast and work offline.</p>
</section>

<section>
  <h2>Deutsch → 中文</h2>
  <p>Die maschinelle Übersetzung hat sich in den letzten zehn Jahren enorm verbessert. Lokale Modelle ermöglichen es, Texte zu übersetzen, ohne Daten an einen Server zu senden.</p>
</section>

<section>
  <h2>Français → 中文</h2>
  <p>La traduction automatique a fait des progrès considérables au cours de la dernière décennie. Les modèles locaux permettent désormais de traduire du texte sans rien envoyer à un serveur.</p>
</section>

<section>
  <h2>日本語 → 中文</h2>
  <p>機械翻訳は過去10年間で飛躍的に向上しました。オンデバイスモデルのおかげで、サーバーに何も送信せずにテキストを翻訳できるようになりました。</p>
</section>

<section>
  <h2>短文本（minCharacters 边界）</h2>
  <p>Hello world.</p>
  <p>Hi.</p>
</section>

<section>
  <h2>滚动容器内的选区</h2>
  <div class="scrollbox">
    <p>Scrollable content starts here. Select text while this box is scrolled to different positions to verify the bubble anchors correctly.</p>
    <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer posuere erat a ante venenatis dapibus posuere velit aliquet.</p>
    <p>Cras mattis consectetur purus sit amet fermentum. Donec ullamcorper nulla non metus auctor fringilla. Vestibulum id ligula porta felis euismod semper.</p>
    <p>Aenean lacinia bibendum nulla sed consectetur. Maecenas faucibus mollis interdum. Scrollable content ends here.</p>
  </div>
</section>

<section>
  <h2>代码块</h2>
  <p><code>const answer = await translator.translate("Good morning, everyone!");</code></p>
</section>
</body>
</html>
`;

// --- 静态服务器（如果 8791 已被占用就直接复用） ---
const server = createServer((req, res) => {
  res.setHeader('content-type', 'text/html; charset=utf-8');
  res.end(TEST_PAGE);
});
server.on('error', () => console.log(`:${PAGE_PORT} 已有服务在跑，复用现有服务器`));
server.listen(PAGE_PORT, '127.0.0.1', () => console.log(`测试页: http://127.0.0.1:${PAGE_PORT}/`));

// --- 关掉旧的测试 Chrome ---
spawnSync('taskkill', ['/F', '/IM', 'chrome.exe', '/FI', 'WINDOWTITLE eq nanogloss-never-matches'], { stdio: 'ignore' });
// taskkill 按窗口标题匹配不可靠，改用 WMIC 按命令行匹配：
spawnSync('powershell', ['-NoProfile', '-Command',
  `Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -match 'nanogloss-test-profile' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }`
], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1500));

// --- 启动 Chrome ---
mkdirSync(PROFILE, { recursive: true });
const chrome = spawn(CHROME, [
  `--user-data-dir=${PROFILE}`,
  `--remote-debugging-port=${CDP_PORT}`,
  '--remote-allow-origins=*',
  '--no-first-run',
  '--no-default-browser-check',
  '--new-window',
  'about:blank',
], { detached: true, stdio: 'ignore' });
chrome.unref();

// --- 等 CDP 起来 ---
let version = null;
for (let i = 0; i < 30; i++) {
  try { version = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).json(); break; }
  catch { await new Promise(r => setTimeout(r, 500)); }
}
if (!version) { console.error('CDP 没起来'); process.exit(1); }

// --- 通过 CDP 加载扩展 ---
const ws = new WebSocket(version.webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
const loadResult = await new Promise(res => {
  ws.onmessage = e => res(JSON.parse(e.data));
  ws.send(JSON.stringify({ id: 1, method: 'Extensions.loadUnpacked', params: { path: EXT_DIR } }));
});
const extId = loadResult.result?.id;
if (!extId) { console.error('扩展加载失败:', JSON.stringify(loadResult)); process.exit(1); }
ws.close();
console.log(`扩展已加载: ${extId}`);

// --- 扩展加载后再开页面，保证内容脚本注入 ---
await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?http://127.0.0.1:${PAGE_PORT}/`, { method: 'PUT' });
await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?chrome-extension://${extId}/options.html`, { method: 'PUT' });

console.log('');
console.log('测试环境就绪：');
console.log(`  测试页   http://127.0.0.1:${PAGE_PORT}/`);
console.log(`  设置页   chrome-extension://${extId}/options.html`);
console.log(`  profile  ${PROFILE}`);
console.log('');
console.log('提示：Ctrl+C 退出本脚本不会关闭 Chrome；测试页服务器随脚本退出。');
