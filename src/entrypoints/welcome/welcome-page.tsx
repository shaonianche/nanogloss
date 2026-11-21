import type { NanoglossSettings } from "@/utils/storage"
import Check from "@gravity-ui/icons/Check"
import { Button, Link, ToggleButton, ToggleButtonGroup, Typography } from "@heroui/react"
import { useEffect, useRef, useState } from "react"
import { ContentScriptContext } from "wxt/utils/content-script-context"
import { getBrowserSupport, MINIMUM_CHROMIUM_VERSION } from "@/utils/browser-support"
import { t, type MessageKey } from "@/utils/i18n"
import { useSettings } from "@/utils/use-settings"
import { startSelectionTranslator, type TriggerGesture } from "../content/selection-translator"
import bubbleCss from "../content/style.css?inline"
import { EnginePanel, formatDuration, type EngineActivity } from "./engine-panel"
import { LanguagesCard } from "./languages-card"
import { Tour, type TourStep } from "./tour"

/** Browser capabilities are fixed for the lifetime of the page, so read them once. */
const BROWSER_SUPPORT = getBrowserSupport()

const PRACTICE: Record<"en" | "fr", [MessageKey, MessageKey, MessageKey]> = {
  en: ["practiceEnglish1", "practiceEnglish2", "practiceEnglish3"],
  fr: ["practiceFrench1", "practiceFrench2", "practiceFrench3"],
}

/** The tour's three practice steps, in order: which gesture each one teaches. */
const GESTURE_STEPS: { gesture: TriggerGesture, title: MessageKey, body: MessageKey }[] = [
  { gesture: "alt", title: "tourAltTitle", body: "tourAltBody" },
  { gesture: "long-press", title: "tourLongPressTitle", body: "tourLongPressBody" },
  { gesture: "auto", title: "tourAutoTitle", body: "tourAutoBody" },
]

/** Under the engine panel, where the practice steps dock the card too, so the practice text stays clear. */
const ENGINE_PLACEMENTS = ["bottom", "left", "top"] as const
/** Beside the side column on a wide page, above or under its card on a narrow one. */
const SIDE_PLACEMENTS = ["left", "top", "bottom"] as const
/** Above the paragraph first: the bubble opens below the selection. */
const PARAGRAPH_PLACEMENTS = ["top", "right", "bottom"] as const

/** The tour waits for the page's opening motion: its targets are still travelling until then. */
const TOUR_START_DELAY = 700

/**
 * The welcome page: a practice page with a guided tour, opened once after installing and again
 * from the settings page. The practice text runs the content script's own selection code, so the
 * bubble a new user meets here is the one they will get on web pages.
 */
