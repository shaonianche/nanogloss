import type { SupportedLanguageCode } from "@/utils/languages"
import type { TranslatorAvailability } from "@/utils/translator"
import {
  Chip,
  ProgressBar,
  Typography,
} from "@heroui/react"
import Check from "@gravity-ui/icons/Check"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { LANGUAGE_LABELS, resolveLanguageCode, SUPPORTED_LANGUAGE_CODES } from "@/utils/languages"
import { destroyTranslators, getLanguagePackAvailability, getTranslator, toTranslatorFailure, waitForTranslatorAvailability } from "@/utils/translator"
import { useI18n } from "./i18n"

const APPROXIMATE_PACK_SIZE = "≈76 MB"

type RowStatus = TranslatorAvailability | "checking" | "error"

interface RowState {
  status: RowStatus
  percent?: number
  message?: string
}

export interface LanguagePacksState {
  rows: Record<string, RowState>
  readyCodes: SupportedLanguageCode[]
  downloadingCodes: SupportedLanguageCode[]
  targetLanguage: SupportedLanguageCode
  configuredSource: SupportedLanguageCode | null
  announcement: string
  prepare: (code: SupportedLanguageCode) => Promise<void>
  refresh: (options?: { skip?: SupportedLanguageCode }) => Promise<void>
}

export interface UseLanguagePacksOptions {
  targetLanguage: SupportedLanguageCode
  selectedSourceLanguage: string
  onPrepared?: (pair: { sourceLanguage: SupportedLanguageCode, targetLanguage: SupportedLanguageCode }) => void
}

export function useLanguagePacks({ targetLanguage, selectedSourceLanguage, onPrepared }: UseLanguagePacksOptions): LanguagePacksState {
  const [rows, setRows] = useState<Record<string, RowState>>({})

  const onPreparedRef = useRef(onPrepared)
  useEffect(() => {
    onPreparedRef.current = onPrepared
  }, [onPrepared])

  const configuredSource = useMemo(() => {
    const configured = resolveLanguageCode(selectedSourceLanguage)
    return configured && configured !== targetLanguage ? configured : null
  }, [selectedSourceLanguage, targetLanguage])

  const [announcement, setAnnouncement] = useState("")

  const setRowUnlessDownloading = useCallback((key: string, state: RowState) => {
    setRows(previous => (previous[key]?.status === "downloading" ? previous : { ...previous, [key]: state }))
  }, [])

  const generationRef = useRef(0)

  /** Refreshes one row from Chrome, unless a generation bump made the answer stale. */
  const checkModel = useCallback(async (code: SupportedLanguageCode) => {
    const generation = generationRef.current
    try {
      const status = await getLanguagePackAvailability(code)
      if (generation !== generationRef.current) {
        return
      }
      setRowUnlessDownloading(code, { status })
    }
    catch (error) {
      if (generation !== generationRef.current) {
        return
      }
      setRowUnlessDownloading(code, { status: "error", message: toTranslatorFailure(error).message })
    }
  }, [setRowUnlessDownloading])

  const refresh = useCallback(async (options?: { skip?: SupportedLanguageCode }) => {
    const allCodes = SUPPORTED_LANGUAGE_CODES.filter(code => code !== options?.skip)
    setRows(previous => {
      const next = { ...previous }
      for (const code of allCodes) {
        if (code === "en") {
          next[code] = { status: "available" }
        } else if (next[code]?.status !== "downloading") {
          next[code] = { status: "checking" }
        }
      }
      return next
    })
    await Promise.all(allCodes.map(code => checkModel(code)))
  }, [checkModel])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const prepare = useCallback(async (code: SupportedLanguageCode) => {
    if (code === "en") {
      return
    }
    setRows(previous => ({ ...previous, [code]: { status: "downloading", percent: 0 } }))

    try {
      await getTranslator({
        sourceLanguage: "en",
        targetLanguage: code,
        onDownloadProgress: (percent) => {
          setRows(previous => ({ ...previous, [code]: { status: "downloading", percent } }))
        },
      })
      // Give Chrome a moment to mark the pair ready: destroying the translator while the
      // model is still settling can leave it on disk but stuck at `downloadable`.
      await waitForTranslatorAvailability({ sourceLanguage: "en", targetLanguage: code })
      destroyTranslators()
      generationRef.current += 1
      // Do not assume success — ask Chrome. The settle wait above can time out, and the
      // availability probe is the only signal for whether the pack is really ready.
      const status = await getLanguagePackAvailability(code)
      setRows(previous => ({ ...previous, [code]: { status } }))
      if (status === "available") {
        setAnnouncement(`Ready: ${LANGUAGE_LABELS[code]}.`)
        onPreparedRef.current?.({ sourceLanguage: "en", targetLanguage: code })
      } else {
        setAnnouncement(`${LANGUAGE_LABELS[code]} is not ready yet; it downloads on first use.`)
      }
      void refresh({ skip: code })
    }
    catch (error) {
      const message = toTranslatorFailure(error).message
      setRows(previous => ({
        ...previous,
        [code]: { status: "error", message },
      }))
      setAnnouncement(`Could not prepare ${LANGUAGE_LABELS[code]}: ${message}`)
    }
  }, [refresh])

  const readyCodes = useMemo(() => {
    return SUPPORTED_LANGUAGE_CODES.filter(code => {
      return code === "en" || rows[code]?.status === "available"
    }).sort((a, b) => {
      if (a === targetLanguage) return -1
      if (b === targetLanguage) return 1
      if (a === configuredSource) return -1
      if (b === configuredSource) return 1
      return LANGUAGE_LABELS[a].localeCompare(LANGUAGE_LABELS[b])
    })
  }, [rows, targetLanguage, configuredSource])

  const downloadingCodes = useMemo(() => {
    return SUPPORTED_LANGUAGE_CODES.filter(code => rows[code]?.status === "downloading")
  }, [rows])

  return {
    rows,
    readyCodes,
    downloadingCodes,
    targetLanguage,
    configuredSource,
    announcement,
    prepare,
    refresh,
  }
}

