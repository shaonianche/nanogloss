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

## Package contents

The ZIP includes `LICENSE.txt` (MIT) and `THIRD_PARTY_NOTICES.txt` (third-party licenses and
copyright notices), in addition to the extension files.

## Data usage

The extension does not collect or transmit user data: select none of the data types on the
Privacy practices tab. The selected text ("website content") is processed on the device by
Chrome's Translator API and is never sent off the device or stored.

Certify all three statements:

- User data is not sold to third parties.
- User data is not used or transferred for purposes unrelated to the single purpose.
- User data is not used or transferred to determine creditworthiness or for lending.

## Privacy policy URL

<https://github.com/shaonianche/nanogloss/blob/main/PRIVACY.md>

The URL resolves once the repository is public.

## Listing

- **Category:** Tools (under the current Chrome Web Store category list)
- **Primary language:** English (`en`), matching `manifest.default_locale`
- **Localized listings:** The package ships `_locales` for `en`, `ja`, `zh_CN`, and `zh_TW`. Add the localized detailed description below for each locale in the **Store listing** tab.
- **Additional fields:**
  - Homepage URL: `https://github.com/shaonianche/nanogloss`
  - Support URL: `https://github.com/shaonianche/nanogloss/issues`
  - Mature content: No
- **Graphic assets (stored in `docs/store-assets/`):**
  - Store icon: `128×128` PNG (`public/icon/128.png`, already packaged in the ZIP)
  - Screenshots (`1280×800` PNG, full bleed, square corners, 5 per locale):
    - `docs/store-assets/en/01-bubble.png` … `05-shortcuts.png`
    - `docs/store-assets/zh_CN/01-bubble.png` … `05-shortcuts.png`
    - `docs/store-assets/zh_TW/01-bubble.png` … `05-shortcuts.png`
    - `docs/store-assets/ja/01-bubble.png` … `05-shortcuts.png`
  - Small promo tile (recommended — items without one rank below items that provide one): `docs/store-assets/promo-small-440x280.png` (`440×280` PNG, global)
  - Marquee promo tile (optional — required to be considered for homepage marquee featuring): `docs/store-assets/promo-marquee-1400x560.png` (`1400×560` PNG, global)

## Store descriptions (per locale)

Plain text only (no HTML or Markdown formatting). Copy each block into the **Detailed description** field after selecting the matching locale in the Developer Dashboard.

### English (`en`)

- **Manifest name (9 / 75 chars):** `NanoGloss`
- **Manifest summary (85 / 132 chars):** `Select text on any page to translate on-device with Chrome's built-in Translator API.`

```text
NanoGloss translates text you select on any web page directly on your device using Chrome's built-in Translator API. After a language pack is downloaded once, translations run locally and work offline—no external server, no account, and no API key required.

Key features:
- Clean selection bubble: Displays the selected passage alongside its translation in an isolated Shadow DOM card that stays readable on any site.
- Code-aware translation: Separates prose from inline and block code automatically, translating the explanation while keeping code snippets verbatim.
- Flexible trigger modes: Use shortcut gestures by default (hold Alt/Option while selecting, or press and hold the left mouse button at the end of a selection) so normal text selection is never interrupted, or switch to translate immediately on selection.
- Local language packs: Manage target and source languages (including automatic language detection), view installed packs, and watch live download progress inside the bubble.
- Built-in translation playground: Test your configured language pair directly on the Settings page without leaving the tab.
- Automatic theme & UI localization: Follows your system light or dark appearance and Chrome's interface language (English, Simplified Chinese, Traditional Chinese, and Japanese).

Privacy by design:
NanoGloss collects no user data, includes no analytics or ads, and makes no network requests of its own. Selected text is passed directly to Chrome's on-device Translator and Language Detector APIs and is never sent to third-party servers. Language pack downloads are handled by Chrome itself.

Requirements:
- Desktop Chrome 138 or newer (the built-in Translator API is not available on mobile or in Edge, Firefox, or Safari).
- The first translation for a new language pair downloads a language pack (~76 MB via English pivot) through Chrome, which takes a few seconds.

Source code open source (MIT license):
https://github.com/shaonianche/nanogloss
```

### 简体中文 (`zh_CN`)

- **Manifest 名称（9 / 75 字符）：** `NanoGloss`
- **Manifest 简短说明（51 / 132 字符）：** `划词即译，基于 Chrome 内置 Translator API 在本地完成翻译，无需联网或配置密钥。`

```text
NanoGloss 让你在任意网页划词，直接调用 Chrome 内置的 Translator API 在本机完成翻译。语言包首次下载完成后即可离线使用，无需第三方服务器、账号或 API 密钥。

主要功能：
- 清爽的划词翻译气泡：通过 Shadow DOM 隔离样式，在各类网页上都能稳定呈现原文与译文，不破坏原网页布局。
- 代码块原样保留：自动区分选区中的正文与代码片段，只翻译说明文字，变量名、命令与代码保持原样。
- 灵活的触发方式：默认启用快捷手势（按住 Alt / Option 键划词，或划词结束时按住鼠标左键不放），避免日常选字误弹出；也可切换为「划词后立即翻译」。
- 本机语言包管理：支持源语言自动检测与多语种互译，可在气泡内实时查看首次下载进度，并在设置页查看已就绪的语言包。
- 内置翻译测试台：在设置页直接输入或选用示例文本，即时验证当前语言配置与本地翻译效果。
- 主题与界面本地化：自动跟随系统浅色 / 深色外观，界面跟随 Chrome 语言（支持简体中文、繁体中文、英文与日文）。

隐私保护：
NanoGloss 不收集任何用户数据，不含统计追踪与广告，扩展自身不发起任何网络请求。选中文本仅在本机交给 Chrome 内置的 Translator API 与 Language Detector API 处理，不会上传至第三方服务器；语言包由 Chrome 自行管理下载。

使用要求：
- 需要桌面端 Chrome 138 或更高版本（移动端以及 Edge、Firefox、Safari 暂未提供内置 Translator API）。
- 首次使用某语言组合时，Chrome 会在本地下载对应语言包（经由英语中转，单个约 76 MB），通常耗时数秒。

源代码开源（MIT 许可证）：
https://github.com/shaonianche/nanogloss
```

