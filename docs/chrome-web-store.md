# Chrome Web Store submission

Text for the fields of the Developer Dashboard that are not in the package. The name and the
short description come from `public/_locales/*/messages.json`; the package comes from
`pnpm zip`.

> This file holds NanoGloss store listing copy, a brand asset that is not covered by the MIT
> License. See [BRAND.md](../BRAND.md).

## Single purpose

Translate text the user selects on a web page, on the device, with Chrome's built-in
Translator API.

## Permission justifications

**storage**

Saves the user's settings (source and target language, trigger mode, long-press delay, minimum
selection length, theme) in `chrome.storage.local`.

**Host permission (content script on `<all_urls>`)**

The extension translates text the user selects, and a selection can be made on any page. The
content script listens for the selection gesture, reads the selected text, and shows the
translation in a bubble next to it. It does not read unselected page content, does not modify
the page, and makes no network requests.

**Remote code**

No. All code is in the package.

## Package

Build the upload archive with `pnpm zip`. It builds `.output/chrome-mv3/` first, then writes
`.output/nanogloss-0.1.0-chrome.zip` (429,365 bytes, 23 files, 429.37 kB). CI uploads the same
archive as the `chrome-web-store-zip` artifact on every push to `main`, and the [`v0.1.0` GitHub
Release](https://github.com/shaonianche/nanogloss/releases/tag/v0.1.0) holds the published archive
(`nanogloss-0.1.0-chrome.zip`).
The ZIP root contains `manifest.json`; `docs/**/*` is excluded.

The ZIP includes `LICENSE.txt` (MIT) and `THIRD_PARTY_NOTICES.txt` (third-party licenses and
copyright notices), in addition to the extension files.

## Data usage

Select **Website content** on the Privacy practices tab. Google's current User Data FAQ says
extensions must disclose how they handle user data even when it is processed locally on the
device, and "website content" includes text on pages the user visits. The selected text and the
page's `lang` attribute are read only to provide the translation; they are processed on the
device by Chrome's Translator API and Language Detector API and are never transmitted, stored on
disk, or shared. Do not select any other data type.

Certify all three statements:

- User data is not sold to third parties.
- User data is not used or transferred for purposes unrelated to the single purpose.
- User data is not used or transferred to determine creditworthiness or for lending.

## Privacy policy URL

<https://github.com/shaonianche/nanogloss/blob/main/PRIVACY.md>

The repository is public, so the URL resolves without signing in. `PRIVACY.md` includes the
affirmative Limited Use compliance statement required by the Chrome Web Store User Data Policy.

## Listing

- **Category:** Tools (under the current Chrome Web Store category list)
- **Primary language:** English (`en`), matching `manifest.default_locale`
- **Localized listings:** The package ships `_locales` for `en`, `ja`, `zh_CN`, and `zh_TW`. Add the localized detailed description below for each locale in the **Store listing** tab.
- **Additional fields:**
  - Homepage URL: `https://github.com/shaonianche/nanogloss`
  - Support URL: `https://github.com/shaonianche/nanogloss/issues`
  - Mature content: No
  - Official URL (optional): not set; requires a site verified in Google Search Console.
- **Graphic assets (stored in `docs/store-assets/`):**
  - Store icon: `128×128` PNG (`public/icon/128.png`, already packaged in the ZIP). The artwork
    fills the full 128×128 canvas; Google recommends 96×96 artwork with 16 px transparent padding,
    so this is acceptable but visually heavier than the guideline.
  - Screenshots (`1280×800` PNG, full bleed, square corners, 5 per locale). Captured on macOS
    (`mbp19`, desktop Google Chrome `157.0.8103.79`) with native macOS system fonts (`SF Pro`,
    `PingFang SC/TC`, `Hiragino Sans`) and Chrome's real built-in `TranslateKit` models (`en→zh`,
    `en→zh-Hant`, `en→ja`) — no stand-in translator. On `02-welcome-tour.png` (Step 3), the
    stopwatch shows the real measured cold-mount translation time (`294 ms` in `zh_CN`, `461 ms`
    in `en`, `421 ms` in `zh_TW`, `450 ms` in `ja`):
    - `docs/store-assets/en/{01-bubble,02-welcome-tour,03-code-aware,04-dark-mode,05-settings}.png`
    - `docs/store-assets/zh_CN/{01-bubble,02-welcome-tour,03-code-aware,04-dark-mode,05-settings}.png`
    - `docs/store-assets/zh_TW/{01-bubble,02-welcome-tour,03-code-aware,04-dark-mode,05-settings}.png`
    - `docs/store-assets/ja/{01-bubble,02-welcome-tour,03-code-aware,04-dark-mode,05-settings}.png`
  - Small promo tile (recommended — items without one rank below items that provide one): `docs/store-assets/promo-small-440x280.png` (`440×280` PNG, global)
  - Marquee promo tile (optional — required to be considered for homepage marquee featuring): `docs/store-assets/promo-marquee-1400x560.png` (`1400×560` PNG, global, embeds the real macOS Chrome bubble capture)
  - Promo video (optional): the store takes a link to a YouTube video, not a file, as a global
    video or per locale. `docs/store-assets/welcome-tour-zh_CN.webm` (`1440×900`, 18.3 s, 30 fps,
    Simplified Chinese UI) is a real recording of the welcome page's guided tour in desktop Google
    Chrome `157.0.8103.79` on macOS (`mbp19`), using Chrome's real built-in `TranslateKit` model
    throughout (measured in the recording: `449 ms` on Step 3 Alt+drag, `406 ms` on Step 4
    long-press, `470 ms` on Step 5 auto-select; a visible pointer dot shows clicks and drags).
    Upload it to YouTube and paste the link into the **Promo video** field if desired; there is no
    English, Japanese, or Traditional Chinese video.

