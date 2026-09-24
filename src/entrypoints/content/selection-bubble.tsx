import type { SelectionSegment } from "@/utils/segments"
import type { SelectionTranslationController, TranslationState } from "@/utils/translation-controller"
import {
  Alert,
  Button,
  Card,
  ProgressCircle,
  ScrollShadow,
  Separator,
  Spinner,
  Typography,
} from "@heroui/react"
import { useSyncExternalStore } from "react"

export interface SelectionBubbleProps {
  controller: SelectionTranslationController
  /**
   * Dismiss the bubble (unmount + cancel the in-flight translation). Needed because the
   * shadow root isolates key events, so the content script's document listener never sees
   * an Escape pressed while focus is inside the bubble.
   */
  onDismiss: () => void
}

/** The bubble takes this share of the viewport width; the content script clamps placement against it. */
export const BUBBLE_WIDTH_RATIO = 0.6
/** Hard cap so the bubble stays a reading column instead of spanning an ultrawide monitor. */
export const BUBBLE_MAX_WIDTH = 720

function StatusRow({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-2">{children}</div>
}

/**
 * Code from the selection. It is never sent to the translator — a snippet comes back mangled,
 * and the identifiers in it are what a reader needs verbatim — so the bubble shows it the way a
 * fenced block would instead.
 *
 * HeroUI styles a code block as `.typography-prose pre` (`rounded-xl bg-default font-mono
 * leading-relaxed`); the spacing and type size are tightened here because the bubble is a
 * narrow reading column. `translate="no"` keeps Chrome's own page translation from rewriting it
 * on the way past.
 */
function CodeBlock({ text }: { text: string }) {
  return (
    <pre translate="no" className="rounded-xl bg-default p-2 font-mono text-xs leading-relaxed whitespace-pre-wrap break-words">
      <code>{text}</code>
    </pre>
  )
}

/**
 * A ripple, to say "something is happening" while the model downloads.
 *
 * HeroUI ships no ripple — its keyframes are `progress-*-indeterminate`, `skeleton`, `pulse`,
 * `spin`, `enter`/`exit` and the toast ones — so this composes one from Tailwind's `animate-ping`
 * and the accent token. `motion-reduce:animate-none` keeps it still for users who ask for less
 * motion.
 */
function DownloadRipple() {
  return (
    <span className="relative flex size-2 shrink-0">
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-75 motion-reduce:animate-none" />
      <span className="relative inline-flex size-2 rounded-full bg-accent" />
    </span>
  )
}

/**
 * A text segment's paragraphs, with the blank lines dropped.
 *
 * The walk adds one `\n` per block boundary, but the text nodes in between carry their own
 * newlines and indentation from the page's HTML source, so a segment can arrive with blank
 * lines the rendered page never showed. Splitting on runs of newlines and trimming each piece
 * keeps the paragraph breaks and discards the rest. Display-only: the translator still gets
 * the segment as collected.
 */
function previewParagraphs(text: string): string[] {
  return text.split(/\n+/).map(line => line.trim()).filter(line => line !== "")
}

/** The selection as it was made: prose in the reading order, code rendered as code. */
function SelectionPreview({ segments }: { segments: SelectionSegment[] }) {
  return (
    <div className="flex flex-col gap-2">
      {segments.flatMap((segment, index) => (
        segment.kind === "code"
          ? [<CodeBlock key={index} text={segment.text} />]
          : previewParagraphs(segment.text).map((paragraph, paragraphIndex) => (
            <Typography.Paragraph key={`${index}-${paragraphIndex}`} size="sm" color="muted" align="justify" className="bubble-prose bubble-preview">
              {paragraph}
            </Typography.Paragraph>
          ))
      ))}
    </div>
  )
}

/**
 * The translation, as it arrives: the streaming state and the finished one show the same
 * container, only the text differs. The translation is what the bubble is for, so it gets the
 * room: up to 16 rem before it scrolls, against the preview's 6.
 */
function TranslationBody({ text }: { text: string }) {
  return (
    <ScrollShadow
      className="max-h-64"
      hideScrollBar
      size={24}
      tabIndex={0}
      role="group"
      aria-label="Translation"
    >
      <Typography.Paragraph size="base" align="justify" className="bubble-prose whitespace-pre-wrap">{text}</Typography.Paragraph>
    </ScrollShadow>
  )
}

function StateBody({ state, onTranslate }: { state: TranslationState, onTranslate: () => void }) {
  switch (state.status) {
    // Never rendered in the bubble: `idle` means nothing was selected yet, and the content
    // script does not mount the bubble for `same-language`. Both exist for the playground.
    case "idle":
    case "same-language":
      return null

    case "checking":
      return (
        <StatusRow>
          <Spinner size="sm" />
          <Typography.Paragraph size="sm" color="muted">
            Checking the built-in translator…
          </Typography.Paragraph>
        </StatusRow>
      )

    case "downloading":
      return (
        <div className="flex items-center gap-3">
          {/* Indeterminate until the first progress event, then a smoothly filling arc. */}
          <ProgressCircle
            aria-label="Downloading the language pack"
            className="shrink-0"
            color="accent"
            isIndeterminate={state.percent === 0}
            size="sm"
            value={state.percent}
          >
            <ProgressCircle.Track>
              <ProgressCircle.TrackCircle />
              <ProgressCircle.FillCircle />
            </ProgressCircle.Track>
          </ProgressCircle>

          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1.5">
                <DownloadRipple />
                <Typography.Paragraph size="sm" color="muted">
                  Downloading language pack
                </Typography.Paragraph>
              </div>
              {/* Silenced: a number that ticks up is noise, the ring already carries it. */}
              {state.percent > 0 && (
                <span aria-live="off" className="text-xs text-muted tabular-nums">
                  {state.percent}%
                </span>
              )}
            </div>
            <Typography.Paragraph size="sm" color="muted">
              Only needed once per language pair.
            </Typography.Paragraph>
          </div>
        </div>
      )

    case "translating":
      return (
        <div className="flex flex-col gap-2">
          <StatusRow>
            <Spinner size="sm" />
            <Typography.Paragraph size="sm" color="muted">
              Translating…
            </Typography.Paragraph>
          </StatusRow>
          {/* Deltas land several times a second; announcing each of them would flood a screen
              reader. The finished translation is announced by the surrounding status region. */}
          {state.partial !== "" && (
            <div aria-live="off">
              <TranslationBody text={state.partial} />
            </div>
          )}
        </div>
      )

    case "done":
      return <TranslationBody text={state.translation} />

    case "code-only":
      return (
        <Typography.Paragraph size="sm" color="muted">
          The selection is code, so there is nothing to translate.
        </Typography.Paragraph>
      )

    case "error":
      return (
        <Alert status={state.reason === "needs-user-gesture" ? "warning" : "danger"}>
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>
              {state.reason === "needs-user-gesture" ? "Permission needed" : "Cannot translate"}
            </Alert.Title>
            <Alert.Description>{state.message}</Alert.Description>
          </Alert.Content>
        </Alert>
      )
  }
}

function actionFor(state: TranslationState, onTranslate: () => void) {
  if (state.status !== "error") {
    return null
  }

  const needsGesture = state.reason === "needs-user-gesture"
  return {
    label: needsGesture ? "Download language pack" : "Try again",
    variant: "secondary" as const,
    onPress: onTranslate,
  }
}

/**
 * The in-page bubble, rendered inside a shadow root so its styles stay isolated from the
 * host page (see the content script).
 *
 * Only HeroUI components that render in place are used here: anything built on React
 * Aria portals (Select, Popover, Tooltip, …) would mount outside the shadow root and
 * lose these styles. Those belong to the options page instead.
 */
export function SelectionBubble({ controller, onDismiss }: SelectionBubbleProps) {
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot)
  const action = actionFor(snapshot.state, controller.translate)

  return (
    <div
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          onDismiss()
        }
      }}
    >
      <Card className="bubble-frosted max-w-[calc(100vw-16px)]" style={{ width: `min(${BUBBLE_WIDTH_RATIO * 100}vw, ${BUBBLE_MAX_WIDTH}px)` }} variant="default">
        <Card.Content className="flex flex-col gap-2.5">
          {/* Scrolls, so it needs a tab stop of its own to stay reachable without a mouse.
              Kept short on purpose: the original is context, the translation is the payload. */}
          <ScrollShadow
            className="max-h-24"
            hideScrollBar
            size={24}
            tabIndex={0}
            role="group"
            aria-label="Selected text"
          >
            <SelectionPreview segments={snapshot.segments} />
          </ScrollShadow>

          <Separator variant="tertiary" className="my-1" />

          {/* The result replaces this placeholder asynchronously, so announce what lands. */}
          <div aria-live="polite">
            <StateBody state={snapshot.state} onTranslate={controller.translate} />
          </div>

          {action && (
            <div className="flex justify-end">
              <Button size="sm" variant={action.variant} onPress={action.onPress}>
                {action.label}
              </Button>
            </div>
          )}
        </Card.Content>
      </Card>
    </div>
  )
}