export interface LanguagePacksProps {
  packs: LanguagePacksState
  targetLanguage: SupportedLanguageCode
  className?: string
}

export function LanguagePacks({ packs, targetLanguage, className = "" }: LanguagePacksProps) {
  const { t } = useI18n()
  const {
    rows,
    readyCodes,
    downloadingCodes,
    configuredSource,
    announcement,
  } = packs

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      <div className="flex items-center justify-between gap-3 pt-1">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold tracking-tight text-foreground">{t("Ready language packs")}</span>
          <span className="text-xs text-muted leading-normal">
            {t("Installed on this profile for instant translation. Missing languages download automatically on demand.")}
          </span>
        </div>
        <Chip size="sm" variant="secondary" className="font-mono text-xs shrink-0 font-medium">
          {readyCodes.length} {t("ready")}
        </Chip>
      </div>

      <ul className="flex flex-col">
        {downloadingCodes.map(code => (
          <li key={code} className="flex items-center justify-between gap-3 border-b border-separator/80 py-3 last:border-b-0">
            <div className="flex min-w-0 flex-col">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium text-foreground">{t(LANGUAGE_LABELS[code])}</span>
                {code === targetLanguage && (
                  <Chip size="sm" variant="secondary" className="text-xs font-normal">{t("Target")}</Chip>
                )}
                {code === configuredSource && (
                  <Chip size="sm" variant="secondary" className="text-xs font-normal">{t("Source")}</Chip>
                )}
              </div>
              <span className="truncate text-xs text-muted mt-0.5">{t("Downloading language pack…")}</span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <ProgressBar className="w-28" value={rows[code]?.percent ?? 0} color="accent" size="sm">
                <ProgressBar.Track>
                  <ProgressBar.Fill />
                </ProgressBar.Track>
                <ProgressBar.Output />
              </ProgressBar>
            </div>
          </li>
        ))}

        {readyCodes.map(code => (
          <li key={code} className="flex items-center justify-between gap-3 border-b border-separator/80 py-3 last:border-b-0">
            <div className="flex min-w-0 flex-col">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium text-foreground">{t(LANGUAGE_LABELS[code])}</span>
                {code === targetLanguage && (
                  <Chip size="sm" variant="secondary" className="text-xs font-normal">{t("Target")}</Chip>
                )}
                {code === configuredSource && (
                  <Chip size="sm" variant="secondary" className="text-xs font-normal">{t("Source")}</Chip>
                )}
              </div>
              <span className="truncate text-xs text-muted mt-0.5">
                {code === "en"
                  ? t("Chrome built-in pivot · No download needed")
                  : `English ↔ ${t(LANGUAGE_LABELS[code])} · ${APPROXIMATE_PACK_SIZE}`}
              </span>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Chip size="sm" variant="secondary" className="text-xs text-muted font-normal">
                <Check width={12} height={12} className="text-foreground/70" />
                <Chip.Label>{t("Ready")}</Chip.Label>
              </Chip>
            </div>
          </li>
        ))}
      </ul>

      <div className="border-t border-separator/60 pt-3">
        <Typography.Paragraph size="sm" color="muted" className="text-xs text-muted leading-relaxed">
          {t("Chrome translates on device using English as a pivot. Language packs download automatically in the background when translating text, taking only a few seconds.")}
        </Typography.Paragraph>
      </div>

      <div role="status" className="sr-only">{announcement}</div>
    </div>
  )
}