## Store descriptions (per locale)

Plain text only (no HTML or Markdown formatting). Copy each block into the **Detailed description** field after selecting the matching locale in the Developer Dashboard.

### English (`en`)

- **Manifest name (9 / 75 chars):** `NanoGloss`
- **Manifest summary (120 / 132 chars):** `Fast, on-device selection translation with Chrome's built-in AI model—offline after pack download, no server or API key.`

```text
NanoGloss translates text you select on any web page directly on your device using Chrome's built-in AI translation model (Translator API). Once Chrome downloads a language pack on first use, translations run locally and work offline—with no server round trip, no account, and no API key.

Fast, lightweight on-device AI:
- Sub-half-second local response: On a desktop MacBook Pro (Core i9, Chrome 157), short sentences and single paragraphs typically finish in ~210–500 ms from releasing the mouse to rendered translation (~208–228 ms on 10-word sentences and ~270–500 ms on 25–55-word paragraphs, depending on cold Shadow DOM setup and system load), long passages start streaming in ~230 ms, and repeat selections hit an in-memory tab cache in ~6 ms. Speed varies by hardware and language pair.
- Compact expert model: Uses Chrome's dedicated neural machine translation model (~76 MB per language pack) rather than Chrome's multi-gigabyte generative foundation model, so it runs without heavy disk or VRAM requirements.

Key features:
- Guided welcome tour: Opens a practice page on first install so you can check browser support, prepare your target language pack, and try each selection gesture while timing the local model live.
- Clean selection bubble: Displays the selected passage alongside its translation in an isolated Shadow DOM card that stays readable on any site.
- Block-code preservation: Separates prose from block-level code (<pre>) automatically, translating the explanation while keeping code blocks verbatim.
- Flexible trigger modes: Use shortcut gestures by default (hold Alt/Option while selecting, or press and hold the left mouse button at the end of a selection) so normal text selection is never interrupted, or switch to translate immediately on selection.
- Local language packs: Manage target and source languages (including automatic language detection), view ready packs, and watch live download progress inside the bubble.
- Built-in translation playground: Test your configured language pair directly on the Settings page without leaving the tab.
- Automatic theme & UI localization: Follows your system light or dark appearance and Chrome's interface language (English, Simplified Chinese, Traditional Chinese, and Japanese).

Privacy by design:
NanoGloss has no backend server, includes no analytics or ads, and makes no network requests of its own. Selected text is processed locally in tab memory by Chrome's built-in Translator and Language Detector APIs and is never transmitted off your device. Network access is used only by Chrome itself when downloading or updating language packs from Google.

Requirements:
- Desktop Google Chrome 138 or newer (the built-in Translator API is not available on mobile or in Firefox or Safari).
- The first translation for a new language downloads a language pack (~76 MB via English pivot) from Google through Chrome, which takes a few seconds on broadband.

Open source (MIT license):
https://github.com/shaonianche/nanogloss
```

