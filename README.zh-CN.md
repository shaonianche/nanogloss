# NanoGloss

[English](README.md) · [简体中文](README.zh-CN.md)

在任意网页划词，通过 **Chrome 内置 Translator API** 在本地完成翻译——语言包下载后即可离线使用，无需后端服务、账号或 API 密钥。

![NanoGloss 气泡在原文旁显示选中段落的译文](docs/store-assets/zh_CN/01-bubble.png)

## 实测翻译速度与本地 AI 模型

翻译与语种检测全部在浏览器本机进程内执行，省去了云端接口的网络往返与排队等待：

- **短句约 `0.2 秒` 即出完整译文**：从松开鼠标触发到气泡渲染完成，直连英语的语言组合（`en → zh`、`zh → en`、`en → ja`）实测为 `208–228 ms`，经英语中转的双包组合（`ja → zh`）为 `317 ms`。
- **长文约 `0.23 秒` 流式出首字**：底层模型纯推理首块输出（TTFT）仅需 `25–62 ms`（算上每次新建 `Translator` 实例的约 `140 ms` 及界面渲染，气泡端到端首字上屏为 `221–235 ms`）。约 50 词的中等段落（~325 字符）`341–377 ms` 译完，3 个自然段长文（~1,400 字符）`0.82–1.01 秒` 译完（`en → zh` / `en → ja`）。
- **重复划选约 `6 ms` 瞬时响应**：当前标签页最近译过的文本命中内存缓存时，中位数仅 `5.8 ms`。
- **语言包单次下载约 `3.2 秒`（约 `76 MB`）**：下载一次后即可断网离线翻译，划词内容全程不出本机。

以上数据在 MacBook Pro（`MacBookPro15,1`，Intel Core i9-9880H，16 GB 内存，macOS 15.8.3）、Chrome `157.0.8103.79` 上通过 `performance.now()` 与 `MutationObserver` 逐次换新文本实测；实际速度因设备硬件与语言组合而异。

