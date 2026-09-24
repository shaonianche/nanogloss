/**
 * Rasterises public/icon/128.svg into the PNG sizes the extension needs
 * (public/icon/{16,32,48,96,128}.png), using headless Chrome — the one browser this
 * project already requires, so there is no extra tooling to install.
 *
 * Each size is a CDP screenshot of the SVG rendered at exactly that many CSS pixels with a
 * transparent background. CDP (not one-shot `--screenshot`) because the one-shot mode hangs
 * with a fresh `--user-data-dir` in some environments, and reusing the default profile
 * conflicts with a running daily Chrome.
 *
 * Run after editing the SVG: `pnpm icons`.
 * Cross-platform (Windows/macOS/Linux); NANOGLOSS_CHROME overrides Chrome detection.
 */
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { spawn } from "node:child_process"
import { findChrome } from "./lib/find-chrome.mjs"

const SIZES = [16, 32, 48, 96, 128]

if (!existsSync("public/icon/128.svg")) {
  console.error("没有找到 public/icon/128.svg")
  process.exit(1)
}

const CHROME = await findChrome()
const svgPath = resolve("public/icon/128.svg").replace(/\\/g, "/")

// Chrome writes "<port>\n<ws path>" here once the debugger is up (--remote-debugging-port=0
// picks a free port, so a stale 9222 or a running daily Chrome never collides).
const workDir = mkdtempSync(join(tmpdir(), "nanogloss-icon-"))
const chrome = spawn(CHROME, [
  "--headless=new",
  "--disable-gpu",
  "--no-first-run",
  "--no-default-browser-check",
  `--user-data-dir=${workDir}`,
  "--remote-debugging-port=0",
  "about:blank",
], { stdio: "ignore" })

async function cleanup() {
  if (chrome.exitCode === null) {
    chrome.kill()
    // Wait for Chrome to exit: it holds files in workDir open, and deleting under a live
    // process fails with ENOTEMPTY/EPERM (especially on Windows).
    await new Promise(r => chrome.once("exit", r))
  }
  rmSync(workDir, { recursive: true, force: true, maxRetries: 3 })
}
process.on("exit", () => rmSync(workDir, { recursive: true, force: true, maxRetries: 3 }))

let cdpPort = null
for (let i = 0; i < 40; i++) {
  try {
    cdpPort = Number(readFileSync(join(workDir, "DevToolsActivePort"), "utf8").split("\n")[0])
    if (cdpPort > 0) break
  }
  catch { /* not up yet */ }
  await new Promise(r => setTimeout(r, 250))
}
if (!cdpPort) {
  console.error("Chrome 的 CDP 端口没起来")
  await cleanup()
  process.exit(1)
}

// The page target's own websocket speaks the page-level CDP domains (Page/Emulation).
const targets = await (await fetch(`http://127.0.0.1:${cdpPort}/json`)).json()
const page = targets.find(t => t.type === "page")
if (!page) {
  console.error("没有找到可用的 page target")
  await cleanup()
  process.exit(1)
}
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((resolveOpen, rejectOpen) => {
  ws.onopen = resolveOpen
  ws.onerror = rejectOpen
})

let nextId = 0
const pending = new Map()
const eventWaiters = new Map()
ws.onmessage = (e) => {
  const message = JSON.parse(e.data)
  if (message.id && pending.has(message.id)) {
    pending.get(message.id)(message)
    pending.delete(message.id)
  }
  else if (message.method && eventWaiters.has(message.method)) {
    eventWaiters.get(message.method)(message)
    eventWaiters.delete(message.method)
  }
}

function cdp(method, params = {}) {
  const id = ++nextId
  return new Promise((res, rej) => {
    pending.set(id, (message) => message.error ? rej(new Error(message.error.message)) : res(message.result))
    ws.send(JSON.stringify({ id, method, params }))
  })
}

function onceEvent(method, timeoutMs = 10000) {
  return new Promise((res, rej) => {
    const timer = setTimeout(() => rej(new Error(`等 ${method} 超时`)), timeoutMs)
    eventWaiters.set(method, (message) => {
      clearTimeout(timer)
      res(message)
    })
  })
}

await cdp("Page.enable")
// Same effect as one-shot's --default-background-color=00000000: keep the PNG transparent.
await cdp("Emulation.setDefaultBackgroundColorOverride", { color: { r: 0, g: 0, b: 0, a: 0 } })

for (const size of SIZES) {
  const pagePath = join(workDir, `page-${size}.html`).replace(/\\/g, "/")
  writeFileSync(
    pagePath,
    // overflow:hidden stands in for one-shot's --hide-scrollbars, which has no CDP equivalent.
    `<!doctype html><html><body style="margin:0;overflow:hidden">`
      + `<img src="file:///${svgPath}" width="${size}" height="${size}" alt="">`
      + `</body></html>`,
  )

  await cdp("Emulation.setDeviceMetricsOverride", { width: size, height: size, deviceScaleFactor: 1, mobile: false })
  const loaded = onceEvent("Page.loadEventFired")
  await cdp("Page.navigate", { url: `file:///${pagePath}` })
  await loaded

  const { data } = await cdp("Page.captureScreenshot", { format: "png" })
  const outPath = `public/icon/${size}.png`
  writeFileSync(outPath, Buffer.from(data, "base64"))
  console.log(outPath)
}

ws.close()
await cleanup()
process.exit(0)
