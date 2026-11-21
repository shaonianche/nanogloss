# On-device model and translation speed

[English](on-device-translation.md) · [简体中文](on-device-translation.zh-CN.md)

NanoGloss uses Chrome's built-in [Translator API](https://developer.chrome.com/docs/ai/translator-api) and [Language Detector API](https://developer.chrome.com/docs/ai/language-detection) for every translation. Because both models run inside the browser on your machine, there is no network round trip once a language pack is installed: short sentences finish in about 0.2 s from selection to rendered text, and long paragraphs begin streaming into the bubble in about the same time.

Speed depends on CPU, memory, thermal state, and language pair. The numbers below were measured on a real machine rather than estimated.

## Measured translation speed

### Test setup

- **Hardware**: MacBook Pro (`MacBookPro15,1`), Intel Core i9-9880H @ 2.30 GHz (8 physical / 16 logical cores), 16 GB RAM
- **System and browser**: macOS 15.8.3 (`24H241`), Google Chrome `157.0.8103.79` (Stable), NanoGloss `0.1.0` (`16c1e61`)
- **Timing method**: `performance.now()` and `MutationObserver` inside a foreground tab on a clean profile (`/tmp/nanogloss-bench-profile`) after installing the `en↔zh`, `en↔ja`, and `en↔fr` language packs. End-to-end runs dispatch `mouseup` (`altKey: true`) on a range selection at `t = 0` and record when the bubble card mounts, when the first translated text renders (**first text**), and when the full translation finishes (**complete**). Every non-cached run uses distinct source text, and dismissing the bubble calls `Translator.destroy()`, so each warm selection includes creating a fresh `Translator` instance.

### End-to-end bubble latency (`mouseup` → rendered translation)

Values below come from warm selections in an open tab with `sourceLanguage` set to `"auto"`. Switching `sourceLanguage` to a fixed code (`en`, `zh`, `ja`) produced the same latency within run-to-run noise because local language detection takes about `0.1–0.4 ms`.

| Language pair | Path | Short sentence | Medium paragraph | Multi-paragraph (~3 paragraphs) |
|---|---|---|---|---|
| `en → zh` | Direct | `228 ms` first / `228 ms` done (50 chars, 10 words) | `225–230 ms` first / `341–348 ms` done (322–327 chars, 53–54 words) | `229–230 ms` first / `821–836 ms` done (1,389–1,419 chars, 228–232 words) |
| `zh → en` | Direct | `208 ms` first / `208 ms` done (14 chars, 7 words) | `219–221 ms` first / `398–433 ms` done (133–134 chars, 69–76 words) | `221–229 ms` first / `1,212–1,244 ms` done (618 chars, 331–333 words) |
| `en → ja` | Direct | `227 ms` first / `228 ms` done (56 chars, 10 words) | `224–230 ms` first / `365–377 ms` done (322–327 chars, 53–54 words) | `233–235 ms` first / `949–1,013 ms` done (1,389–1,419 chars, 228–232 words) |
| `ja → zh` | Via `en` pivot | `317 ms` first / `317 ms` done (17 chars, 10 words) | `336–337 ms` first / `649–668 ms` done (168–186 chars, 79–89 words) | `333–341 ms` first / `1,778–1,797 ms` done (711–718 chars, 333–337 words) |

Other states measured in the same harness:

- **Bubble card appearance**: `1.7–6.1 ms` on warm selections (`13.2–19.8 ms` on the first selection in a tab, which creates the Shadow Root and loads the ~80 kB stylesheet).
- **First selection in a newly opened tab (cold in tab)**: medium paragraphs finished in `324 ms` (`en → zh`, 271 chars), `421 ms` (`zh → en`, 140 chars), `364 ms` (`en → ja`, 301 chars), and `684 ms` (`ja → zh`, 196 chars).
- **Re-selecting the same passage (in-memory cache hit)**: `5.8 ms` median (`5.0–8.1 ms` across 3 runs on a 50-char `en → zh` sentence). NanoGloss caches up to 200 recent translations in tab memory and clears them when the tab closes or reloads.

