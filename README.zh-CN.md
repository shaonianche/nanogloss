# NanoGloss

[English](README.md) · [简体中文](README.zh-CN.md)

在任意网页划词，通过 **Chrome 内置 Translator API** 在本地完成翻译——语言包下载后即可离线使用，无需后端服务、账号或 API 密钥。

## 功能特性

- **划词翻译气泡**：自动区分正文与代码块，正文送去翻译，代码块原样保留。
- **灵活的触发方式**：支持划词后立即翻译，或通过快捷手势（按住 Alt 键、长按鼠标左键，或两者并用）按需触发，避免日常选字误弹出。
- **本地语言包管理**：按需下载语言包，在气泡内实时展示下载进度，并在设置页查看已就绪的语言包列表。
- **界面本地化**：自动跟随 Chrome 界面语言（支持英语、简体中文、繁体中文和日语），并按当前语言环境显示语言名称。
- **浅色与深色主题**：跟随系统外观或按设置切换浅色、深色主题。
- **翻译测试台**：在设置页内直接测试当前配置的语言组合与本地模型。

运行环境要求桌面端 Chrome 138 或更高版本。移动端浏览器以及 Edge、Firefox、Safari 暂未提供内置 Translator API。

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
pnpm dev          # 监听构建到 .output/chrome-mv3
pnpm test         # 运行 Vitest（jsdom）测试
pnpm type-check   # 运行 TypeScript 类型检查
pnpm build        # 构建产物位于 .output/chrome-mv3，可在 chrome://extensions 中开启开发者模式后加载
pnpm zip          # 生成 Chrome 应用商店归档 .output/nanogloss-<version>-chrome.zip
```

辅助脚本：

- `pnpm test:profile`（`scripts/test-profile.mjs`）：使用独立配置文件启动带 9222 调试端口的 Chrome，通过 CDP 加载 `.output/chrome-mv3`，并在 `127.0.0.1:8791` 启动内置测试页。重新构建后需再次运行该脚本，通过重启 Chrome 重新加载扩展。
- `pnpm icons`（`scripts/generate-icons.mjs`）：将 `public/icon/128.svg` 光栅化为各尺寸 PNG 图标。

## 目录结构

```
public/
  _locales/           Chrome 扩展多语言文案目录（en、ja、zh_CN、zh_TW）
  icon/               扩展图标（SVG 源文件与生成的 PNG）
src/
  assets/styles/
    heroui.css        所有入口共用的 HeroUI 基础样式（Token、基础样式、工具类与变体）
  entrypoints/
    background.ts     安装后及点击工具栏按钮时打开设置页
    content/          内容脚本：选区解析与 Shadow Root 内的翻译气泡
      index.tsx         事件监听、触发模式与气泡定位
      selection.ts      读取选区并拆分正文与代码块
      selection.test.ts 选区拆分规则的 Vitest（jsdom）测试
      selection-bubble.tsx   划词气泡界面（仅使用 HeroUI 原地渲染组件）
      style.css         注入到 Shadow Root 的样式（cssInjectionMode: "ui"）
    options/          设置页（语言包、触发方式、系统状态与翻译测试台）
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

## 许可证

MIT（见 `LICENSE`）。
