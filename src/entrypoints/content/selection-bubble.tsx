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

/** The bubble's fixed width, in px; the content script clamps its placement against it. */
export const BUBBLE_WIDTH = 480

function StatusRow({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-2">{children}</div>
}

/**
 * Code from the selection. It is never sent to the translator — a snippet comes back mangled,
 * and the identifiers in it are what a reader needs verbatim — so the bubble shows it the way a
 * fenced block would instead.
 *
 * HeroUI styles a code block as `.typography-prose pre` (`rounded-xl bg-default font-mono
 * leading-relaxed`); the spacing and type size are tightened here because the bubble is 480 px
 * wide. `translate="no"` keeps Chrome's own page translation from rewriting it on the way past.
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

/** The selection as it was made: prose in the reading order, code rendered as code. */
function SelectionPreview({ segments }: { segments: SelectionSegment[] }) {
  return (
    <div className="flex flex-col gap-2">
      {segments.map((segment, index) => (
        segment.kind === "code"
          ? <CodeBlock key={index} text={segment.text} />
          : (
            <Typography.Paragraph key={index} size="sm" color="muted" className="whitespace-pre-wrap">
              {segment.text}
            </Typography.Paragraph>
          )
      ))}
    </div>
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
        <StatusRow>
          <Spinner size="sm" />
          <Typography.Paragraph size="sm" color="muted">
            Translating…
          </Typography.Paragraph>
        </StatusRow>
      )

    case "done":
      return <Typography.Paragraph size="sm" className="whitespace-pre-wrap">{state.translation}</Typography.Paragraph>

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
      <Card className="max-w-[calc(100vw-16px)]" style={{ width: BUBBLE_WIDTH }} variant="default">
        <Card.Content className="flex flex-col gap-2.5">
          {/* Scrolls, so it needs a tab stop of its own to stay reachable without a mouse. */}
          <ScrollShadow
            className="max-h-32"
            hideScrollBar
            size={24}
            tabIndex={0}
            role="group"
            aria-label="Selected text"
          >
            <SelectionPreview segments={snapshot.segments} />
          </ScrollShadow>

          <Separator variant="tertiary" />

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