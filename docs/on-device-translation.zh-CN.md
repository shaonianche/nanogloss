# 本地 AI 模型与实测翻译速度

[English](on-device-translation.md) · [简体中文](on-device-translation.zh-CN.md)

NanoGloss 完全基于 Chrome 内置的 [Translator API](https://developer.chrome.com/docs/ai/translator-api) 与 [Language Detector API](https://developer.chrome.com/docs/ai/language-detection) 工作。语言包下载到本机后，语言检测与翻译推理全部在浏览器本地完成，省去了云端接口的网络往返与排队开销：实测日常划选短句约 `0.2 秒` 即可出齐译文，长段落在约 `0.23 秒` 内即开始流式输出首段译文。

实际翻译速度取决于设备的 CPU、内存、散热状态以及所选语言组合。以下数据均为真机实测结果，而非估算值。

## 实测翻译速度

### 测试环境与计时方法

- **测试硬件**：MacBook Pro（`MacBookPro15,1`），Intel Core i9-9880H @ 2.30 GHz（8 物理核 / 16 逻辑核），16 GB 内存
- **系统与软件**：macOS 15.8.3（`24H241`），Google Chrome `157.0.8103.79`（正式版），NanoGloss `0.1.0`（`16c1e61`）
- **测量方式**：在全新 Chrome 配置文件（`/tmp/nanogloss-bench-profile`）预先装好 `en↔zh`、`en↔ja`、`en↔fr` 语言包，在前台可见标签页内使用 `performance.now()` 与 `MutationObserver` 精确记录毫秒级时间戳。端到端测试以派发划词完成事件 `mouseup`（`altKey: true`）为起点 `t = 0`，依次记录气泡卡片挂载、**首段译文上屏（首字时间）** 与 **完整译文渲染完成** 的时刻。除专门的缓存测试外，每次测量均使用完全不同的原文；每次关闭气泡都会调用 `Translator.destroy()` 释放实例，因此同页后续划词均包含重新执行 `Translator.create()` 的完整开销。

### NanoGloss 端到端划词耗时（`mouseup` → 译文渲染）

下表为同页后续划词（源语言设为「自动检测」`auto`）的实测耗时。将源语言改为固定语言（`en`、`zh`、`ja`）时，实测耗时与自动检测处于同一波动区间，因为本地语言检测单次仅耗时约 `0.1–0.4 ms`。

| 语言组合 | 翻译路径 | 短句 | 中等段落 | 多段长文（3 个自然段） |
|---|---|---|---|---|
| `en → zh`（英译简中） | 直连 | 首字 `228 ms` / 完成 `228 ms`（50 字符，10 词） | 首字 `225–230 ms` / 完成 `341–348 ms`（322–327 字符，53–54 词） | 首字 `229–230 ms` / 完成 `821–836 ms`（1,389–1,419 字符，228–232 词） |
| `zh → en`（简中译英） | 直连 | 首字 `208 ms` / 完成 `208 ms`（14 字，7 词） | 首字 `219–221 ms` / 完成 `398–433 ms`（133–134 字，69–76 词） | 首字 `221–229 ms` / 完成 `1,212–1,244 ms`（618 字，331–333 词） |
| `en → ja`（英译日） | 直连 | 首字 `227 ms` / 完成 `228 ms`（56 字符，10 词） | 首字 `224–230 ms` / 完成 `365–377 ms`（322–327 字符，53–54 词） | 首字 `233–235 ms` / 完成 `949–1,013 ms`（1,389–1,419 字符，228–232 词） |
| `ja → zh`（日译简中） | 经英语中转 | 首字 `317 ms` / 完成 `317 ms`（17 字，10 词） | 首字 `336–337 ms` / 完成 `649–668 ms`（168–186 字，79–89 词） | 首字 `333–341 ms` / 完成 `1,778–1,797 ms`（711–718 字，333–337 词） |

同一测试环境下的其他关键状态耗时：

- **气泡卡片挂载显示**：同页后续划词为 `1.7–6.1 ms`；新开标签页首次划词为 `13.2–19.8 ms`（包含首次创建 Shadow Root 并加载约 80 kB 隔离样式表）。
- **新开标签页首次划词（Cold in tab）**：中等段落完整完成耗时分别为 `324 ms`（`en → zh`，271 字符）、`421 ms`（`zh → en`，140 字）、`364 ms`（`en → ja`，301 字符）和 `684 ms`（`ja → zh`，196 字）。
- **重复划选同一段文本（内存缓存命中）**：中位数 `5.8 ms`（50 字符 `en → zh` 连续 3 次为 `5.0–8.1 ms`）。NanoGloss 在当前标签页内存中缓存最近 200 条译文，关闭或刷新标签页即清空，不写入磁盘。

### 底层 Chrome API 耗时拆解（不含 UI 开销）

在网页内直接调用底层 `Translator` 接口（每组测试 6 段不同文本，第 1 次预热，取后 5 次中位数），可以看到「实例初始化」与「纯模型推理」各自占用的时间：

| 语言组合 | `Translator.create()` | 短句 TTFT / 总计 | 中等段落 TTFT / 总计 | 多段长文 TTFT / 总计 |
|---|---:|---|---|---|
| `en → zh` | `143 ms` | `27 ms` / `27 ms`（50–60 字符） | `31 ms` / `123 ms`（275–337 字符） | `30 ms` / `567 ms`（1,356–1,419 字符，19–20 块） |
| `zh → en` | `136 ms` | `25 ms` / `25 ms`（13–15 字） | `31 ms` / `196 ms`（132–140 字） | `30 ms` / `887 ms`（613–623 字，31 块） |
| `en → ja` | `143 ms` | `29 ms` / `29 ms`（53–60 字符） | `36 ms` / `144 ms`（300–341 字符） | `33 ms` / `648 ms`（1,373–1,419 字符，20 块） |
| `ja → zh` | `209 ms` | `42 ms` / `43 ms`（15–23 字） | `62 ms` / `331 ms`（167–180 字） | `58 ms` / `1,342 ms`（707–725 字，24–25 块） |

- **纯模型首块输出（TTFT）仅需 `25–62 ms`。** 即使是 1,400 字符的英文长段，底层 `translateStreaming()` 在约 `30 ms` 内就会吐出第一批译文（双包中转约 `58 ms`），用户无需等待整段算完即可开始阅读。
- **短句约 220 ms 的端到端耗时中，大头是 `Translator.create()`（直连约 `140 ms`，中转约 `210 ms`）。** Chrome 限制浏览器同时存活的 `Translator` 实例总数，为避免多标签页触达上限报错，NanoGloss 会在每次关闭气泡时销毁实例，下次划词再重新创建。
- **状态检查与语言检测开销不足 `2 ms`。** `Translator.availability()` 中位数仅 `0.15–0.20 ms`；`LanguageDetector.create()` 为 `0.4–0.7 ms`，`detector.detect()` 在短句和中等段落上中位数为 `0.1–0.4 ms`，长文约 `1.0–1.2 ms`。

### 语言包一次性下载耗时与磁盘体积

- **常规新增语言包下载**：端到端耗时 `3.2–3.3 秒`（`en↔ja` 为 `3,170 ms`，`en↔fr` 为 `3,264 ms`），其中网络传输约 `1.3–1.4 秒`，其余为初始化与模型注册时间。
- **全新空白 Chrome 配置文件首次调用**：在没有任何内置组件的空白 `--user-data-dir` 中首次请求 `en↔zh` 共耗时 `119.6 秒`，原因是 Chrome 先在后台下载并安装了共享的 `TranslateKit` 运行时动态库（`libtranslatekit.so`，`23.77 MiB`），最后 `1.5 秒` 才是 `en_zh` 语言包本身的传输。日常使用中的 Chrome 通常已具备基础组件，只需经历数秒的语言包下载。

## Chrome 内置翻译模型原理

根据 Google 官方的 [Built-in AI 概览](https://developer.chrome.com/docs/ai/built-in/overview) 与 [使用指南](https://developer.chrome.com/docs/ai/get-started)，Chrome 内置 AI 分为通用基础大模型与面向单一任务的**专家模型（Expert Models）**两类：

- **专用神经机器翻译（NMT）专家模型，而非 Gemini Nano。** Chrome 的 Prompt、Summarizer、Writer、Rewriter、Proofreader 等生成式接口依赖 Gemini Nano 大模型（要求至少 22 GB 可用磁盘空间及特定显存/内存门槛）；而 [Translator API](https://developer.chrome.com/docs/ai/translator-api) 与 [Language Detector API](https://developer.chrome.com/docs/ai/language-detection) 使用专为翻译和语种排序训练的轻量级专家模型（底层由 `TranslateKit` 驱动 TensorFlow Lite 编码器/解码器模型运行），资源占用低得多，也不受 Gemini Nano 的 22 GB 空间与显存门槛限制。
- **以英语为中转的双向语言包。** 语言包按 Chrome 用户配置文件（Profile）独立存储在本地磁盘的 `TranslateKit/models/` 目录下。每个语言包同时包含该语言与英语的双向 NMT 权重及词典——例如实测磁盘上的 `en_zh` 目录为 `76.58 MiB`（`80.3 MB`，共 21 个文件，含 `en_zh_nmt`、`zh_en_nmt` 和 `en_zh_dictionary`），`en_ja` 为 `75.88 MiB`（`79.6 MB`），`en_fr` 为 `77.28 MiB`（`81.0 MB`），共享运行时 `libtranslatekit.so` 为 `23.77 MiB`（`24.9 MB`）。当在两种非英语语言之间互译（如 `ja → zh`）时，磁盘上不会下载单独的 `ja_zh` 包，而是由 Chrome 在本机串联 `ja → en` 与 `en → zh` 两个语言包完成中转，因此需要两个包都已就绪，推理耗时也约为直连语种的 1.5–2 倍。
- **本地语种检测模型。** 当源语言设为「自动检测」时，NanoGloss 调用 Chrome 内置的 [Language Detector API](https://developer.chrome.com/docs/ai/language-detection) 对选中文本做本地概率排序（置信度 `0.0`–`1.0`）。正如 Chrome 官方文档所提示，单个词或极短词组的识别准确率较低，因此 NanoGloss 要求最高候选置信度达到 `0.5` 以上才会采用，否则回退到网页声明的 `lang` 属性。

## 隐私与离线特性

- **划词文本不出本机。** 语言检测与翻译推理全部在本地 Chrome 进程内完成。NanoGloss 没有后端服务器、无需注册账号或配置 API 密钥，扩展自身不发起任何网络请求（详见 [PRIVACY.md](../PRIVACY.md)）。
- **语言包就绪后完全离线可用。** 网络连接仅在首次下载语言包或 Chrome 自动更新模型组件时由浏览器自身使用；语言包写入磁盘后，断网或弱网环境下仍可正常划词翻译。
- **按站点隔离语言包状态以防指纹追踪。** 为了防止网页通过探测已安装语言列表来对用户做隐私指纹识别，在某个网站首次调用对应语言对的 `Translator.create()` 之前，`Translator.availability()` 会统一向该网站返回 `"downloadable"`（见官方文档 [Model download](https://developer.chrome.com/docs/ai/translator-api#model_download)）。如果磁盘上其实已有该语言包，用户在该站点首次触发创建后会立即切换为 `"available"`，不会重复下载模型文件。

## 运行要求与平台限制

- **浏览器与系统要求**：需要桌面端 Google Chrome 138 或更高版本。Chrome 内置的 Translator API 与 Language Detector API 不支持 Android、iOS 移动端，Firefox 与 Safari 也未提供该内置接口（可在扩展设置页的「系统状态」标签页检查当前浏览器支持情况）。
- **首次激活需要用户手势**：当某个站点上的语言对状态为 `"downloadable"` 或 `"downloading"` 时，Chrome 要求页面具备有效的用户交互激活（`navigator.userActivation.isActive`）才允许调用 `Translator.create()`。若触发时缺少激活状态，NanoGloss 会在气泡内显示「下载语言包」按钮，点击一次即可开始。
- **顺序处理与长文流式分块**：Chrome 按顺序串行处理翻译请求，前一个大段请求未完成时会阻塞后续请求（见官方文档 [Sequential translations](https://developer.chrome.com/docs/ai/translator-api#sequential_translations)）。NanoGloss 在新选区产生时会立即通过 `AbortController` 取消上一次未完成的翻译，并按自然段在约 600 字符（`TRANSLATION_CHUNK_TARGET`）处切分长文，配合 `translateStreaming()` 边算边渲染。
- **上下文与页面限制**：Chrome 默认仅向顶层窗口和同源 `iframe` 暴露这两个 API；Web Worker 中不可用，跨域 `iframe` 需由宿主页面显式声明 `<iframe allow="translator; language-detector">` 才能使用。此外，Chrome 禁止扩展在 `chrome://` 内部页面和 Chrome 应用商店页面注入脚本。
- **支持语种范围**：Chrome 目前内置支持 39 种语言代码（涵盖中、英、日、韩、法、德、西、俄、阿、印地、越、泰等主流语种），具体语种及某组语言对在当前设备上是否可用由 Chrome 决定。
