import { browser } from "#imports"
import enMessages from "../../public/_locales/en/messages.json"

export type MessageKey = keyof typeof enMessages

interface RawMessageEntry {
  message: string
  placeholders?: Record<string, { content: string }>
}

const FALLBACK_MESSAGES = enMessages as Record<MessageKey, RawMessageEntry>

/**
 * Formats an entry from the bundled English messages catalog using Chrome's
 * `$PLACEHOLDER$` / `$1` rules. Used as a fallback in tests and outside Chrome
 * where `browser.i18n.getMessage` is unavailable or unimplemented.
 */
function formatFallbackMessage(key: MessageKey, substitutions?: string | string[]): string {
  const entry = FALLBACK_MESSAGES[key]
  const values = substitutions === undefined
    ? []
    : Array.isArray(substitutions) ? substitutions : [substitutions]

  let text = entry.message
  if (entry.placeholders) {
    for (const [name, spec] of Object.entries(entry.placeholders)) {
      const replacement = spec.content.replace(/\$(\d+)/g, (_, index: string) => values[Number(index) - 1] ?? "")
      text = text.replace(new RegExp(`\\$${name}\\$`, "gi"), () => replacement)
    }
  }
  return text.replace(/\$(\d+)/g, (_, index: string) => values[Number(index) - 1] ?? "")
}

/**
 * Looks up a localized UI message via Chrome's `i18n` API, falling back to the
 * default English catalog when running in unit tests or outside an extension context.
 */
export function t(key: MessageKey, substitutions?: string | string[]): string {
  try {
    const localized = browser.i18n?.getMessage(key, substitutions)
    if (localized) {
      return localized
    }
  }
  catch {
    // `fakeBrowser.i18n.getMessage` throws in Vitest unless explicitly mocked.
  }

  return formatFallbackMessage(key, substitutions)
}

/**
 * Returns the browser's active UI locale as a BCP-47 tag (e.g. `en`, `zh-CN`),
 * falling back to `navigator.language` or `"en"`.
 */
export function getUiLocale(): string {
  try {
    const locale = browser.i18n?.getUILanguage()
    if (locale) {
      return locale.replace(/_/g, "-")
    }
  }
  catch {
    // `fakeBrowser.i18n.getUILanguage` throws in Vitest unless explicitly mocked.
  }

  if (typeof navigator !== "undefined" && navigator.language) {
    return navigator.language
  }
  return "en"
}
