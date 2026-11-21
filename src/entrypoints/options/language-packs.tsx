import type { SupportedLanguageCode } from "@/utils/languages"
import type { TranslatorAvailability } from "@/utils/translator"
import {
  Chip,
  ProgressBar,
  Typography,
} from "@heroui/react"
import Check from "@gravity-ui/icons/Check"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { getUiLocale, t } from "@/utils/i18n"
import { getLanguageLabel, resolveLanguageCode, SUPPORTED_LANGUAGE_CODES } from "@/utils/languages"
import { destroyTranslators, getLanguagePackAvailability, getTranslator, toTranslatorFailure, waitForTranslatorAvailability } from "@/utils/translator"

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
      const label = getLanguageLabel(code)
      if (status === "available") {
        setAnnouncement(t("packAnnouncementReady", label))
        onPreparedRef.current?.({ sourceLanguage: "en", targetLanguage: code })
      } else {
        setAnnouncement(t("packAnnouncementDeferred", label))
      }
      void refresh({ skip: code })
    }
    catch (error) {
      const message = toTranslatorFailure(error).message
      setRows(previous => ({
        ...previous,
        [code]: { status: "error", message },
      }))
      setAnnouncement(t("packAnnouncementError", [getLanguageLabel(code), message]))
    }
  }, [refresh])

  const readyCodes = useMemo(() => {
    const locale = getUiLocale()
    return SUPPORTED_LANGUAGE_CODES.filter((code) => {
      return code === "en" || rows[code]?.status === "available"
    }).sort((a, b) => {
      if (a === targetLanguage) return -1
      if (b === targetLanguage) return 1
      if (a === configuredSource) return -1
      if (b === configuredSource) return 1
      return getLanguageLabel(a, locale).localeCompare(getLanguageLabel(b, locale), locale)
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
  className?: string
}

function PackRow({ code, packs, subtitle, children }: {
  code: SupportedLanguageCode
  packs: LanguagePacksState
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <li className="flex items-center justify-between gap-3 border-b border-separator/60 py-3 px-2 rounded-xl transition-colors hover:bg-default/40 last:border-b-0">
      <div className="flex min-w-0 flex-col">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-foreground">{getLanguageLabel(code)}</span>
          {code === packs.targetLanguage && (
            <Chip size="sm" variant="secondary" className="h-5 px-1.5 text-[11px] font-medium border border-separator/60">
              <Chip.Label>{t("packTagTarget")}</Chip.Label>
            </Chip>
          )}
          {code === packs.configuredSource && (
            <Chip size="sm" variant="secondary" className="h-5 px-1.5 text-[11px] font-medium border border-separator/60">
              <Chip.Label>{t("packTagSource")}</Chip.Label>
            </Chip>
          )}
        </div>
        <span className="truncate text-xs text-muted mt-0.5">{subtitle}</span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {children}
      </div>
    </li>
  )
}

export function LanguagePacks({ packs, className = "" }: LanguagePacksProps) {
  const {
    rows,
    readyCodes,
    downloadingCodes,
    announcement,
  } = packs

  const englishLabel = getLanguageLabel("en")
  const approximateSize = t("packApproximateSize")

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      <div className="flex items-center justify-between gap-3 pt-1">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold tracking-tight text-foreground">{t("readyPacksHeading")}</span>
          <span className="text-xs text-muted leading-normal">
            {t("readyPacksDescription")}
          </span>
        </div>
        <Chip size="sm" variant="secondary" className="font-mono text-xs shrink-0 font-medium bg-default/70 border border-separator/60">
          {t("readyPacksCount", String(readyCodes.length))}
        </Chip>
      </div>

      <ul className="flex flex-col">
        {downloadingCodes.map(code => (
          <PackRow key={code} code={code} packs={packs} subtitle={t("packDownloadingSubtitle")}>
            <ProgressBar className="w-28" value={rows[code]?.percent ?? 0} color="accent" size="sm">
              <ProgressBar.Track>
                <ProgressBar.Fill />
              </ProgressBar.Track>
              <ProgressBar.Output />
            </ProgressBar>
          </PackRow>
        ))}

        {readyCodes.map(code => (
          <PackRow
            key={code}
            code={code}
            packs={packs}
            subtitle={code === "en"
              ? t("packPivotSubtitle")
              : t("packPairSubtitle", [englishLabel, getLanguageLabel(code), approximateSize])}
          >
            <Chip size="sm" variant="secondary" className="text-xs text-muted font-normal gap-1">
              <Check width={12} height={12} className="text-success" />
              <Chip.Label>{t("packStatusReady")}</Chip.Label>
            </Chip>
          </PackRow>
        ))}
      </ul>

      <div className="border-t border-separator/60 pt-3">
        <Typography.Paragraph size="sm" color="muted" className="text-xs text-muted leading-relaxed">
          {t("packsFootnote")}
        </Typography.Paragraph>
      </div>

      <div role="status" className="sr-only">{announcement}</div>
    </div>
  )
}