### 简体中文 (`zh_CN`)

- **Manifest 名称（9 / 75 字符）：** `NanoGloss`
- **Manifest 简短说明（59 / 132 字符）：** `划词即译：调用 Chrome 内置本地 AI 模型快速翻译，语言包下载后可离线使用，无需服务器、账号或 API 密钥。`

```text
NanoGloss 让你在任意网页划词，直接调用 Chrome 内置的本地 AI 翻译模型（Translator API）在本机完成翻译。首次使用时由 Chrome 下载一次语言包，之后即可断网离线运行——省去云端往返延迟，无需任何后端服务器、注册账号或配置 API 密钥。

本地内置模型与响应速度：
- 半秒内快速出译文：在桌面端 MacBook Pro（Core i9，Chrome 157）实测中，划选日常短句与单段正文通常在约 210–500 ms 内即可完成渲染（10 词短句约 208–228 ms，25–55 词普通段落视页面首次初始化及实时负载约 270–500 ms），多段长文约 230 ms 开始流式输出，重复划选命中标签页内存缓存仅约 6 ms（实际耗时因设备硬件与语种而异）。
- 轻量专用专家模型：基于 Chrome 专为机器翻译训练的轻量专家模型（单个语言包约 76 MB），而非体积庞大的通用生成式基础大模型，无需大空间磁盘或高显存门槛即可流畅运行。

主要功能：
- 首次安装引导导览：安装后自动打开带练习文本的欢迎页，带你检查浏览器支持、准备语言包并上手体验三种触发手势，实时显示本地模型翻译耗时。
- 清爽的划词翻译气泡：通过 Shadow DOM 隔离样式，在各类网页上都能稳定呈现原文与译文，不干扰原网页排版。
- 块级代码原样保留：自动区分选区中的说明正文与块级代码（<pre>），只翻译正文，代码块与命令行保持原样。
- 灵活的触发方式：默认启用快捷手势（按住 Alt / Option 键划词，或划词结束时按住鼠标左键不放），避免日常复制选字误弹出；也可切换为「划词后立即翻译」。
- 本机语言包管理：支持源语言自动检测与多语种互译，可在气泡内实时查看首次下载进度，并在设置页查看已就绪的语言包。
- 内置翻译测试台：在设置页直接输入或选用示例文本，即时验证当前语言配置与本地模型效果。
- 主题与界面本地化：自动跟随系统浅色 / 深色外观，界面支持简体中文、繁体中文、英文与日文。

隐私保护：
NanoGloss 没有后端服务器，不含统计追踪与广告，扩展自身不发起任何网络请求。选中文本仅在本机页面内存中交给 Chrome 内置的 Translator API 与 Language Detector API 处理，绝不上传第三方服务器；仅首次下载或更新语言包时由 Chrome 浏览器自身连接 Google 完成下载。

使用要求：
- 需要桌面端 Google Chrome 138 或更高版本（移动端浏览器以及 Firefox、Safari 未提供该内置接口）。
- 首次使用某语种时，Chrome 会从 Google 下载一次对应语言包（经英语中转，单个约 76 MB），通常耗时数秒。

源代码开源（MIT 许可证）：
https://github.com/shaonianche/nanogloss
```

