import { Button, Card, CloseButton, ProgressBar, Typography } from "@heroui/react"
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react"
import { t } from "@/utils/i18n"

type Placement = "top" | "bottom" | "left" | "right"

export interface TourStep {
  /** The element the step points at. */
  target: RefObject<HTMLElement | null>
  /**
   * Where the card goes relative to the target, in order of preference. A constant: the tour
   * re-measures when this array changes identity.
   */
  placements: readonly Placement[]
  /**
   * Put the card under this element instead, when it stands beside the target: the card then
   * joins what it belongs with and leaves the target and the room around it clear. On a page too
   * narrow for the two to stand side by side, `placements` applies.
   */
  dock?: RefObject<HTMLElement | null>
  title: string
  body: string
  /** What the step adds once the user has done it: a confirmation, a choice. */
  result?: ReactNode
  /** The user did what the step asks, so "Next" becomes the main action. */
  complete: boolean
}

interface TourProps {
  steps: TourStep[]
  index: number
  onIndexChange: (index: number) => void
  onClose: () => void
}

interface Layout {
  /** The step this was measured for: the render right after a step change still holds the old one. */
  index: number
  spot: { x: number, y: number, width: number, height: number }
  card: { x: number, y: number }
  /** The side of the target the card is on, or `null` for a docked card, which has no pointer. */
  placement: Placement | null
  /** Where the card's pointer sits along the edge that faces the target, from that edge's start. */
  pointer: number
}

/** The pointer is a rotated square on the card's edge; this puts it on the edge facing the target. */
const POINTER_EDGE: Record<Placement, string> = {
  top: "bottom-0 translate-y-1/2",
  bottom: "top-0 -translate-y-1/2",
  left: "right-0 translate-x-1/2",
  right: "left-0 -translate-x-1/2",
}

/** Room between the target and the spotlight ring, the ring and the card, and the card and the page edge. */
const SPOT_PADDING = 6
const CARD_GAP = 18
const PAGE_MARGIN = 16

/** How the spotlight travels between targets. Keep in step with `.tour-spotlight` in `style.css`. */
const MOVE_DURATION = 320
const MOVE_EASING = "cubic-bezier(0.77, 0, 0.175, 1)"

/**
 * A guided tour over the page: a spotlight ring around one element at a time, the rest of the
 * page dimmed, and a card beside the ring that says what to do there.
 *
 * HeroUI has no tour component, and its Popover does not fit: a modal popover blocks the page the
 * user is asked to try things on, and a non-modal one closes on scroll. So the card is a HeroUI
 * `Card` placed by this component. Both layers are positioned in page coordinates inside the
 * nearest positioned ancestor, so they scroll with the page instead of being re-placed per frame,
 * and neither takes pointer events away from the page: the dimming is a shadow.
 */
