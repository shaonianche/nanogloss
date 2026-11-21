import type { SelectionSegment } from "@/utils/segments"
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
   * The bubble's height, reported whenever it changes.
   *
   * The content script places the bubble and keeps it inside the window, which needs the real
   * height: the bubble grows and shrinks with its content (a streaming translation, a download
   * progress row, an error with a button), and the container WXT mounts it in is not a box the
   * content script can measure from the outside.
   */
  onHeightChange?: (height: number) => void
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

/** Prose with each CJK dash kept on the line of the character before it (see `bindDashes`). */
function Prose({ text }: { text: string }) {
  return bindDashes(text).map((run, index) => (
    run.nowrap ? <span key={index} className="whitespace-nowrap">{run.text}</span> : run.text
  ))
}

/**
 * A text segment's paragraphs, with the blank lines dropped.
 *
 * The walk adds one `\n` per block boundary and collapses the whitespace of ordinary prose, but
 * pre-formatted text (`white-space: pre-wrap` and the like) keeps its own newlines and
 * indentation, so a segment can still arrive with blank lines. Splitting on runs of newlines and
 * trimming each piece keeps the paragraph breaks and discards the rest. Display-only: the
 * translator still gets the segment as collected.
 */
function previewParagraphs(text: string): string[] {
  return text.split(/\n+/).map(line => line.trim()).filter(line => line !== "")
}

/**
 * The selection as it was made: prose in the reading order, code rendered as code.
 *
 * `lang` is the source language once it is known, so the browser shapes the text with that
 * language's fonts and line-breaking rules (see `.bubble-prose`).
 */
function SelectionPreview({ segments, lang }: { segments: SelectionSegment[], lang: string | undefined }) {
  return (
    <div className="flex flex-col gap-2">
      {segments.flatMap((segment, index) => (
        segment.kind === "code"
          ? [<CodeBlock key={index} text={segment.text} />]
          : previewParagraphs(segment.text).map((paragraph, paragraphIndex) => (
            <Typography.Paragraph key={`${index}-${paragraphIndex}`} lang={lang} size="sm" color="muted" className="bubble-prose">
              <Prose text={paragraph} />
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
function TranslationBody({ text, lang }: { text: string, lang: string }) {
  return (
    <ScrollShadow
      className="max-h-64"
      hideScrollBar
      size={24}
      tabIndex={0}
      role="group"
      aria-label={t("bubbleTranslationAria")}
    >
      <Typography.Paragraph lang={lang} size="base" className="bubble-prose whitespace-pre-wrap"><Prose text={text} /></Typography.Paragraph>
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
          {state.partial !== "" && (
            <div aria-live="off">
              <TranslationBody text={state.partial} lang={lang} />
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
      return <TranslationBody text={state.translation} lang={lang} />

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
export function SelectionBubble({ controller, onDismiss, onHeightChange }: SelectionBubbleProps) {
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot)
  const action = actionFor(snapshot.state, controller.translate)
  const root = useRef<HTMLDivElement>(null)

  // Report every change of the bubble's height, whatever caused it: the content changes with the
  // state (a streaming translation grows, a download row appears, an error adds a button), and a
  // narrower window makes the bubble narrower, so the same text wraps onto more lines. That
  // second kind happens without a render, which is why this observes the element instead of
  // measuring after each render: placed with a stale height, a bubble above the selection grows
  // down over it.
  useEffect(() => {
    const element = root.current
    if (!element || !onHeightChange) {
      return
    }
    const observer = new ResizeObserver(() => onHeightChange(element.getBoundingClientRect().height))
    observer.observe(element)
    return () => observer.disconnect()
  }, [onHeightChange])

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
      <Card className="bubble-enter max-w-[calc(100vw-16px)] bg-surface/85 shadow-overlay ring-1 ring-border-secondary backdrop-blur-md" style={{ width: `min(${BUBBLE_WIDTH_RATIO * 100}vw, ${BUBBLE_MAX_WIDTH}px)` }} variant="default">
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