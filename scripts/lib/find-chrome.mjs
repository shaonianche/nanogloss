// Locates the desktop Chrome executable, for the scripts under scripts/.
//
// Order: the NANOGLOSS_CHROME environment variable, then the platform's default install paths
// (Program Files / LocalAppData on Windows, the .app on macOS), then `which` on Linux. Exits
// when nothing is found, because no caller can continue without Chrome.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { execa } from 'execa';

export async function findChrome() {
  if (process.env.NANOGLOSS_CHROME) {
    if (!existsSync(process.env.NANOGLOSS_CHROME)) {
      console.error(`NANOGLOSS_CHROME points to a file that does not exist: ${process.env.NANOGLOSS_CHROME}`);
      process.exit(1);
    }
    return process.env.NANOGLOSS_CHROME;
  }

  if (process.platform === 'win32') {
    const candidates = [
      join(process.env.PROGRAMFILES ?? 'C:\\Program Files', 'Google\\Chrome\\Application\\chrome.exe'),
      join(process.env['PROGRAMFILES(X86)'] ?? 'C:\\Program Files (x86)', 'Google\\Chrome\\Application\\chrome.exe'),
      join(process.env.LOCALAPPDATA ?? '', 'Google\\Chrome\\Application\\chrome.exe'),
    ];
    const found = candidates.find(p => p && existsSync(p));
    if (found) return found;
  } else if (process.platform === 'darwin') {
    const mac = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    if (existsSync(mac)) return mac;
  } else {
    for (const name of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']) {
      const { exitCode, stdout } = await execa('which', [name], { reject: false });
      if (exitCode === 0 && stdout.trim()) return stdout.trim();
    }
  }

  console.error('Chrome not found. Install desktop Chrome 138+, or set NANOGLOSS_CHROME to its path.');
  process.exit(1);
}