在模型架构上，Chrome 的 [Translator API](https://developer.chrome.com/docs/ai/translator-api) 与 [Language Detector API](https://developer.chrome.com/docs/ai/language-detection) 采用专为翻译与语种排序训练的轻量级**专家模型**（底层为 `TranslateKit` 与 TensorFlow Lite 双向 NMT 权重，单个语言包在磁盘占约 `76–77 MiB`），而非体积庞大的 Gemini Nano 生成式基础模型，因此不受 Gemini Nano 的 22 GB 可用磁盘空间与显存门槛限制。完整的分语种测试表格、底层 API 耗时拆解、磁盘目录结构以及隐私与平台限制说明，详见 [docs/on-device-translation.zh-CN.md](docs/on-device-translation.zh-CN.md)。

## 功能特性

- **划词翻译气泡**：自动区分正文与块级代码（`<pre>`），正文送去翻译，块级代码原样保留。
- **灵活的触发方式**：支持划词后立即翻译，或通过快捷手势（按住 Alt 键、长按鼠标左键，或两者并用）按需触发，避免日常选字误弹出。
- **本地语言包管理**：按需下载语言包，在气泡内实时展示下载进度，并在设置页查看已就绪的语言包列表。
- **界面本地化**：自动跟随 Chrome 界面语言（支持英语、简体中文、繁体中文和日语），并按当前语言环境显示语言名称。
- **浅色与深色主题**：跟随系统外观或按设置切换浅色、深色主题。
- **翻译测试台**：在设置页内直接测试当前配置的语言组合与本地模型。

运行环境要求桌面端 Chrome 138 或更高版本。移动端浏览器以及 Edge、Firefox、Safari 暂未提供内置 Translator API。

## 安装

NanoGloss 尚未上架 Chrome 应用商店。上架前请从源码加载。需要 Node.js 26 和 pnpm 12（版本见 `package.json`）。

1. 克隆仓库并构建扩展：

   ```bash
   git clone https://github.com/shaonianche/nanogloss.git
   cd nanogloss
   pnpm install
   pnpm build
   ```

2. 打开 `chrome://extensions`，开启开发者模式。
3. 点击“加载已解压的扩展程序”，选择 `.output/chrome-mv3`。

安装后会自动打开欢迎页：一个带导览的练习页面，依次检查浏览器、设置语言并下载语言包，再带你在练习文本上试用每种触发方式，弹出的是真实气泡，并显示每次翻译的用时。之后点击工具栏按钮会打开设置页，页面顶部的“使用导览”可以再次打开欢迎页。

## 使用

按住 Alt 键（macOS 为 Option 键）划词，或在划词结束时按住鼠标左键不放，译文会显示在原文旁的气泡里。按 Esc 或点击页面其他位置可关闭气泡。在设置页可以改为每次划词都翻译，并设置源语言和目标语言。

两种语言之间的第一次翻译需要通过 Chrome 下载约 76 MB 的语言包，气泡会提示点击后开始下载。

## 已知限制

- Chrome 不允许扩展在其自身页面（`chrome://…`、Chrome 应用商店）上运行，这些页面无法翻译。
- Chrome 只向顶层页面和同源 iframe 提供 Translator API。在跨域 iframe 中 NanoGloss 不会工作，除非嵌入它的页面通过 `allow="translator"` 授权。
- 输入框和可编辑区域内的选区会被忽略。
- 只有块级代码会原样保留：`<pre>` 内的文本，以及只包含代码的段落。句子里的行内代码会随句子一起翻译，因为把它挖掉会让翻译引擎拿到一个残缺的句子。行内代码里的字符串或单词因此可能被改动。
- 设置页列出的是该页面当前可用的语言包。Chrome 按网站分别报告语言包状态，因此在网页上翻译时下载的语言包，可能要等设置页也用到该语言后才会出现在列表里。语言包本身已经在磁盘上。
- 语言包首次下载偶尔会失败，点击气泡或设置页里的“重试”通常就能成功。
- “系统状态”标签里链接的 `chrome://on-device-translation-internals/` 在部分 Chrome 版本中是空白页（Chrome 157 上如此）。
- Chrome 以英语作为中转语言，不含英语的语言组合需要两种语言各自的语言包。
- 支持的语言由 Chrome 决定，某个语言组合在设备上是否可用也由 Chrome 决定。

## 技术栈

| 项目 | 说明 |
|---|---|
| 扩展框架 | WXT 0.21（MV3、Vite 8） |
| 界面组件 | React 19 + **HeroUI v3**（基于 Tailwind CSS 4） |
| 开发语言 | TypeScript 7 |
| 页面注入界面 | Shadow DOM（`createShadowRootUi`），样式与宿主网页隔离 |

### HeroUI 样式按需引入策略

项目将 HeroUI 的样式拆分为基础层与组件层，每个入口只打包实际渲染的组件样式：

- `src/assets/styles/heroui.css`：基础层（主题 Token、基础样式、自定义工具类与变体），由使用 HeroUI 的入口共同引入。
- 各入口的 `style.css` 仅按需引入实际用到的组件样式，例如 `@import "@heroui/styles/components/card.css";`。

若直接全量引入 `@import "@heroui/styles"`，会把全部 85 个组件打包进来，导致内容脚本注入到每个页面的 CSS 体积从约 60 kB 膨胀到约 446 kB。

另外两点实现细节：

- 需要显式引入 `tw-animate-css`，HeroUI 的弹层与动画工具类依赖该包。
- HeroUI 将主题变量声明在 `:root, :host` 上，因此可在 Shadow Root 内生效。但基于 React Aria **Portal** 实现的组件（如 `Select`、`Popover`、`Tooltip`）会挂载到 Shadow Root 外部并丢失样式，因此划词气泡仅使用原地渲染组件，设置页则可使用全部组件。

## 本地开发

```bash
pnpm install
pnpm dev          # 监听构建到 .output/chrome-mv3-dev
pnpm lint         # 运行 oxlint 代码检查
pnpm test         # 运行 Vitest（jsdom）测试；pnpm test:coverage 会附带覆盖率表
pnpm type-check   # 运行 TypeScript 类型检查
pnpm build        # 构建产物位于 .output/chrome-mv3，可在 chrome://extensions 中开启开发者模式后加载
pnpm zip          # 生成 Chrome 应用商店归档 .output/nanogloss-<version>-chrome.zip
```

`pnpm dev` 写入 `.output/chrome-mv3-dev`；`pnpm build` 写入 `.output/chrome-mv3`。

发布：推送与 `package.json` 版本一致的 `v<version>` 标签，Release 工作流会把 `pnpm zip` 生成的归档附加到 GitHub Release。上传到 Chrome 应用商店仍需在开发者后台手动完成。

辅助脚本：

- `pnpm test:profile`（`scripts/test-profile.mjs`）：使用独立配置文件启动带 9222 调试端口的 Chrome，通过 CDP 加载 `.output/chrome-mv3`，并在 `127.0.0.1:8791` 启动内置测试页。重新构建后需再次运行该脚本，通过重启 Chrome 重新加载扩展。
- `pnpm icons`（`scripts/generate-icons.mjs`）：将 `public/icon/128.svg` 光栅化为各尺寸 PNG 图标。

## 目录结构

```
docs/
  on-device-translation.md        Chrome 本地翻译模型与实测速度说明（英文）
  on-device-translation.zh-CN.md  Chrome 本地翻译模型与实测速度说明（简体中文）
  chrome-web-store.md             Chrome 应用商店后台文案
  store-assets/                   Chrome 应用商店截图与宣传图
public/
  _locales/           Chrome 扩展多语言文案目录（en、ja、zh_CN、zh_TW）
  icon/               扩展图标（SVG 源文件与生成的 PNG）
  LICENSE.txt         MIT 许可证，随扩展打包
  THIRD_PARTY_NOTICES.txt  第三方许可证，随扩展打包
src/
  assets/styles/
    heroui.css        所有入口共用的 HeroUI 基础样式（Token、基础样式、工具类与变体）
  entrypoints/
    background.ts     安装后打开欢迎页，点击工具栏按钮时打开设置页
    content/          内容脚本：选区解析与 Shadow Root 内的翻译气泡
                      （欢迎页也会运行 selection-translator.tsx）
      index.tsx         事件监听、触发模式与气泡定位
      selection.ts      读取选区并拆分正文与代码块
      selection.test.ts 选区拆分规则的 Vitest（jsdom）测试
      index.test.ts     触发手势与气泡定位的 Vitest（jsdom）测试
      selection-bubble.tsx   划词气泡界面（仅使用 HeroUI 原地渲染组件）
      style.css         注入到 Shadow Root 的样式（cssInjectionMode: "ui"）
    options/          设置页（语言包、触发方式、系统状态与翻译测试台）
    welcome/          欢迎页：带导览的练习页面，安装后打开
  utils/
    i18n.ts           对 chrome.i18n.getMessage 的类型安全封装与英文回退
    languages.ts      Chrome 翻译引擎支持的语言代码、别名与本地化名称
    translator.ts     Chrome 内置 Translator API 的类型封装
    translation-controller.ts   选区到翻译结果的状态机（供气泡与测试台共用）
    segments.ts       选区正文与代码块的数据模型
    storage.ts        基于 chrome.storage.local 的设置持久化
    theme.ts          按设置与系统外观解析浅色/深色主题
    browser-support.ts  检测浏览器能力（Translator API、语言检测器与版本）
    styles/           重命名 Tailwind `--tw-*` 自定义属性的 PostCSS 插件
```

### 为什么需要自定义 PostCSS 插件

划词气泡运行在任意网页的 Shadow Root 中。Shadow DOM 能够隔离选择器规则，但 CSS 自定义属性和 `rem` 单位仍会穿透边界。因此在构建阶段将 `--tw-*` 重命名为 `--ng-tw-*` 并将 `rem` 转换为 `px`，避免宿主网页自身的 Tailwind 样式影响气泡外观。

## 隐私

NanoGloss 不收集任何数据，自身也不发起任何网络请求，详见 [PRIVACY.md](PRIVACY.md)。
Chrome 应用商店后台需要填写的内容见 [docs/chrome-web-store.md](docs/chrome-web-store.md)。

## 参与贡献

参见 [CONTRIBUTING.md](CONTRIBUTING.md) 和 [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)。安全漏洞请按 [SECURITY.md](SECURITY.md) 的说明报告。版本变更记录见 [CHANGELOG.md](CHANGELOG.md)。

## 许可证

源代码以 [MIT 许可证](LICENSE) 开源。第三方声明见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)；完整的依赖列表与许可证文本在 `public/THIRD_PARTY_NOTICES.txt`，打包后为 `THIRD_PARTY_NOTICES.txt`。

NanoGloss 名称、Logo、扩展图标、Chrome 应用商店截图与宣传图，以及商店文案属于品牌资源，不在 MIT 许可证的授权范围内，详见 [BRAND.md](BRAND.md)。
