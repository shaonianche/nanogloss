import type { SelectionSegment, TranslationRun } from "@/utils/segments"
import { bindDashes } from "@/utils/typography"
import type { SelectionTranslationController, TranslationState } from "@/utils/translation-controller"
import { getUiLocale, t } from "@/utils/i18n"
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
import { useEffect, useRef, useSyncExternalStore } from "react"

export interface SelectionBubbleProps {
  controller: SelectionTranslationController
  /**
   * Dismiss the bubble (unmount + cancel the in-flight translation). Needed because the
   * shadow root isolates key events, so the content script's document listener never sees
   * an Escape pressed while focus is inside the bubble.
   */
  onDismiss: () => void
  /**
   * The bubble's size, reported whenever it changes.
   *
   * The content script places the bubble and keeps it inside the window, which needs the real
   * width and height: the width adapts to the selected text, the height grows and shrinks with
   * its content (a streaming translation, a download progress row, an error with a button), and
   * the container WXT mounts it in is not a box the content script can measure from the outside.
   */
  onSizeChange?: (size: { width: number, height: number }) => void
}

/** The bubble takes at most this share of the viewport width; the content script clamps placement against it. */
export const BUBBLE_WIDTH_RATIO = 0.6
/** Minimum width so status rows, download progress, and error actions stay readable. */
export const BUBBLE_MIN_WIDTH = 260
/** Floor when the selection includes a code block, so code does not wrap into a narrow column. */
export const BUBBLE_CODE_MIN_WIDTH = 380
/** Hard cap so the bubble stays a reading column instead of spanning an ultrawide monitor. */
export const BUBBLE_MAX_WIDTH = 720

const SHORT_SELECTION_UNITS = 20
const LONG_SELECTION_UNITS = 200
const WIDE_CHAR_PATTERN = /[\u1100-\u115F\u2E80-\u9FFF\uAC00-\uD7A3\uF900-\uFAFF\uFE10-\uFE6F\uFF01-\uFF60\uFFE0-\uFFE6]/

/**
 * Estimates a selection's visual length in single-width character units: CJK and fullwidth
 * characters count as 2, everything else as 1, with whitespace runs collapsed.
 */
function visualLength(text: string): number {
  let units = 0
  for (const char of text.replace(/\s+/g, " ").trim()) {
    units += WIDE_CHAR_PATTERN.test(char) ? 2 : 1
  }
  return units
}

/**
 * Target bubble width for a selection, computed once from the selected text so short selections
 * render in a narrower column while streaming translations only grow vertically.
 */
export function bubbleWidthFor(segments: SelectionSegment[]): number {
  let units = 0
  let hasCode = false
  for (const segment of segments) {
    if (segment.kind === "code") {
      hasCode = true
    }
    units += visualLength(segment.text)
  }

  const ratio = Math.min(1, Math.max(0, (units - SHORT_SELECTION_UNITS) / (LONG_SELECTION_UNITS - SHORT_SELECTION_UNITS)))
  const width = Math.round(BUBBLE_MIN_WIDTH + ratio * (BUBBLE_MAX_WIDTH - BUBBLE_MIN_WIDTH))
  return hasCode ? Math.max(BUBBLE_CODE_MIN_WIDTH, width) : width
}

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

