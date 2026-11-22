# 架构与工程说明

[English](architecture.md) · [简体中文](architecture.zh-CN.md)

本文档记录 NanoGloss 的技术栈、Shadow DOM 样式隔离方案、目录结构与构建脚本。面向用户的安装与使用说明见 [README.zh-CN.md](../README.zh-CN.md)；Chrome 内置翻译模型原理与实测耗时拆解见 [on-device-translation.zh-CN.md](on-device-translation.zh-CN.md)。

## 技术栈

| 模块 | 选型 |
| --- | --- |
| 扩展框架 | WXT 0.21（Manifest V3、Vite 8） |
| 界面组件 | React 19 + **HeroUI v3**（基于 Tailwind CSS 4） |
| 开发语言 | TypeScript 7 |
| 页面注入界面 | Shadow DOM（`createShadowRootUi`），样式与宿主网页隔离 |

## HeroUI 样式按需引入策略

项目将 HeroUI 的样式拆分为基础层与组件层，每个入口只打包实际渲染的组件样式：

- `src/assets/styles/heroui.css`：公共基础层（主题 Token、基础规则、自定义工具类与变体），由所有使用 HeroUI 的入口引入。
- 各入口的 `style.css` 在 `layer(components)` 中仅按需引入实际用到的组件样式，例如 `@import "@heroui/styles/components/card.css" layer(components);`。

若直接全量引入 `@import "@heroui/styles"`，会把全部 85 个组件打包进来，导致内容脚本样式体积膨胀至约 446 kB（按需引入仅约 83 kB）。所有组件样式必须保留 `layer(components)`，否则未分层的组件规则会覆盖 Tailwind `utilities` 层中的 `className` 覆盖类。

Shadow DOM 划词气泡的关键约束：

- `heroui.css` 显式引入 `tw-animate-css`，供 HeroUI 的过渡与动画工具类使用。
- HeroUI 通过 `data-theme`（`:root, :host` 与 `[data-theme="dark"]`）切换浅色/深色变量。设置页、欢迎页与气泡容器均根据当前解析后的 `theme` 设置写入 `data-theme`。
- 基于 React Aria **Portal** 实现的组件（`Select`、`Popover`、`Tooltip`）会挂载到 Shadow Root 外部并丢失样式，因此页面内气泡仅使用原地渲染组件（`Card`、`ScrollShadow`、`Button`、`Alert`、`ProgressBar`、`Spinner`、`Typography`）。
- React Aria 默认忽略 Shadow DOM 内的真实指针与键盘事件，内容脚本通过调用 `react-stately/private/flags/flags` 的 `enableShadowDOM()` 开启支持；`package.json` 将 `react-stately` 锁定为与 `react-aria` 完全一致的版本，确保模块级开关作用于同一份实例。

## 为什么需要自定义 PostCSS 插件

划词气泡挂载在任意第三方网页的 Shadow Root 中。Shadow DOM 能隔离选择器规则，但 CSS 自定义属性（`--tw-*`）仍会跨边界继承，`rem` 单位也会按宿主网页 `<html>` 的字号计算。

构建阶段通过 `src/utils/styles/postcss-rename-custom-props.cjs` 将 `--tw-*` 重命名为 `--ng-tw-*`，并通过 `postcss-rem-to-responsive-pixel` 将 `rem` 转换为 `px`，避免宿主网页自身的 Tailwind 样式或根字号缩放干扰气泡外观。

## 目录结构

```text
docs/
  architecture.md                 技术栈、Shadow DOM 样式隔离与目录说明（英文）
  architecture.zh-CN.md           技术栈、Shadow DOM 样式隔离与目录说明（简体中文）
  on-device-translation.md        Chrome 本地翻译模型与实测速度说明（英文）
  on-device-translation.zh-CN.md  Chrome 本地翻译模型与实测速度说明（简体中文）
  chrome-web-store.md             Chrome 应用商店后台文案（品牌资源）
  store-assets/                   Chrome 应用商店截图与宣传图（品牌资源）
public/
  _locales/                       Chrome 扩展多语言目录（en、ja、zh_CN、zh_TW）
  icon/                           扩展图标（SVG 源文件与生成的 PNG，品牌资源）
  LICENSE.txt                     MIT 许可证，随扩展打包进归档根目录
  THIRD_PARTY_NOTICES.txt         第三方依赖许可证声明，随扩展打包进归档根目录
scripts/
  generate-icons.mjs              通过 CDP 将 public/icon/128.svg 光栅化为各尺寸 PNG
  test-profile.mjs                启动独立 Chrome 配置、9222 调试端口与本地多语言测试页
src/
  assets/styles/
    heroui.css                    所有入口共用的 HeroUI 基础样式
    motion.css                    共用过渡动画与减弱动态效果规则
  entrypoints/
    background.ts                 首次安装打开欢迎页，点击工具栏图标打开设置页
    content/                      内容脚本：选区手势监听与 Shadow Root 翻译气泡
      index.tsx                   普通网页内容脚本入口
      selection-translator.tsx    选区监听与气泡生命周期（欢迎页练习区亦复用此模块）
      selection.ts                读取选区并拆分正文与块级代码
      selection-bubble.tsx        基于 HeroUI 原地渲染组件的翻译气泡
      style.css                   注入到 Shadow Root 的隔离样式表
    options/                      设置页（语言与语言包、触发方式、系统状态、翻译测试台）
    welcome/                      首次安装欢迎页（交互式导览、练习文本与实时耗时秒表）
  utils/
    browser-support.ts            检测 Translator API、语言检测器与 Chromium 版本
    i18n.ts                       chrome.i18n.getMessage 的类型安全封装与英文回退
    languages.ts                  Chrome 支持的语言代码、别名与本地化名称
    page-theme.ts                 在扩展独立页面应用并监听 data-theme 变化
    segments.ts                   正文与代码块分段模型
    storage.ts                    基于 chrome.storage.local 的类型化设置存储
    styles/                       重命名 --tw-* 自定义属性的 PostCSS 插件
    theme.ts                      按设置与系统外观解析浅色/深色主题
    translation-controller.ts     选区到流式译文的状态机与标签页内存缓存
    translator.ts                 Chrome 内置 Translator 与 Language Detector API 封装
    typography.ts                 中日韩与西文混排间距及标点辅助函数
    use-settings.ts               跨扩展页面同步设置的 React Hook
```

## 构建、测试与发布脚本

```bash
pnpm install        # 安装依赖并运行 wxt prepare 生成类型文件
pnpm dev            # 监听构建到 .output/chrome-mv3-dev
pnpm lint           # 运行 oxlint（警告即失败）
pnpm type-check     # 运行 tsc --noEmit 类型检查
pnpm test           # 运行 Vitest（jsdom）单元测试；pnpm test:coverage 输出覆盖率表
pnpm build          # 生成生产构建 .output/chrome-mv3（可在 chrome://extensions 加载）
pnpm zip            # 生成商店上传归档 .output/nanogloss-<version>-chrome.zip
pnpm test:profile   # 启动独立配置 Chrome 与 127.0.0.1:8791 测试页（需先运行 pnpm build）
pnpm icons          # 从 public/icon/128.svg 重新生成各尺寸 PNG 图标
```

推送与 `package.json` 版本号一致的 `v<version>` 标签会触发 `.github/workflows/release.yml`，自动完成检查、打包并将 `.output/nanogloss-<version>-chrome.zip` 附加到 GitHub Release；Chrome 应用商店上传在开发者后台手动完成。
