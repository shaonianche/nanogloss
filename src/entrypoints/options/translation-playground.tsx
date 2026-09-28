import ArrowRight from "@gravity-ui/icons/ArrowRight"
import Check from "@gravity-ui/icons/Check"
import Copy from "@gravity-ui/icons/Copy"
import Play from "@gravity-ui/icons/Play"
import Xmark from "@gravity-ui/icons/Xmark"
import { Alert, Button, Card, Chip, Spinner, TextArea, Typography } from "@heroui/react"
import { useState, useSyncExternalStore } from "react"
import { LANGUAGE_LABELS, resolveLanguageCode } from "@/utils/languages"
import type { NanoglossSettings } from "@/utils/storage"
import { createSelectionTranslationController, UNKNOWN_SOURCE_MESSAGE } from "@/utils/translation-controller"

interface TranslationPlaygroundProps {
  settings: NanoglossSettings
  onNavigateToPacks: () => void
}

const SAMPLE_TEXTS = [
  "Hello world! Chrome translates text directly on your device.",
  "NanoGloss runs on-device AI without sending text to any external server.",
  "Bonjour le monde! Comment allez-vous aujourd'hui?",
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
      <Card.Header className="flex flex-col gap-1 pb-2">
        <div className="flex items-center gap-2.5">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-default border border-separator/60 text-muted">
            <Play width={13} height={13} className="fill-current translate-x-0.5" />
          </div>
          <Card.Title className="text-base font-semibold tracking-tight text-foreground">
            Translation playground
          </Card.Title>
        </div>
        <Card.Description className="text-sm text-muted leading-relaxed">
          Test your on-device translation settings and language models directly on this page.
        </Card.Description>
      </Card.Header>

      <Card.Content className="flex flex-col gap-4 pt-1">
        {/* Sample text quick triggers */}
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          <span className="text-xs font-medium text-muted mr-1">Try sample:</span>
          {SAMPLE_TEXTS.map(sample => (
            <button
              key={sample}
              type="button"
              className="cursor-pointer inline-flex items-center truncate max-w-[220px] rounded-full bg-default/80 px-2.5 py-1 text-xs text-foreground border border-separator/60 transition-all hover:bg-default active:scale-95"
              onClick={() => {
                setInputText(sample)
                translateText(sample)
              }}
            >
              <span className="truncate">{sample}</span>
            </button>
          ))}
        </div>

        <TextArea
          fullWidth
          className="w-full min-h-[80px]"
          rows={3}
          placeholder="Type or paste text to test translation..."
          aria-label="Text to translate"
          value={inputText}
          onChange={event => setInputText(event.target.value)}
        />

        <div className="flex items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-3 text-xs text-muted">
            <div className="flex items-center gap-1.5">
              <span>Target:</span>
              <Chip size="sm" variant="secondary" className="font-medium bg-default/80">
                <Chip.Label>{LANGUAGE_LABELS[targetCode]}</Chip.Label>
              </Chip>
            </div>
            {inputText.length > 0 && (
              <span className="font-mono text-[11px] text-muted/70">
                {inputText.length} {inputText.length === 1 ? "char" : "chars"}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {inputText.length > 0 && !busy && (
              <Button
                size="sm"
                variant="ghost"
                className="gap-1 text-xs h-8 text-muted hover:text-foreground"
                onPress={() => setInputText("")}
              >
                <Xmark width={12} height={12} />
                <span>Clear</span>
              </Button>
            )}
            <Button
              size="sm"
              variant="primary"
              isDisabled={!inputText.trim() || busy}
              onPress={() => translateText(inputText)}
              className="gap-1.5 shadow-xs"
            >
              {busy ? (
                <span className="flex items-center gap-1.5">
                  <Spinner size="sm" />
                  <span>Translating…</span>
                </span>
              ) : "Translate"}
            </Button>
          </div>
        </div>

        {state.status === "same-language" && (
          <Alert status="warning">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>Translation Note</Alert.Title>
              <Alert.Description>
                {`The text is already in ${LANGUAGE_LABELS[targetCode]}. Try entering a different language.`}
              </Alert.Description>
            </Alert.Content>
          </Alert>
        )}

        {state.status === "error" && (
          <Alert status="warning">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>Translation Note</Alert.Title>
              <Alert.Description>{state.message}</Alert.Description>
            </Alert.Content>
            {/* A gesture failure or an unknown source is fixed on the packs tab. */}
            {(state.reason === "needs-user-gesture" || state.message === UNKNOWN_SOURCE_MESSAGE) && (
              <div className="mt-2">
                <Button size="sm" variant="secondary" className="text-foreground" onPress={onNavigateToPacks}>
                  Go to Language Packs
                </Button>
              </div>
            )}
          </Alert>
        )}

        {state.status === "done" && snapshot.sourceLanguage && (
          <div className="flex flex-col gap-2 rounded-xl bg-default/50 p-4 border border-separator/70 shadow-xs">
            <div className="flex items-center justify-between border-b border-separator/60 pb-2.5">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted">
                <Chip size="sm" variant="secondary" className="h-5 px-1.5 text-[11px] font-normal">
                  {LANGUAGE_LABELS[snapshot.sourceLanguage]}
                </Chip>
                <ArrowRight width={12} height={12} className="text-muted/80" />
                <Chip size="sm" variant="secondary" className="h-5 px-1.5 text-[11px] font-normal">
                  {LANGUAGE_LABELS[snapshot.targetLanguage]}
                </Chip>
              </div>
              <Button
                size="sm"
                variant={copied ? "secondary" : "ghost"}
                className={`gap-1.5 text-xs h-7 px-2.5 ${copied ? "" : "text-foreground"}`}
                onPress={() => void handleCopy(state.translation)}
              >
                {copied ? (
                  <>
                    <Check width={13} height={13} className="text-success" />
                    <span className="text-success font-medium">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy width={13} height={13} />
                    <span>Copy</span>
                  </>
                )}
              </Button>
            </div>
            <Typography.Paragraph size="sm" className="whitespace-pre-wrap leading-relaxed select-text text-foreground pt-1">
              {state.translation}
            </Typography.Paragraph>
          </div>
        )}
      </Card.Content>
    </Card>
  )
}
