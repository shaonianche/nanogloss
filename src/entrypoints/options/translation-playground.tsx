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
        <Card.Title className="text-base font-semibold tracking-tight text-foreground">
          Translation playground
        </Card.Title>
        <Card.Description className="text-sm text-muted leading-relaxed">
          Test your on-device translation settings and language models directly on this page.
        </Card.Description>
      </Card.Header>

      <Card.Content className="flex flex-col gap-4 pt-1">
        {/* Sample text quick triggers */}
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          <span className="text-xs font-medium text-muted mr-0.5">Try sample:</span>
          {SAMPLE_TEXTS.map(sample => (
            <button
              key={sample}
              type="button"
              className="cursor-pointer truncate max-w-[200px] rounded-lg bg-default px-2.5 py-1 text-xs text-foreground transition-colors hover:bg-default-hover active:opacity-75"
              onClick={() => {
                setInputText(sample)
                translateText(sample)
              }}
            >
              {sample}
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

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-muted">
            <span>Target:</span>
            <Chip size="sm" variant="secondary" className="font-normal">
              <Chip.Label>{LANGUAGE_LABELS[targetCode]}</Chip.Label>
            </Chip>
          </div>

          <Button
            size="sm"
            variant="primary"
            isDisabled={!inputText.trim() || busy}
            onPress={() => translateText(inputText)}
          >
            {busy ? (
              <span className="flex items-center gap-1.5">
                <Spinner size="sm" />
                <span>Translating…</span>
              </span>
            ) : "Translate"}
          </Button>
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
                <Button size="sm" variant="secondary" onPress={onNavigateToPacks}>
                  Go to Language Packs
                </Button>
              </div>
            )}
          </Alert>
        )}

        {state.status === "done" && snapshot.sourceLanguage && (
          <div className="flex flex-col gap-2 rounded-xl bg-default/60 p-3.5 border border-separator/60">
            <div className="flex items-center justify-between border-b border-separator/80 pb-2">
              <span className="text-xs font-medium text-muted">
                {LANGUAGE_LABELS[snapshot.sourceLanguage]} → {LANGUAGE_LABELS[snapshot.targetLanguage]}
              </span>
              <Button size="sm" variant="ghost" onPress={() => void handleCopy(state.translation)}>
                {copied ? "Copied!" : "Copy"}
              </Button>
            </div>
            <Typography.Paragraph size="sm" className="whitespace-pre-wrap leading-relaxed select-text text-foreground">
              {state.translation}
            </Typography.Paragraph>
          </div>
        )}
      </Card.Content>
    </Card>
  )
}