### 繁體中文 (`zh_TW`)

- **Manifest 名稱（9 / 75 字元）：** `NanoGloss`
- **Manifest 簡短說明（60 / 132 字元）：** `選取即譯：透過 Chrome 內建本機 AI 模型快速翻譯，語言套件下載後可離線使用，無須伺服器、帳號或 API 金鑰。`

```text
NanoGloss 讓你在任何網頁選取文字，直接透過 Chrome 內建的本機 AI 翻譯模型（Translator API）於裝置上完成翻譯。首次使用時由 Chrome 下載一次語言套件，之後即可離線運作——省去雲端網路往返延遲，無須外部伺服器、帳號或 API 金鑰。

本機內建模型與反應速度：
- 半秒內快速呈現譯文：於桌面版 MacBook Pro（Core i9，Chrome 157）實測中，選取日常短句與單段文字通常在約 210–500 ms 內即可完成渲染（10 詞短句約 208–228 ms，25–55 詞一般段落視頁面首次初始化與系統負載約 270–500 ms），長篇段落約 230 ms 開始串流輸出，重複選取命中分頁記憶體快取僅約 6 ms（實際速度依硬體與語言組合而異）。
- 輕量專用專家模型：採用 Chrome 專為機器翻譯打造的輕量專家模型（單一語言套件約 76 MB），而非大型通用生成式基礎模型，無須龐大磁碟空間或高顯示記憶體門檻。

主要功能：
- 首次安裝引導導覽：安裝後自動開啟含練習文字的歡迎頁，帶你檢查瀏覽器支援、準備語言套件並實際體驗三種選取手勢，即時顯示本機模型的翻譯耗時。
- 清晰的選取翻譯氣泡：以 Shadow DOM 隔離樣式，在各種網站上都能維持一致排版，不干擾原網頁顯示。
- 區塊程式碼原樣保留：自動區分選取範圍內的說明文字與區塊程式碼（<pre>），僅翻譯內文，程式碼區塊維持原貌。
- 彈性的觸發方式：預設採用快捷手勢（按住 Alt / Option 鍵選取，或在選取結束時長按滑鼠左鍵），避免日常複製選字誤彈出；也可切換為「選取後立即翻譯」。
- 本機語言套件管理：支援來源語言自動偵測與多語言互譯，可在氣泡內即時檢視下載進度，並於設定頁查看已就緒的語言套件。
- 內建翻譯測試區：在設定頁直接輸入或點選範例文字，立即驗證目前的語言設定與本機翻譯模型。
- 主題與介面在地化：自動跟隨系統淺色 / 深色外觀，介面支援繁體中文、簡體中文、英文與日文。

隱私保護：
NanoGloss 沒有後端伺服器，不含分析追蹤或廣告，擴充功能本身不發起任何網路請求。選取的文字僅在本機分頁記憶體中交給 Chrome 內建的 Translator API 與 Language Detector API 處理，絕不傳送至外部伺服器；僅首次下載或更新語言套件時由 Chrome 瀏覽器自行連線至 Google 下載。

系統需求：
- 需要桌面版 Google Chrome 138 以上版本（行動裝置瀏覽器以及 Firefox、Safari 未提供此內建介面）。
- 首次使用新語言時，Chrome 會向 Google 下載一次語言套件（經由英文轉換，單一套件約 76 MB），通常僅需數秒。

原始碼開源（MIT 授權）：
https://github.com/shaonianche/nanogloss
```

### 日本語 (`ja`)

