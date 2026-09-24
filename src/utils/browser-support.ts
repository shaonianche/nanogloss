import { getBuiltInLanguageDetectorApi, getBuiltInTranslatorApi } from "./translator"

/**
 * What this browser can actually do for us.
 *
 * NanoGloss has exactly one engine — Chrome's built-in Translator API — and no fallback
 * service, so "does this browser support it" is a hard gate, not a nicety. Verified on
 * Chrome 154: the API ships in desktop Chrome 138+, is exposed in content scripts,
 * extension pages and extension service workers, and is missing in Edge, Firefox and
 * Safari (there, `availability()` cannot even be called).
 *
 * @see https://developer.chrome.com/docs/ai/translator-api
 */
export const MINIMUM_CHROMIUM_VERSION = 138

export interface BrowserSupport {
  /** `Translator` global — the one API the extension cannot work without. */
  translator: boolean
  /** `LanguageDetector` global — only needed for the `auto` source language. */
  languageDetector: boolean
  /** Major Chromium version, or `null` when the user agent does not expose one. */
  chromiumVersion: number | null
  /** Desktop build; the built-in translator is not available on mobile. */
  desktop: boolean
  /**
   * Translation is possible here. The API check is authoritative: a browser that exposes
   * `Translator` can translate, whatever the version string claims.
   */
  supported: boolean
}

interface UserAgentBrand {
  brand: string
  version: string
}

interface NavigatorWithUserAgentData extends Navigator {
  userAgentData?: {
    brands?: UserAgentBrand[]
    mobile?: boolean
  }
}

function readChromiumVersion(): number | null {
  const brands = (navigator as NavigatorWithUserAgentData).userAgentData?.brands
  // Both "Chromium" and "Google Chrome" carry the same major version.
  const brand = brands?.find(entry => /chromium|chrome/i.test(entry.brand))
  const fromBrands = brand ? Number.parseInt(brand.version, 10) : Number.NaN
  if (Number.isFinite(fromBrands)) {
    return fromBrands
  }

  const major = /Chrom(?:e|ium)\/(\d+)/.exec(navigator.userAgent)?.[1]
  return major === undefined ? null : Number.parseInt(major, 10)
}

function isDesktop(): boolean {
  const { userAgentData } = navigator as NavigatorWithUserAgentData
  if (typeof userAgentData?.mobile === "boolean") {
    return !userAgentData.mobile
  }
  return !/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
}

export function getBrowserSupport(): BrowserSupport {
  const translator = getBuiltInTranslatorApi() !== null

  return {
    translator,
    languageDetector: getBuiltInLanguageDetectorApi() !== null,
    chromiumVersion: readChromiumVersion(),
    desktop: isDesktop(),
    supported: translator,
  }
}