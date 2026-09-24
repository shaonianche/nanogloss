/**
 * Rasterises public/icon/128.svg into the PNG sizes the extension needs
 * (public/icon/{16,32,48,96,128}.png), using headless Chrome — the one browser this
 * project already requires, so there is no extra tooling to install.
 *
 * Each size is a screenshot of the SVG rendered at exactly that many CSS pixels with a
 * transparent background. Run after editing the SVG: `node scripts/generate-icons.mjs`.
 */
import { execFileSync } from "node:child_process"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe"
const SIZES = [16, 32, 48, 96, 128]

const svgPath = resolve("public/icon/128.svg").replace(/\\/g, "/")

for (const size of SIZES) {
  const workDir = mkdtempSync(join(tmpdir(), "nanogloss-icon-"))
  const pagePath = join(workDir, "page.html").replace(/\\/g, "/")
  const outPath = resolve(`public/icon/${size}.png`)

  writeFileSync(
    pagePath,
    `<!doctype html><html><body style="margin:0">`
      + `<img src="file:///${svgPath}" width="${size}" height="${size}" alt="">`
      + `</body></html>`,
  )

  execFileSync(CHROME, [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--force-device-scale-factor=1",
    "--default-background-color=00000000",
    `--user-data-dir=${workDir}`,
    `--screenshot=${outPath}`,
    `--window-size=${size},${size}`,
    `file:///${pagePath}`,
  ], { stdio: "pipe" })

  rmSync(workDir, { recursive: true, force: true })
  console.log(`public/icon/${size}.png`)
}