function InlineCode({ text }: { text: string }) {
  return (
    <code translate="no" className="rounded-md bg-default px-1 py-0.5 font-mono text-[0.875em] break-words">
      {text}
    </code>
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

/** Prose with each CJK dash kept on the line of the character before it (see `bindDashes`). */
function Prose({ text }: { text: string }) {
  return bindDashes(text).map((run, index) => (
    run.nowrap ? <span key={index} className="whitespace-nowrap">{run.text}</span> : run.text
  ))
}

/**
 * Groups consecutive inline segments (`text`, `inline-code`, `inline-literal`) into paragraphs
 * split on newlines, keeping block `code` segments separate.
 */
function SelectionPreview({ segments, lang }: { segments: SelectionSegment[], lang: string | undefined }) {
  const blocks: Array<{ kind: "code", text: string } | { kind: "paragraph", runs: TranslationRun[] }> = []

  for (const segment of segments) {
    if (segment.kind === "code") {
      blocks.push({ kind: "code", text: segment.text })
      continue
    }

    const parts = segment.text.split(/\n+/)
    for (const [i, piece] of parts.entries()) {
      const last = blocks[blocks.length - 1]
      if (i > 0 || !last || last.kind !== "paragraph") {
        if (piece.trim() !== "") {
          blocks.push({ kind: "paragraph", runs: [{ kind: segment.kind, text: piece }] })
        }
      }
      else if (piece !== "") {
        last.runs.push({ kind: segment.kind, text: piece })
      }
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {blocks.map((block, index) => (
        block.kind === "code"
          ? <CodeBlock key={index} text={block.text} />
          : (
            <Typography.Paragraph key={index} lang={lang} size="sm" color="muted" className="bubble-prose">
              {block.runs.map((run, runIndex) => (
                run.kind === "inline-code"
                  ? <InlineCode key={runIndex} text={run.text} />
                  : <Prose key={runIndex} text={run.text} />
              ))}
            </Typography.Paragraph>
          )
      ))}
    </div>
  )
}

/**
 * The translation, as it arrives: the streaming state and the finished one show the same
 * container, only the text differs. The translation is what the bubble is for, so it gets the
 * room: up to 16 rem before it scrolls, against the preview's 6.
 */
function TranslationBody({ runs, lang }: { runs: TranslationRun[], lang: string }) {
  return (
    <ScrollShadow
      className="max-h-64"
      hideScrollBar
      size={24}
      tabIndex={0}
      role="group"
      aria-label={t("bubbleTranslationAria")}
    >
      <Typography.Paragraph lang={lang} size="base" className="bubble-prose whitespace-pre-wrap">
        {runs.map((run, index) => (
          run.kind === "inline-code"
            ? <InlineCode key={index} text={run.text} />
            : <Prose key={index} text={run.text} />
        ))}
      </Typography.Paragraph>
    </ScrollShadow>
  )
}

function StateBody({ state, lang }: { state: TranslationState, lang: string }) {
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
            {t("bubbleChecking")}
          </Typography.Paragraph>
        </StatusRow>
      )

    case "downloading":
      return (
        <div className="flex items-center gap-3">
          {/* Indeterminate until the first progress event, then a smoothly filling arc. */}
          <ProgressCircle
            aria-label={t("bubbleDownloadingAria")}
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
                  {t("bubbleDownloadingTitle")}
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
              {t("bubbleDownloadingNote")}
            </Typography.Paragraph>
          </div>
        </div>
      )

    case "translating":
      return (
        <div className="flex flex-col gap-2">
          {/* Deltas land several times a second; announcing each of them would flood a screen
              reader. The finished translation is announced by the surrounding status region. */}
          {state.runs.length > 0 && (
            <div aria-live="off">
              <TranslationBody runs={state.runs} lang={lang} />
            </div>
          )}
          {/* Below the text, so finishing removes it from the bottom edge and the translation
              the user is reading does not shift up. */}
          <StatusRow>
            <Spinner size="sm" />
            <Typography.Paragraph size="sm" color="muted">
              {t("translatingStatus")}
            </Typography.Paragraph>
          </StatusRow>
        </div>
      )

    case "done":
      return <TranslationBody runs={state.runs} lang={lang} />

    case "code-only":
      return (
        <Typography.Paragraph size="sm" color="muted">
          {t("bubbleCodeOnly")}
        </Typography.Paragraph>
      )

    case "error":
      return (
        <Alert status={state.reason === "needs-user-gesture" ? "warning" : "danger"}>
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>
              {state.reason === "needs-user-gesture" ? t("bubbleErrorPermissionTitle") : t("bubbleErrorDefaultTitle")}
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
    label: needsGesture ? t("bubbleActionDownload") : t("bubbleActionRetry"),
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
export function SelectionBubble({ controller, onDismiss, onSizeChange }: SelectionBubbleProps) {
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot)
  const action = actionFor(snapshot.state, controller.translate)
  const targetWidth = bubbleWidthFor(snapshot.segments)
  const root = useRef<HTMLDivElement>(null)

  // Report every change of the bubble's size, whatever caused it: the content changes with the
  // state (a streaming translation grows, a download row appears, an error adds a button), and a
  // narrower window makes the bubble narrower, so the same text wraps onto more lines. That
  // second kind happens without a render, which is why this observes the element instead of
  // measuring after each render: placed with a stale size, a bubble above the selection grows
  // down over it or clips off the right edge.
  useEffect(() => {
    const element = root.current
    if (!element || !onSizeChange) {
      return
    }
    const observer = new ResizeObserver(() => {
      const { width, height } = element.getBoundingClientRect()
      onSizeChange({ width, height })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [onSizeChange])

  return (
    <div
      ref={root}
      // The bubble's own labels are in Chrome's UI language (`t()`). Without this they would
      // inherit the host page's `lang` through the shadow root and be set in that language's fonts.
      lang={getUiLocale()}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          onDismiss()
        }
      }}
    >
      {/* The bubble floats over a page it knows nothing about, often a white one. A card's own
          shadow (4–6% black) is meant for a card resting on a tinted page background, and leaves a
          white bubble with no visible edge on white. So it takes the shadow HeroUI gives its
          overlays (popover, modal), plus a hairline for the edge itself. The hairline uses the
          secondary border token: the default one is 1.35:1 against white, which a real screen
          still showed as too faint along the top and the sides. */}
      <Card className="bubble-enter max-w-[calc(100vw-16px)] bg-surface/85 shadow-overlay ring-1 ring-border-secondary backdrop-blur-md" style={{ width: `min(${BUBBLE_WIDTH_RATIO * 100}vw, ${targetWidth}px)` }} variant="default">
        <Card.Content className="gap-2.5">
          {/* Scrolls, so it needs a tab stop of its own to stay reachable without a mouse.
              Kept short on purpose: the original is context, the translation is the payload. */}
          <ScrollShadow
            className="max-h-24"
            hideScrollBar
            size={24}
            tabIndex={0}
            role="group"
            aria-label={t("bubbleSelectedTextAria")}
          >
            <SelectionPreview segments={snapshot.segments} lang={snapshot.sourceLanguage ?? undefined} />
          </ScrollShadow>

          <Separator variant="tertiary" className="my-1" />

          {/* The result replaces this placeholder asynchronously, so announce what lands. */}
          <div aria-live="polite">
            {/* A new key per phase re-runs the fade, so each state swap cross-fades in place.
                Streaming and the finished translation share one, so the text already on
                screen never flashes when the last delta lands. */}
            <div key={snapshot.state.status === "done" ? "translating" : snapshot.state.status} className="motion-fade">
              <StateBody state={snapshot.state} lang={snapshot.targetLanguage} />
            </div>
          </div>

          {action && (
            <div className="motion-enter flex justify-end">
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