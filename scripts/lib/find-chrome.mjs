// 定位 desktop Chrome 的可执行文件，供 scripts/ 下的工具脚本共用。
//
// 探测顺序：NANOGLOSS_CHROME 环境变量 → 平台默认安装路径（Windows 的 Program Files /
// LocalAppData，macOS 的 .app）→ Linux 的 which。找不到时直接退出，因为所有调用方
// 没有 Chrome 都无法继续。
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { execa } from 'execa';

export async function findChrome() {
  if (process.env.NANOGLOSS_CHROME) {
    if (!existsSync(process.env.NANOGLOSS_CHROME)) {
      console.error(`NANOGLOSS_CHROME 指向的文件不存在: ${process.env.NANOGLOSS_CHROME}`);
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

  console.error('没找到 Chrome。请安装 desktop Chrome 138+，或用 NANOGLOSS_CHROME 指定路径。');
  process.exit(1);
}