export function Tour({ steps, index, onIndexChange, onClose }: TourProps) {
  const layer = useRef<HTMLDivElement>(null)
  const card = useRef<HTMLDivElement>(null)
  const [layout, setLayout] = useState<Layout | null>(null)
  // The first placement has nothing to travel from; transitions start with the second.
  const [placedOnce, setPlacedOnce] = useState(false)

  const step = steps[index]
  const target = step?.target.current ?? null
  const placements = step?.placements
  const dock = step?.dock?.current ?? null

  useLayoutEffect(() => {
    const layerElement = layer.current
    const cardElement = card.current
    if (!target || !layerElement || !cardElement || !placements) {
      return
    }

    function measure(): Layout | null {
      if (!target || !layerElement || !cardElement || !placements) {
        return null
      }
      const origin = layerElement.getBoundingClientRect()
      const rect = target.getBoundingClientRect()
      const spot = {
        x: rect.left - origin.left - SPOT_PADDING,
        y: rect.top - origin.top - SPOT_PADDING,
        width: rect.width + SPOT_PADDING * 2,
        height: rect.height + SPOT_PADDING * 2,
      }
      const width = cardElement.offsetWidth
      const height = cardElement.offsetHeight

      const dockRect = dock?.getBoundingClientRect()
      if (dockRect && dockRect.left >= rect.right) {
        const docked = { x: dockRect.right - origin.left - width, y: dockRect.bottom - origin.top + CARD_GAP }
        return { index, spot, card: docked, placement: null, pointer: 0 }
      }

      const maxX = Math.max(PAGE_MARGIN, origin.width - width - PAGE_MARGIN)
      const clampX = (x: number) => Math.min(Math.max(PAGE_MARGIN, x), maxX)

      const candidates: Record<Placement, { x: number, y: number }> = {
        top: { x: clampX(spot.x), y: spot.y - CARD_GAP - height },
        bottom: { x: clampX(spot.x), y: spot.y + spot.height + CARD_GAP },
        left: { x: spot.x - CARD_GAP - width, y: spot.y },
        right: { x: spot.x + spot.width + CARD_GAP, y: spot.y },
      }
      const fits = ({ x, y }: { x: number, y: number }) => x >= PAGE_MARGIN && x <= maxX && y >= PAGE_MARGIN
      const placement = placements.find(candidate => fits(candidates[candidate])) ?? "bottom"
      const position = candidates[placement]
      // Aimed at the target's near corner, kept clear of the card's rounded corners.
      const along = placement === "top" || placement === "bottom"
        ? Math.min(spot.x + 40 - position.x, width - 32)
        : Math.min(spot.y + 36 - position.y, height - 32)
      return { index, spot, card: position, placement, pointer: Math.max(32, along) }
    }

    function place() {
      const next = measure()
      if (next) {
        setLayout(next)
      }
    }

    place()
    // The page reflows when the window resizes, a language pack row changes, or the card's own
    // content grows; each of those moves the target or changes the card's size.
    const observer = new ResizeObserver(place)
    observer.observe(layerElement)
    observer.observe(target)
    observer.observe(cardElement)
    if (dock) {
      observer.observe(dock)
    }
    return () => observer.disconnect()
  }, [index, target, placements, dock])

  // Bring the step into view: the target and its card together, centered when they fit.
  //
  // The page scrolls on the same clock as the spotlight: same duration, same curve, started
  // together. The ring's place in the window is its place on the page minus the scroll, so with
  // both following one curve it moves through the window in a straight line. The browser's own
  // smooth scroll runs on a different curve and length, and the ring then visibly went the wrong
  // way first and came back.
  const scrolledFor = useRef<number | null>(null)
  const scrolling = useRef<() => void>(null)
  useEffect(() => {
    const layerElement = layer.current
    const cardElement = card.current
    if (!layout || layout.index !== index || !layerElement || !cardElement || scrolledFor.current === index) {
      return
    }
    scrolledFor.current = index
    scrolling.current?.()
    setPlacedOnce(true)

    const pageTop = layerElement.getBoundingClientRect().top + window.scrollY
    const top = pageTop + Math.min(layout.spot.y, layout.card.y) - PAGE_MARGIN
    const bottom = pageTop + Math.max(layout.spot.y + layout.spot.height, layout.card.y + cardElement.offsetHeight) + PAGE_MARGIN
    if (top >= window.scrollY && bottom <= window.scrollY + window.innerHeight) {
      return
    }
    const from = window.scrollY
    // Clamped to what the page can scroll: aiming past the end would spend the whole curve on a
    // distance the page only covers the first part of, and stop dead when it runs out.
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight
    const to = Math.min(maxScroll, Math.max(0, top - Math.max(0, (window.innerHeight - (bottom - top)) / 2)))
    if (Math.abs(to - from) < 1) {
      return
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      window.scrollTo(0, to)
      return
    }

    // An animation with no keyframes, used as the clock: its progress is already eased, so the
    // curve is written once, the way the stylesheet writes it, instead of being solved here.
    const clock = layerElement.animate([], { duration: MOVE_DURATION, easing: MOVE_EASING })
    let frame = requestAnimationFrame(function tick() {
      const progress = clock.effect?.getComputedTiming().progress ?? 1
      window.scrollTo(0, from + (to - from) * progress)
      frame = progress < 1 && clock.playState === "running" ? requestAnimationFrame(tick) : 0
      if (!frame) {
        window.scrollTo(0, to)
        stop()
      }
    })
    // The user's own scrolling wins: a wheel or a touch ends the tour's.
    function stop() {
      cancelAnimationFrame(frame)
      clock.cancel()
      window.removeEventListener("wheel", stop)
      window.removeEventListener("touchmove", stop)
      scrolling.current = null
    }
    window.addEventListener("wheel", stop, { passive: true })
    window.addEventListener("touchmove", stop, { passive: true })
    scrolling.current = stop
  }, [layout, index])

  // Not from the effect above: that one re-runs whenever the layout is measured again, which
  // must not cut a scroll short.
  useEffect(() => () => scrolling.current?.(), [])

  if (!step) {
    return null
  }

  const last = index === steps.length - 1
  const moving = placedOnce ? "" : "transition-none"

  return (
    <div ref={layer} className="pointer-events-none absolute inset-0 z-40">
      <div
        aria-hidden
        className={`tour-spotlight absolute top-0 left-0 ${moving} ${layout ? "opacity-100" : "opacity-0"}`}
        style={layout
          ? { transform: `translate(${layout.spot.x}px, ${layout.spot.y}px)`, width: layout.spot.width, height: layout.spot.height }
          : undefined}
      />

      <div
        ref={card}
        role="dialog"
        aria-labelledby="tour-title"
        className={`tour-card pointer-events-auto absolute top-0 left-0 w-88 max-w-[calc(100vw-2rem)] ${moving} ${layout ? "" : "invisible"}`}
        style={layout ? { transform: `translate(${layout.card.x}px, ${layout.card.y}px)` } : undefined}
      >
        {layout?.placement && (
          <span
            aria-hidden
            className={`absolute size-3 rotate-45 rounded-[3px] bg-surface ${POINTER_EDGE[layout.placement]}`}
            style={layout.placement === "top" || layout.placement === "bottom" ? { left: layout.pointer - 6 } : { top: layout.pointer - 6 }}
          />
        )}
        <Card className="motion-enter shadow-overlay">
          <Card.Content className="gap-3">
            <div className="flex items-center justify-between gap-3">
              <ProgressBar
                aria-label={t("tourStepCount", [String(index + 1), String(steps.length)])}
                className="w-24"
                color="accent"
                size="sm"
                value={index + 1}
                maxValue={steps.length}
              >
                <ProgressBar.Track>
                  <ProgressBar.Fill />
                </ProgressBar.Track>
              </ProgressBar>
              <span className="mr-auto text-xs text-muted tabular-nums">
                {t("tourStepCount", [String(index + 1), String(steps.length)])}
              </span>
              <CloseButton aria-label={t("tourCloseAria")} onPress={onClose} />
            </div>

            {/* Keyed by step: the card travels to the next target, its text fades in place. */}
            <div key={index} className="motion-fade flex flex-col gap-1.5">
              <Typography.Heading id="tour-title" level={4} className="text-base font-semibold tracking-tight">
                {step.title}
              </Typography.Heading>
              <Typography.Paragraph size="sm" color="muted">{step.body}</Typography.Paragraph>
            </div>

            <div role="status" className="empty:hidden">{step.result}</div>

            <div className="flex items-center justify-between gap-2 pt-1">
              {index > 0
                ? <Button size="sm" variant="ghost" onPress={() => onIndexChange(index - 1)}>{t("tourBack")}</Button>
                : <span />}
              <Button
                size="sm"
                variant={step.complete ? "primary" : "secondary"}
                onPress={() => (last ? onClose() : onIndexChange(index + 1))}
              >
                {last ? t("tourFinish") : t("tourNext")}
              </Button>
            </div>
          </Card.Content>
        </Card>
      </div>
    </div>
  )
}
