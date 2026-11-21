import ArrowRight from "@gravity-ui/icons/ArrowRight"
import Check from "@gravity-ui/icons/Check"
import Copy from "@gravity-ui/icons/Copy"
import Xmark from "@gravity-ui/icons/Xmark"
import { Alert, Button, Card, Chip, Spinner, TextArea, Typography } from "@heroui/react"
import { useState, useSyncExternalStore } from "react"
import { t, type MessageKey } from "@/utils/i18n"
import { getLanguageLabel, resolveLanguageCode } from "@/utils/languages"
import type { NanoglossSettings } from "@/utils/storage"
import { createSelectionTranslationController, getUnknownSourceMessage } from "@/utils/translation-controller"

interface TranslationPlaygroundProps {
  settings: NanoglossSettings
  onNavigateToPacks: () => void
}

const SAMPLE_KEYS: readonly MessageKey[] = [
  "playgroundSample1",
  "playgroundSample2",
  "playgroundSample3",
]

/**
 * A test bench for the configured language pair. It runs on the same controller as the
 * in-page bubble, so the states it shows (download progress, unknown source, same language)
 * are exactly what a selection on any page would produce.
 */
export function TranslationPlayground({ settings, onNavigateToPacks }: TranslationPlaygroundProps) {
  const [inputText, setInputText] = useState("")
  const [copied, setCopied] = useState(false)
  const [controller] = useState(() => createSelectionTranslationController())
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot)

  const targetCode = resolveLanguageCode(settings.targetLanguage) ?? "en"
  const { state } = snapshot
  const busy = state.status === "checking" || state.status === "downloading" || state.status === "translating"

  function translateText(text: string) {
    const trimmed = text.trim()
    if (!trimmed) {
      return
    }

    void controller.select({
      segments: [{ kind: "text", text: trimmed }],
      sourceLanguage: settings.sourceLanguage === "auto" ? null : resolveLanguageCode(settings.sourceLanguage),
      // No document language here: an undetectable text is an error, not a guess at English.
      documentLanguage: null,
      targetLanguage: targetCode,
    })
  }

  async function handleCopy(translation: string) {
    await navigator.clipboard.writeText(translation)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card className="w-full">
      <Card.Header className="gap-1 pb-2">
        <Card.Title className="text-base font-semibold tracking-tight">
          {t("playgroundTitle")}
        </Card.Title>
        <Card.Description>
          {t("playgroundDescription")}
        </Card.Description>
      </Card.Header>

      <Card.Content className="gap-4 pt-1">
        {/* Sample text quick triggers */}
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          <span className="mr-1 text-xs font-medium text-muted">{t("playgroundSamplesLabel")}</span>
          {SAMPLE_KEYS.map((key) => {
            const sample = t(key)
            return (
              <Button
                key={key}
                size="sm"
                variant="tertiary"
                className="max-w-56"
                onPress={() => {
                  setInputText(sample)
                  translateText(sample)
                }}
              >
                <span className="truncate">{sample}</span>
              </Button>
            )
          })}
        </div>

        <TextArea
          fullWidth
          className="min-h-20"
          rows={3}
          placeholder={t("playgroundPlaceholder")}
          aria-label={t("playgroundInputAria")}
          value={inputText}
          onChange={event => setInputText(event.target.value)}
        />

        <div className="flex items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-3 text-xs text-muted">
            <div className="flex items-center gap-1.5">
              <span>{t("playgroundTargetLabel")}</span>
              <Chip size="sm">{getLanguageLabel(targetCode)}</Chip>
            </div>
            {inputText.length > 0 && (
              <span className="tabular-nums">
                {t(inputText.length === 1 ? "playgroundCharCountSingular" : "playgroundCharCountPlural", String(inputText.length))}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {inputText.length > 0 && !busy && (
              <Button size="sm" variant="ghost" onPress={() => setInputText("")}>
                <Xmark width={14} height={14} />
                {t("clearButton")}
              </Button>
            )}
            <Button
              size="sm"
              variant="primary"
              isDisabled={!inputText.trim()}
              isPending={busy}
              onPress={() => translateText(inputText)}
            >
              {busy && <Spinner color="current" size="sm" />}
              {busy ? t("translatingStatus") : t("translateButton")}
            </Button>
          </div>
        </div>

        {state.status === "same-language" && (
          <Alert status="warning" className="motion-enter">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>{t("playgroundSameLanguageTitle")}</Alert.Title>
              <Alert.Description>
                {t("playgroundSameLanguageDescription", getLanguageLabel(targetCode))}
              </Alert.Description>
            </Alert.Content>
          </Alert>
        )}

        {state.status === "error" && (
          <Alert status="warning" className="motion-enter">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>{t("playgroundErrorTitle")}</Alert.Title>
              <Alert.Description>{state.message}</Alert.Description>
              {/* A gesture failure or an unknown source is fixed on the packs tab. */}
              {(state.reason === "needs-user-gesture" || state.message === getUnknownSourceMessage()) && (
                <Button size="sm" variant="secondary" className="mt-2" onPress={onNavigateToPacks}>
                  {t("goToLanguagePacksButton")}
                </Button>
              )}
            </Alert.Content>
          </Alert>
        )}

        {state.status === "done" && snapshot.sourceLanguage && (
          <Card variant="secondary" className="motion-enter gap-2">
            <div className="flex items-center justify-between border-b border-separator pb-2.5">
              <div className="flex items-center gap-1.5 text-muted">
                <Chip size="sm">{getLanguageLabel(snapshot.sourceLanguage)}</Chip>
                <ArrowRight width={12} height={12} />
                <Chip size="sm">{getLanguageLabel(snapshot.targetLanguage)}</Chip>
              </div>
              <Button size="sm" variant="ghost" onPress={() => void handleCopy(state.translation)}>
                {/* Keyed so the icon swap fades instead of snapping; the label changes with it. */}
                <span key={copied ? "copied" : "copy"} className="motion-fade flex">
                  {copied ? <Check width={14} height={14} className="text-success" /> : <Copy width={14} height={14} />}
                </span>
                {copied ? t("copiedButton") : t("copyButton")}
              </Button>
            </div>
            <Typography.Paragraph size="sm" className="pt-1 whitespace-pre-wrap select-text">
              {state.translation}
            </Typography.Paragraph>
          </Card>
        )}
      </Card.Content>
    </Card>
  )
}
