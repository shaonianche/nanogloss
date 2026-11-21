import Cpu from "@gravity-ui/icons/Cpu"
import { Card, Chip, Typography } from "@heroui/react"
import { useEffect, useRef, type RefObject } from "react"
import { getUiLocale, t } from "@/utils/i18n"

export interface EngineActivity {
  phase: "idle" | "running" | "done"
  /** The last measured time from a gesture to its finished translation; `null` before the first. */
  milliseconds: number | null
  /** Counts translations, so each one restarts the track from empty. */
  run: number
}

/** "312 ms", or "1.4 s" from a second up, in the UI language. */
export function formatDuration(milliseconds: number): string {
  const seconds = milliseconds >= 1000
  return new Intl.NumberFormat(getUiLocale(), {
    style: "unit",
    unit: seconds ? "second" : "millisecond",
    maximumFractionDigits: seconds ? 1 : 0,
  }).format(seconds ? milliseconds / 1000 : milliseconds)
}

/**
 * The page's one showpiece: Chrome's built-in model, and how fast it is. While a selection is
 * being translated a stopwatch runs here, and it stops on the time that translation really took,
 * from the gesture to the finished result.
 */
export function EnginePanel({ ref, supported, activity, className }: {
  ref: RefObject<HTMLDivElement | null>
  supported: boolean
  activity: EngineActivity
  className?: string
}) {
  const time = useRef<HTMLSpanElement>(null)
  const { phase, milliseconds } = activity

  // The stopwatch writes to the DOM directly: a state update per frame would re-render the page
  // sixty times a second for one changing number. Reduced motion skips the running digits and
  // shows only the result.
  useEffect(() => {
    const element = time.current
    if (!element) {
      return
    }
    if (phase !== "running" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      element.textContent = milliseconds === null ? "" : formatDuration(milliseconds)
      return
    }
    const start = performance.now()
    let frame = requestAnimationFrame(function tick() {
      element.textContent = formatDuration(performance.now() - start)
      frame = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(frame)
  }, [phase, milliseconds])

  const timed = phase !== "idle" || milliseconds !== null

  return (
    <Card ref={ref} className={className}>
      <Card.Content className="gap-4">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-soft-foreground">
            <Cpu width={20} height={20} />
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <Typography.Paragraph size="sm" weight="semibold">{t("engineTitle")}</Typography.Paragraph>
            <Typography.Paragraph size="xs" color="muted" className="text-pretty">{t("engineSubtitle")}</Typography.Paragraph>
          </div>
        </div>

        {supported && (
          <div className="flex flex-col gap-2">
            <div className="flex min-h-10 items-baseline gap-2">
              {/* Keyed by phase, so the final time settles in when the stopwatch stops. */}
              <span
                key={phase}
                ref={time}
                aria-hidden={phase === "running"}
                className={`text-3xl font-semibold tracking-tight tabular-nums ${phase === "done" ? "engine-time-land" : ""}`}
              />
              {timed
                ? <span className="text-xs text-muted">{t("engineLastTranslation")}</span>
                : <Chip size="sm" color="success" variant="soft">{t("engineReady")}</Chip>}
            </div>
            <div aria-hidden className="h-1 overflow-hidden rounded-full bg-default">
              <div key={activity.run} data-phase={phase} className="engine-track-fill h-full rounded-full bg-accent" />
            </div>
          </div>
        )}
      </Card.Content>
    </Card>
  )
}