### 繁體中文 (`zh_TW`)

- **Manifest 名稱（9 / 75 字元）：** `NanoGloss`
- **Manifest 簡短說明（57 / 132 字元）：** `選取網頁文字即可即時翻譯，透過 Chrome 內建 Translator API 在本機完成，無須連線或設定金鑰。`

```text
NanoGloss 讓你在任何網頁選取文字，直接透過 Chrome 內建的 Translator API 於本機完成翻譯。語言套件首次下載後即可離線使用，無須外部伺服器、帳號或 API 金鑰。

主要功能：
- 清晰的選取翻譯氣泡：以 Shadow DOM 隔離樣式，在各種網站上都能維持一致排版，不干擾原網頁顯示。
- 保留程式碼不誤譯：自動區分選取範圍內的正文與程式碼區塊，僅翻譯說明文字，程式碼與指令維持原貌。
- 彈性的觸發方式：預設採用快捷手勢（按住 Alt / Option 鍵選取，或在選取結束時長按滑鼠左鍵），避免日常選字誤彈出；也可切換為「選取後立即翻譯」。
- 本機語言套件管理：支援來源語言自動偵測與多語言互譯，可在氣泡內即時檢視下載進度，並於設定頁查看已就緒的語言套件。
- 內建翻譯測試區：在設定頁直接輸入或點選範例文字，立即驗證目前的語言設定與本機翻譯模型。
- 主題與介面在地化：自動跟隨系統淺色 / 深色外觀，介面自動配合 Chrome 語言（支援繁體中文、簡體中文、英文與日文）。

隱私保護：
NanoGloss 不收集任何使用者資料，不含分析追蹤或廣告，擴充功能本身不發起任何網路請求。選取的文字僅在本機交給 Chrome 內建的 Translator API 與 Language Detector API 處理，絕不傳送至第三方伺服器；語言套件由 Chrome 自行負責下載。

系統需求：
- 需要桌面版 Chrome 138 以上版本（行動裝置以及 Edge、Firefox、Safari 目前不支援內建 Translator API）。
- 首次使用新語言組合時，Chrome 會在本機下載語言套件（經由英文轉換，單一套件約 76 MB），需時數秒。

原始碼開源（MIT 授權）：
https://github.com/shaonianche/nanogloss
```

### 日本語 (`ja`)

- **Manifest 名（9 / 75 文字）：** `NanoGloss`
- **Manifest 概要（58 / 132 文字）：** `Web ページ上のテキストを選択して、Chrome 組み込みの Translator API でローカル翻訳します。`

```text
NanoGloss は、Web ページ上で選択したテキストを Chrome 組み込みの Translator API を使って端末内で翻訳する拡張機能です。言語パックを初回にダウンロードすれば、その後はオフラインでも動作し、外部サーバー・アカウント登録・API キーは一切不要です。

主な機能：
- 見やすい翻訳ポップアップ：Shadow DOM でスタイルを分離しているため、どの Web サイト上でも崩れずに原文と訳文を確認できます。
- コードブロックをそのまま保持：選択範囲から本文とコードを自動判別し、説明文だけを翻訳してコマンドやソースコードはそのまま表示します。
- 柔軟な起動方法：初期設定はショートカット操作（Alt / Option キーを押しながら選択、または選択終了時に左クリック長押し）で普段のテキスト選択を邪魔しません。選択直後に自動翻訳するモードにも切り替え可能です。
- 端末内の言語パック管理：翻訳元言語の自動検出に対応し、初回ダウンロードの進捗をポップアップ内で確認できるほか、設定ページで導入済み言語パックを一覧できます。
- 内蔵の翻訳テスト機能：設定ページ上で例文や任意のテキストを入力し、現在の言語設定とローカル翻訳の動作をすぐに確認できます。
- テーマ・多言語 UI 対応：システムのライト / ダーク外観および Chrome の表示言語（日本語・英語・簡体字中国語・繁体字中国語）に自動で合わせます。

プライバシー保護：
NanoGloss はユーザーデータを一切収集せず、トラッキングや広告も含みません。拡張機能自身からの外部通信は行わず、選択したテキストは端末内の Chrome 組み込み Translator API および Language Detector API のみに渡されます。言語パックのダウンロードは Chrome 本体が処理します。

動作環境：
- デスクトップ版 Chrome 138 以降が必要です（モバイル版や Edge・Firefox・Safari では組み込み Translator API を利用できません）。
- 新しい言語ペアを初めて使う際は、Chrome が言語パック（英語経由・約 76 MB）を自動でダウンロードするため数秒かかります。

ソースコードはオープンソース（MIT ライセンス）：
https://github.com/shaonianche/nanogloss
```

## Notes for the reviewer

Installing opens a welcome page with a guided tour and a practice text for trying the triggers.
The default trigger is a gesture: hold Alt while selecting text, or keep the mouse button held
at the end of a selection. The first translation for a language pair downloads a language pack
through Chrome, which takes a few seconds.