export function WelcomePage({ initialSettings }: { initialSettings: NanoglossSettings }) {
  const [settings, update] = useSettings(initialSettings)
  const [tourIndex, setTourIndex] = useState<number | null>(null)
  // The gestures tried so far, each with the time its translation took once that is known. Kept
  // per gesture: a step must not show the time of the step before it while its own runs.
  const [tried, setTried] = useState<ReadonlyMap<TriggerGesture, number | null>>(new Map())
  const lastGesture = useRef<TriggerGesture | null>(null)
  const [activity, setActivity] = useState<EngineActivity>({ phase: "idle", milliseconds: null, run: 0 })

  const engine = useRef<HTMLDivElement>(null)
  const languages = useRef<HTMLDivElement>(null)
  const article = useRef<HTMLElement>(null)
  const paragraph1 = useRef<HTMLParagraphElement>(null)
  const paragraph2 = useRef<HTMLParagraphElement>(null)
  const paragraph3 = useRef<HTMLParagraphElement>(null)

  // The practice text has to differ from the target language, or there is nothing to translate.
  const practiceLanguage = settings.targetLanguage === "en" ? "fr" : "en"

  // What the practice text fixes for itself, read by the selection code on every press. The
  // language is known, so nothing depends on the detector. During the tour each practice step
  // also sets the trigger it teaches, without touching the stored setting.
  const override = useRef<Partial<NanoglossSettings>>({})
  const dismissBubble = useRef(() => {})
  const gestureStep = tourIndex === null ? undefined : GESTURE_STEPS[tourIndex - 2]
  useEffect(() => {
    override.current = {
      sourceLanguage: practiceLanguage,
      ...(gestureStep && (gestureStep.gesture === "auto"
        ? { triggerMode: "auto" }
        : { triggerMode: "manual", triggerAlt: true, triggerLongPress: true })),
    }
  }, [practiceLanguage, gestureStep])

  // The content script does not run on extension pages, so the page runs the same selection
  // code itself, limited to the practice text. WXT rewrites `:root` to `:host` in the stylesheet
  // it loads for a content script; the inlined copy needs the same.
  useEffect(() => {
    const scope = article.current
    if (!scope || !BROWSER_SUPPORT.supported) {
      return
    }
    const ctx = new ContentScriptContext("welcome")
    dismissBubble.current = startSelectionTranslator(ctx, {
      bubbleCss: bubbleCss.replaceAll(":root", ":host"),
      scope,
      overrideSettings: () => override.current,
      onBubbleShown: (gesture) => {
        lastGesture.current = gesture
        // A repeat keeps the time already measured: the same text comes from the cache next.
        setTried(previous => new Map(previous).set(gesture, previous.get(gesture) ?? null))
      },
      onTranslating: () => setActivity(previous => ({ ...previous, phase: "running", run: previous.run + 1 })),
      onTranslated: (milliseconds) => {
        const gesture = lastGesture.current
        if (milliseconds === null || !gesture) {
          // Nothing to show for this one; the panel keeps the last time it measured.
          setActivity(previous => (previous.phase === "running" ? { ...previous, phase: "idle" } : previous))
          return
        }
        setActivity(previous => ({ ...previous, phase: "done", milliseconds }))
        setTried(previous => new Map(previous).set(gesture, milliseconds))
      },
      onBubbleHidden: () => setActivity(previous => (previous.phase === "running" ? { ...previous, phase: "idle" } : previous)),
    })
    return () => ctx.notifyInvalidated()
  }, [])

  // A press on a HeroUI button never reaches the document (React Aria stops it), so the tour's
  // own buttons would leave the bubble of the previous step open over the next one.
  function showStep(index: number | null) {
    dismissBubble.current()
    // The same press would have cleared the selection; left in place, the previous step's
    // paragraph stays highlighted next to the one the tour now points at.
    window.getSelection()?.removeAllRanges()
    setTourIndex(index)
  }

  useEffect(() => {
    const timer = setTimeout(() => setTourIndex(0), TOUR_START_DELAY)
    return () => clearTimeout(timer)
  }, [])

  function tourSteps(): TourStep[] {
    if (!BROWSER_SUPPORT.supported) {
      return [{
        target: engine,
        placements: ENGINE_PLACEMENTS,
        title: t("tourUnsupportedTitle"),
        body: t("tourUnsupportedBody", String(MINIMUM_CHROMIUM_VERSION)),
        complete: false,
      }]
    }

    const paragraphs = [paragraph1, paragraph2, paragraph3]

    return [
      {
        target: engine,
        placements: ENGINE_PLACEMENTS,
        title: t("tourBrowserTitle"),
        body: t("tourBrowserBody"),
        complete: true,
      },
      {
        target: languages,
        placements: SIDE_PLACEMENTS,
        title: t("tourLanguagesTitle"),
        body: t("tourLanguagesBody"),
        complete: true,
      },
      ...GESTURE_STEPS.map(({ gesture, title, body }, index): TourStep => {
        const done = tried.has(gesture)
        const milliseconds = tried.get(gesture) ?? null
        const translated = milliseconds === null ? null : t("tourTranslatedIn", formatDuration(milliseconds))
        return {
          target: paragraphs[index]!,
          placements: PARAGRAPH_PLACEMENTS,
          // Under the engine panel, whose stopwatch answers the gesture: instruction, time and
          // confirmation in one place, and the practice text stays clear for the bubble.
          dock: engine,
          title: t(title),
          body: t(body),
          complete: done,
          result: done && (
            <div className="motion-enter flex flex-col gap-3">
              <div className="flex items-start gap-2 text-sm text-success">
                <Check width={16} height={16} className="mt-0.5 shrink-0" />
                <span>{[t("tourGestureWorked"), translated].filter(Boolean).join(" ")}</span>
              </div>
              {gesture === "auto" && (
                <div className="flex flex-col gap-2 border-t border-separator pt-3">
                  <Typography.Paragraph size="xs" color="muted">{t("tourChooseMode")}</Typography.Paragraph>
                  <ToggleButtonGroup
                    size="sm"
                    fullWidth
                    aria-label={t("whenToTranslateLabel")}
                    selectionMode="single"
                    disallowEmptySelection
                    selectedKeys={[settings.triggerMode]}
                    onSelectionChange={keys => void update({ triggerMode: keys.has("auto") ? "auto" : "manual" })}
                  >
                    <ToggleButton id="manual">{t("triggerManualTitle")}</ToggleButton>
                    <ToggleButton id="auto">
                      <ToggleButtonGroup.Separator />
                      {t("triggerAutoTitle")}
                    </ToggleButton>
                  </ToggleButtonGroup>
                </div>
              )}
            </div>
          ),
        }
      }),
    ]
  }

  return (
    <div className="relative min-h-screen">
      <main className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-10">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src="/icon/48.png" alt="" className="size-9 shrink-0 rounded-xl ring-1 ring-border/50" />
            <span className="text-base font-semibold tracking-tight">{t("extensionName")}</span>
          </div>
          <div className="flex items-center gap-2">
            {tourIndex === null && (
              <Button size="sm" variant="ghost" className="motion-fade" onPress={() => showStep(0)}>
                {t("welcomeRestartTour")}
              </Button>
            )}
            <Link href="/options.html" className="text-sm text-muted">{t("welcomeOpenSettings")}</Link>
          </div>
        </header>

        <div className="flex max-w-4xl flex-col gap-4">
          {/* Two lines by meaning, what you do and what happens, instead of wherever the
              words happen to wrap. */}
          <Typography.Heading
            level={1}
            className="welcome-rise text-4xl leading-tight font-semibold tracking-tight [--rise:14px] sm:text-5xl"
          >
            <span className="block">{t("welcomeHeadlineAction")}</span>
            <span className="block text-balance text-muted">{t("welcomeHeadlineResult")}</span>
          </Typography.Heading>
          <Typography.Paragraph className="welcome-rise max-w-2xl text-pretty text-muted [--rise:10px] [--wait:70ms]">
            {t("welcomeLede")}
          </Typography.Paragraph>
        </div>

        <div className="welcome-rise grid grid-cols-1 items-start gap-8 [--rise:8px] [--wait:120ms] lg:grid-cols-[minmax(0,1fr)_20rem]">
          <aside className="flex flex-col gap-4 lg:order-last">
            {/* During the practice steps the panel stays lit above the tour's dimming: its
                stopwatch is the answer to what the user just did. */}
            <EnginePanel
              ref={engine}
              supported={BROWSER_SUPPORT.supported}
              activity={activity}
              className={gestureStep ? "relative z-50" : undefined}
            />
            <LanguagesCard ref={languages} settings={settings} onChange={patch => void update(patch)} />
          </aside>

          <article ref={article} lang={practiceLanguage} className="flex max-w-2xl flex-col gap-4">
            <div lang={document.documentElement.lang} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-separator pb-3">
              <Typography.Paragraph size="sm" weight="semibold">{t("welcomePracticeTitle")}</Typography.Paragraph>
              <Typography.Paragraph size="xs" color="muted">{t("welcomePracticeHint")}</Typography.Paragraph>
            </div>
            {/* Roomy on purpose: the bubble opens under the selection, into the gap. */}
            <div className="flex cursor-text flex-col gap-10 pb-32 text-lg leading-relaxed select-text">
              <p ref={paragraph1}>{t(PRACTICE[practiceLanguage][0])}</p>
              <p ref={paragraph2}>{t(PRACTICE[practiceLanguage][1])}</p>
              <p ref={paragraph3}>{t(PRACTICE[practiceLanguage][2])}</p>
            </div>
          </article>
        </div>
      </main>

      {tourIndex !== null && (
        <Tour steps={tourSteps()} index={tourIndex} onIndexChange={showStep} onClose={() => showStep(null)} />
      )}
    </div>
  )
}