### Where the milliseconds go (raw Chrome API breakdown)

Calling Chrome's APIs directly in the page without UI overhead shows how time splits between session setup and model inference (`translateStreaming()`, 6 distinct inputs per row; median and range of runs 2–6 after one warm-up run):

| Language pair | `Translator.create()` | Short TTFT / Total | Medium TTFT / Total | Long TTFT / Total |
|---|---:|---|---|---|
| `en → zh` | `143 ms` | `27 ms` / `27 ms` (50–60 chars) | `31 ms` / `123 ms` (275–337 chars) | `30 ms` / `567 ms` (1,356–1,419 chars, 19–20 chunks) |
| `zh → en` | `136 ms` | `25 ms` / `25 ms` (13–15 chars) | `31 ms` / `196 ms` (132–140 chars) | `30 ms` / `887 ms` (613–623 chars, 31 chunks) |
| `en → ja` | `143 ms` | `29 ms` / `29 ms` (53–60 chars) | `36 ms` / `144 ms` (300–341 chars) | `33 ms` / `648 ms` (1,373–1,419 chars, 20 chunks) |
| `ja → zh` | `209 ms` | `42 ms` / `43 ms` (15–23 chars) | `62 ms` / `331 ms` (167–180 chars) | `58 ms` / `1,342 ms` (707–725 chars, 24–25 chunks) |

- **Model inference starts in `25–62 ms`.** Even on a 1,400-character passage, the first streamed chunk arrives in roughly `30 ms` (`58 ms` when pivoting through English), so text begins appearing well before the full passage finishes.
- **Most of a short selection's ~220 ms end-to-end time is `Translator.create()` (`~140 ms`, or `~210 ms` for a pivot pair).** Chrome caps how many live `Translator` instances can exist at once across tabs, so NanoGloss destroys its instance whenever the bubble closes and creates a new one on the next selection.
- **`Translator.availability()` and `LanguageDetector`** add under `2 ms` combined (`availability()` median `0.15–0.20 ms`; `LanguageDetector.create()` `0.4–0.7 ms`; `detector.detect()` median `0.1–0.4 ms` for short/medium text and `1.0–1.2 ms` for long text).

### One-time language pack download and disk size

- **Subsequent pack download**: `3.2–3.3 s` end to end (`3,170 ms` for `en↔ja`, `3,264 ms` for `en↔fr`), including `~1.3–1.4 s` of network transfer and `~1.8 s` of initialization and model registration.
- **First translation in a brand-new Chrome profile**: `119.6 s` on the first `en↔zh` request in an empty `--user-data-dir`, because Chrome downloaded and installed the shared `TranslateKit` runtime library (`libtranslatekit.so`, `23.77 MiB`) before fetching the `en_zh` pack (`1.5 s` transfer). In a normal profile where Chrome has already fetched its runtime components, only the language pack download applies.

## How Chrome's built-in translation model works

Chrome's built-in AI stack separates general-purpose foundation models from task-specific **expert models** ([Built-in AI overview](https://developer.chrome.com/docs/ai/built-in/overview), [Get started with built-in AI](https://developer.chrome.com/docs/ai/get-started)):