- **Manifest 名（9 / 75 文字）：** `NanoGloss`
- **Manifest 概要（71 / 132 文字）：** `選択テキストを Chrome 内蔵 AI モデルで端末内高速翻訳。言語パック導入後はオフライン動作し、外部サーバーや API キーも不要です。`

```text
NanoGloss は、Web ページ上で選択したテキストを Chrome 内蔵のローカル AI 翻訳モデル（Translator API）で端末内翻訳する拡張機能です。初回に Chrome が言語パックをダウンロードすれば、その後はオフラインでも動作し、サーバー通信の待ち時間・アカウント登録・API キーは一切不要です。

端末内 AI モデルの速さと軽さ：
- 0.5 秒以内の高速レスポンス：デスクトップ版 MacBook Pro（Core i9、Chrome 157）での実測では、短文〜1 段落の翻訳が通常約 210〜500 ms で完了し（10 語の短文で約 208〜228 ms、25〜55 語の段落では初回 UI 初期化や負荷に応じて約 270〜500 ms）、長文も約 230 ms でストリーミング表示を開始、同じ箇所の再選択はタブ内メモリキャッシュにより約 6 ms で表示されます（速度は端末性能や言語ペアにより異なります）。
- 軽量な専用エキスパートモデル：汎用大規模モデルではなく、Chrome の翻訳専用エキスパートモデル（1 言語パックあたり約 76 MB）を使用するため、大きな空き容量や高い VRAM 要件なしで軽快に動作します。

主な機能：
- 初回ガイドツアー：インストール直後に練習用テキスト付きのウェルカムページが開き、ブラウザ対応確認・言語パック準備・各ジェスチャーの体験と翻訳時間の計測がその場で行えます。
- 見やすい翻訳ポップアップ：Shadow DOM でスタイルを分離しているため、どの Web サイト上でも崩れずに原文と訳文を確認できます。
- ブロックコードの保持：選択範囲から本文とブロックコード（<pre>）を自動判別し、説明文だけを翻訳してコードブロックはそのまま残します。
- 柔軟な起動方法：初期設定はショートカット操作（Alt / Option キーを押しながら選択、または選択終了時に左クリック長押し）で普段のテキスト選択を邪魔しません。選択直後に自動翻訳するモードにも切り替え可能です。
- 端末内の言語パック管理：翻訳元言語の自動検出に対応し、初回ダウンロードの進捗表示や導入済み言語パックの確認が可能です。
- 内蔵の翻訳テスト機能：設定ページ上で例文や任意のテキストを入力し、現在の言語設定とローカルモデルの動作をすぐに確認できます。
- テーマ・多言語 UI 対応：システムのライト / ダーク外観および Chrome の表示言語（日本語・英語・簡体字中国語・繁体字中国語）に自動で合わせます。

プライバシー保護：
NanoGloss は独自のサーバーを持たず、トラッキングや広告も含みません。拡張機能自身からの外部通信は一切行わず、選択テキストは端末内のタブメモリ上で Chrome 組み込みの Translator API と Language Detector API のみに渡されます。ネットワーク通信は、初回に Chrome 本体が Google から言語パックを取得・更新するときのみ発生します。

動作環境：
- デスクトップ版 Google Chrome 138 以降が必要です（モバイル版や Firefox・Safari では利用できません）。
- 新しい言語を初めて使う際は、Chrome が Google から言語パック（英語経由・約 76 MB）を一度だけダウンロードするため数秒かかります。

ソースコードはオープンソース（MIT ライセンス）：
https://github.com/shaonianche/nanogloss
```

## Distribution

- **Visibility:** Public (or Unlisted / Private for internal testing; all three go through the same review).
- **Geographic distribution:** All regions.
- **Pricing:** Free.

## Notes for the reviewer

Installing opens a welcome page with a guided tour and a practice text for trying the triggers.
The default trigger is a gesture: hold Alt while selecting text, or keep the mouse button held
at the end of a selection. The first translation for a language pair downloads a language pack
through Chrome, which takes a few seconds.