- **Expert NMT models, not Gemini Nano.** The Prompt, Summarizer, Writer, Rewriter, and Proofreader APIs run on Gemini Nano (which requires 22 GB of free disk space and GPU/RAM checks). The [Translator API](https://developer.chrome.com/docs/ai/translator-api) and [Language Detector API](https://developer.chrome.com/docs/ai/language-detection) instead use compact expert models built specifically for neural machine translation (`TranslateKit` with TensorFlow Lite encoder/decoder weights) and language ranking. They run on desktop Chrome without Gemini Nano's 22 GB storage or VRAM requirements.
- **Bidirectional packs with English as the pivot.** Chrome stores language packs per browser profile under `TranslateKit/models/`. Each pack pairs one language with English in both directions — for example, `en_zh` (`76.58 MiB` / `80.3 MB`, 21 files) contains `en_zh_nmt`, `zh_en_nmt`, and `en_zh_dictionary`, while `en_ja` is `75.88 MiB` (`79.6 MB`) and `en_fr` is `77.28 MiB` (`81.0 MB`), alongside the shared `libtranslatekit.so` runtime (`23.77 MiB` / `24.9 MB`). Translating between two non-English languages such as `ja → zh` installs no `ja_zh` pack; Chrome chains `ja → en` and `en → zh` on the device, which is why non-English pairs need both packs and take roughly 1.5–2× as long.
- **Local Language Detector.** When source language is set to auto-detect, NanoGloss calls Chrome's [Language Detector API](https://developer.chrome.com/docs/ai/language-detection), a local ranking model that scores candidate languages from `0.0` to `1.0`. Because single words and very short phrases can score poorly, NanoGloss requires at least `0.5` confidence and otherwise falls back to the page's declared `lang` attribute.

## Privacy and offline behavior

- **Selected text stays on the device.** Inference runs inside Chrome's local `TranslateKit` runtime. NanoGloss has no backend, account, or API key, and makes no network requests of its own (see [PRIVACY.md](../PRIVACY.md)).
- **Works offline after pack installation.** Network access is used only by Chrome when downloading or updating the runtime and language packs from Google. Once a pair's pack (or both packs for a non-English pair) is ready on disk, translation and language detection work with no internet connection.
- **Per-site availability masking.** To prevent websites from fingerprinting which languages a user has installed, `Translator.availability()` reports `"downloadable"` to any origin that has not yet called `Translator.create()` for that pair ([Translator API — Model download](https://developer.chrome.com/docs/ai/translator-api#model_download)). A pack already on disk becomes `"available"` for that site right after its first user-activated `create()` call without re-downloading the model files.

## Requirements and platform limits

- **Browser and OS**: Desktop Google Chrome 138 or newer. Chrome's built-in Translator and Language Detector APIs are not available on Android or iOS, and are not shipped in Firefox or Safari (check `chrome://settings/help` or NanoGloss's **System Status** tab).
- **User activation for first use on a site**: When `Translator.availability()` returns `"downloadable"` or `"downloading"`, Chrome requires a user gesture (`navigator.userActivation.isActive`) before `Translator.create()` can start. If a selection gesture did not carry activation, NanoGloss shows a **Download language pack** button in the bubble so one click starts it.
- **Sequential queue**: Chrome processes requests on a translator sequentially ([Translator API — Sequential translations](https://developer.chrome.com/docs/ai/translator-api#sequential_translations)). NanoGloss aborts any superseded selection immediately and splits long selections on paragraph boundaries around 600 characters (`TRANSLATION_CHUNK_TARGET`) while streaming each chunk through `translateStreaming()`.
- **Execution contexts**: By default, Chrome exposes the APIs only to top-level documents and same-origin iframes, not to Web Workers, and not to cross-origin iframes unless the embedding page delegates permission with `<iframe allow="translator; language-detector">`. Chrome also blocks content scripts on `chrome://` pages and the Chrome Web Store.
- **Supported languages**: Chrome currently lists 39 language codes (`ar`, `bg`, `bn`, `cs`, `da`, `de`, `el`, `en`, `es`, `fi`, `fr`, `he`, `hi`, `hr`, `hu`, `id`, `it`, `ja`, `kn`, `ko`, `lt`, `mr`, `nl`, `no`, `pl`, `pt`, `ro`, `ru`, `sk`, `sl`, `sv`, `ta`, `te`, `th`, `tr`, `uk`, `vi`, `zh`, `zh-Hant`), and Chrome decides whether each pair is available on a given device.
