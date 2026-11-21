import {
  Alert,
  Button,
  Card,
  Chip,
  Description,
  Label,
  ListBox,
  NumberField,
  Select,
  Separator,
  Switch,
  Tabs,
  Typography,
} from "@heroui/react"
import ArrowRight from "@gravity-ui/icons/ArrowRight"
import Globe from "@gravity-ui/icons/Globe"
import LogoGithub from "@gravity-ui/icons/LogoGithub"
import Pulse from "@gravity-ui/icons/Pulse"
import SlidersVertical from "@gravity-ui/icons/SlidersVertical"
import Sparkles from "@gravity-ui/icons/Sparkles"
import { useEffect, useState } from "react"
import { getBrowserSupport, MINIMUM_CHROMIUM_VERSION } from "@/utils/browser-support"
import { t } from "@/utils/i18n"
import { getLanguageLabel, resolveLanguageCode, SUPPORTED_LANGUAGE_CODES } from "@/utils/languages"
import { DEFAULT_SETTINGS, settingsItem, type NanoglossSettings } from "@/utils/storage"
import { BrowserSupportCard } from "./browser-support-card"
import { ChromeInternalsCard } from "./chrome-internals-card"
import { LanguagePacks, useLanguagePacks } from "./language-packs"
import { TranslationPlayground } from "./translation-playground"

/** Browser capabilities are fixed for the lifetime of the page, so read them once. */
const BROWSER_SUPPORT = getBrowserSupport()

function OptionsContent({ initialSettings }: { initialSettings: NanoglossSettings }) {
  const [settings, setSettings] = useState<NanoglossSettings>(initialSettings)
  const [selectedTab, setSelectedTab] = useState<string>("packs")

  // Keep in sync with other open copies of this page.
  useEffect(() => {
    return settingsItem.watch(setSettings)
  }, [])

  const targetLanguage = resolveLanguageCode(settings.targetLanguage) ?? "en"
  const packs = useLanguagePacks({
    targetLanguage,
    selectedSourceLanguage: settings.sourceLanguage,
  })

  // The target and source selects offer the same language list.
  const languageItems = SUPPORTED_LANGUAGE_CODES.map((code) => {
    const label = getLanguageLabel(code)
    return (
      <ListBox.Item key={code} id={code} textValue={label}>
        <Label>{label}</Label>
      </ListBox.Item>
    )
  })

  async function update(patch: Partial<NanoglossSettings>) {
    const next = { ...settings, ...patch }
    setSettings(next)
    await settingsItem.setValue(next)
  }

  // Manual mode needs at least one gesture to be triggerable at all, so the switch of the
  // only enabled gesture stays on: it renders disabled and its card click is ignored.
  const altIsLastGesture = settings.triggerAlt && !settings.triggerLongPress
  const longPressIsLastGesture = settings.triggerLongPress && !settings.triggerAlt

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      {/* Brand header */}
      <header className="flex flex-col gap-4 border-b border-separator pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <img
            src="/icon/48.png"
            alt={t("brandIconAlt")}
            className="size-12 shrink-0 rounded-2xl ring-1 ring-border/50 shadow-sm"
          />
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2.5">
              <Typography.Heading level={2} className="text-xl font-bold tracking-tight text-foreground">
                {t("extensionName")}
              </Typography.Heading>
              <Chip size="sm" variant="secondary" className="gap-1 text-xs font-normal">
                <Sparkles width={12} height={12} className="text-accent" />
                <Chip.Label>{t("brandBadge")}</Chip.Label>
              </Chip>
            </div>
            <Typography.Paragraph size="sm" color="muted" className="text-sm text-muted leading-normal">
              {t("brandTagline")}
            </Typography.Paragraph>
          </div>
        </div>

        {/* Translation engine status indicator & external links */}
        <div className="flex shrink-0 items-center gap-2.5">
          <Chip
            size="sm"
            variant="soft"
            color={BROWSER_SUPPORT.supported ? "success" : "danger"}
            className="cursor-pointer gap-2 transition-all hover:opacity-85"
            onClick={() => setSelectedTab("system")}
            title={t("engineStatusTooltip")}
          >
            <span className="relative flex size-2 items-center justify-center">
              {BROWSER_SUPPORT.supported && (
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-75" />
              )}
              <span className={`relative inline-flex size-1.5 rounded-full ${BROWSER_SUPPORT.supported ? "bg-success" : "bg-danger"}`} />
            </span>
            <Chip.Label>
              {BROWSER_SUPPORT.supported ? t("engineAvailable") : t("engineUnavailable")}
            </Chip.Label>
          </Chip>
          <a
            href="https://github.com/shaonianche/nanogloss"
            target="_blank"
            rel="noreferrer"
            aria-label={t("githubRepoAria")}
            className="flex size-7 items-center justify-center rounded-lg text-muted transition-colors hover:bg-default hover:text-foreground"
          >
            <LogoGithub width={16} height={16} />
          </a>
        </div>
      </header>

      {/* Unavailable guidance alert */}
      {!BROWSER_SUPPORT.supported && (
        <Alert status="danger" className="mt-4">
          <Alert.Indicator />
          <Alert.Content className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-0.5">
              <Alert.Title className="text-sm font-semibold">
                {t("engineUnavailableBannerTitle")}
              </Alert.Title>
              <Alert.Description className="text-xs text-muted leading-relaxed">
                {t("engineUnavailableBannerDescription", String(MINIMUM_CHROMIUM_VERSION))}
              </Alert.Description>
            </div>
            <Button
              size="sm"
              variant="danger-soft"
              className="shrink-0 self-start sm:self-center cursor-pointer"
              onPress={() => setSelectedTab("system")}
            >
              {t("viewSystemStatusButton")}
              <ArrowRight width={14} height={14} />
            </Button>
          </Alert.Content>
        </Alert>
      )}

      {/* Tabs navigation */}
      <Tabs
        selectedKey={selectedTab}
        onSelectionChange={key => setSelectedTab(String(key))}
        className="mt-6 w-full"
      >
        <Tabs.ListContainer>
          <Tabs.List aria-label={t("settingsTabsAria")}>
            <Tabs.Tab id="packs">
              <span className="flex items-center gap-2">
                <Globe width={14} height={14} />
                <span>{t("tabLanguagePacks")}</span>
                <span className="rounded-full bg-default px-1.5 py-0.5 font-mono text-[11px] text-muted border border-separator/60">
                  {packs.readyCodes.length}
                </span>
              </span>
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="settings">
              <Tabs.Separator />
              <span className="flex items-center gap-2">
                <SlidersVertical width={14} height={14} />
                <span>{t("tabGeneral")}</span>
              </span>
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="system">
              <Tabs.Separator />
              <span className="flex items-center gap-2">
                <Pulse width={14} height={14} />
                <span>{t("tabSystemStatus")}</span>
              </span>
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>

        {/* Tab 1: Language Packs & Configuration */}
        <Tabs.Panel id="packs" className="flex flex-col gap-6 pt-5">
          <Card>
            <Card.Header className="flex flex-col gap-1 pb-2">
              <div className="flex items-center gap-2.5">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-default border border-separator/60 text-muted">
                  <Globe width={15} height={15} />
                </div>
                <Card.Title className="text-base font-semibold tracking-tight text-foreground">
                  {t("languagesCardTitle")}
                </Card.Title>
              </div>
              <Card.Description className="text-sm text-muted leading-relaxed">
                {t("languagesCardDescription")}
              </Card.Description>
            </Card.Header>

            <Card.Content className="flex flex-col gap-6 pt-1">
              <div className="rounded-xl bg-default/40 p-4 border border-separator/60">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Select
                    className="w-full"
                    value={settings.targetLanguage}
                    onChange={(key) => {
                      if (key != null) {
                        const next = String(key)
                        void update({ targetLanguage: next })

                        const code = resolveLanguageCode(next)
                        if (code && code !== "en") {
                          void packs.prepare(code)
                        }
                      }
                    }}
                  >
                    <Label>{t("targetLanguageLabel")}</Label>
                    <Select.Trigger>
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        {languageItems}
                      </ListBox>
                    </Select.Popover>
                  </Select>

                  <Select
                    className="w-full"
                    value={settings.sourceLanguage}
                    onChange={(key) => {
                      if (key != null) {
                        void update({ sourceLanguage: String(key) })
                      }
                    }}
                  >
                    <Label>{t("sourceLanguageLabel")}</Label>
                    <Select.Trigger>
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        <ListBox.Item id="auto" textValue={t("sourceLanguageAutoLabel")}>
                          <Label>{t("sourceLanguageAutoLabel")}</Label>
                          <Description>{t("sourceLanguageAutoDescription")}</Description>
                        </ListBox.Item>
                        {languageItems}
                      </ListBox>
                    </Select.Popover>
                  </Select>
                </div>
              </div>

              <Separator className="my-1" />

              <LanguagePacks packs={packs} />
            </Card.Content>
          </Card>
        </Tabs.Panel>

        {/* Tab 2: General Settings & Playground */}
        <Tabs.Panel id="settings" className="flex flex-col gap-6 pt-5">
          <Card>
            <Card.Header className="flex flex-col gap-1 pb-2">
              <div className="flex items-center gap-2.5">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-default border border-separator/60 text-muted">
                  <SlidersVertical width={15} height={15} />
                </div>
                <Card.Title className="text-base font-semibold tracking-tight text-foreground">
                  {t("selectionBehaviorTitle")}
                </Card.Title>
              </div>
              <Card.Description className="text-sm text-muted leading-relaxed">
                {t("selectionBehaviorDescription")}
              </Card.Description>
            </Card.Header>

            <Card.Content className="flex flex-col gap-6 pt-1">
              {/* Trigger behavior selector */}
              <div className="flex flex-col gap-3">
                <Label className="text-sm font-medium text-foreground">{t("whenToTranslateLabel")}</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div
                    onClick={() => void update({ triggerMode: "manual" })}
                    className={`flex flex-col gap-1.5 rounded-xl p-3.5 border transition-all cursor-pointer ${
                      settings.triggerMode === "manual"
                        ? "border-foreground/30 bg-surface shadow-xs ring-1 ring-foreground/10"
                        : "border-separator/60 bg-default/20 hover:bg-default/40"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-foreground">{t("triggerManualTitle")}</span>
                      <Chip size="sm" variant="secondary" className="h-5 px-1.5 text-[10px] font-medium border border-separator/60">
                        <Chip.Label>{t("recommendedBadge")}</Chip.Label>
                      </Chip>
                    </div>
                    <span className="text-xs text-muted leading-relaxed">
                      {t("triggerManualDescription")}
                    </span>
                  </div>

                  <div
                    onClick={() => void update({ triggerMode: "auto" })}
                    className={`flex flex-col gap-1.5 rounded-xl p-3.5 border transition-all cursor-pointer ${
                      settings.triggerMode === "auto"
                        ? "border-foreground/30 bg-surface shadow-xs ring-1 ring-foreground/10"
                        : "border-separator/60 bg-default/20 hover:bg-default/40"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-foreground">{t("triggerAutoTitle")}</span>
                    </div>
                    <span className="text-xs text-muted leading-relaxed">
                      {t("triggerAutoDescription")}
                    </span>
                  </div>
                </div>

                {settings.triggerMode === "manual" && (
                  <div className="flex flex-col gap-3 rounded-2xl bg-default/30 p-4 border border-separator/60">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-foreground">
                        {t("activeShortcutsHeading")}
                      </span>
                      <span className="text-[11px] text-muted">
                        {t("activeShortcutsRequirement")}
                      </span>
                    </div>

                    <div className="flex flex-col gap-2.5">
                      {/* Alt shortcut card */}
                      <div
                        onClick={() => {
                          if (!altIsLastGesture) {
                            void update({ triggerAlt: !settings.triggerAlt })
                          }
                        }}
                        className={`flex items-start justify-between gap-3.5 rounded-xl border p-3.5 transition-all ${altIsLastGesture ? "cursor-not-allowed" : "cursor-pointer"} ${
                          settings.triggerAlt
                            ? "border-separator/80 bg-surface shadow-xs"
                            : "border-separator/50 bg-default/20 opacity-70"
                        }`}
                      >
                        <div className="flex flex-col gap-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-foreground">{t("shortcutAltTitle")}</span>
                            <kbd className="rounded-md bg-default px-1.5 py-0.5 font-mono text-[10px] text-muted border border-separator/60">
                              {t("shortcutAltBadge")}
                            </kbd>
                          </div>
                          <span className="text-xs text-muted leading-relaxed">
                            {t("shortcutAltDescription")}
                          </span>
                        </div>
                        <div onClick={e => e.stopPropagation()} className="shrink-0 mt-0.5">
                          <Switch
                            size="sm"
                            isSelected={settings.triggerAlt}
                            isDisabled={altIsLastGesture}
                            onChange={(checked) => {
                              void update({ triggerAlt: checked })
                            }}
                            aria-label={t("shortcutAltTitle")}
                          >
                            <Switch.Content>
                              <Switch.Control>
                                <Switch.Thumb />
                              </Switch.Control>
                            </Switch.Content>
                          </Switch>
                        </div>
                      </div>

                      {/* Long-press shortcut card */}
                      <div
                        className={`flex flex-col gap-3 rounded-xl border p-3.5 transition-all ${
                          settings.triggerLongPress
                            ? "border-separator/80 bg-surface shadow-xs"
                            : "border-separator/50 bg-default/20 opacity-70"
                        }`}
                      >
                        <div
                          onClick={() => {
                            if (!longPressIsLastGesture) {
                              void update({ triggerLongPress: !settings.triggerLongPress })
                            }
                          }}
                          className={`flex items-start justify-between gap-3.5 ${longPressIsLastGesture ? "cursor-not-allowed" : "cursor-pointer"}`}
                        >
                          <div className="flex flex-col gap-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-foreground">{t("shortcutLongPressTitle")}</span>
                              <kbd className="rounded-md bg-default px-1.5 py-0.5 font-mono text-[10px] text-muted border border-separator/60">
                                {t("shortcutLongPressBadge")}
                              </kbd>
                            </div>
                            <span className="text-xs text-muted leading-relaxed">
                              {t("shortcutLongPressDescription")}
                            </span>
                          </div>
                          <div onClick={e => e.stopPropagation()} className="shrink-0 mt-0.5">
                            <Switch
                              size="sm"
                              isSelected={settings.triggerLongPress}
                              isDisabled={longPressIsLastGesture}
                              onChange={(checked) => {
                                void update({ triggerLongPress: checked })
                              }}
                              aria-label={t("shortcutLongPressTitle")}
                            >
                              <Switch.Content>
                                <Switch.Control>
                                  <Switch.Thumb />
                                </Switch.Control>
                              </Switch.Content>
                            </Switch>
                          </div>
                        </div>

                        {settings.triggerLongPress && (
                          <div className="flex flex-col gap-2 pt-3 border-t border-separator/60">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-medium text-foreground">{t("longPressDelayLabel")}</span>
                              <div className="flex items-center gap-1.5">
                                {[500, 1000, 1500].map(ms => (
                                  <button
                                    key={ms}
                                    type="button"
                                    onClick={() => void update({ longPressDelay: ms })}
                                    className={`rounded-md px-2 py-0.5 font-mono text-[11px] cursor-pointer transition-all border ${
                                      settings.longPressDelay === ms
                                        ? "border-separator/80 bg-surface text-foreground font-medium shadow-xs"
                                        : "border-separator/50 bg-default/40 text-muted hover:text-foreground hover:bg-default"
                                    }`}
                                  >
                                    {t("longPressDelayUnit", String(ms))}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <NumberField
                              className="w-full"
                              value={settings.longPressDelay}
                              onChange={(value) => {
                                if (Number.isFinite(value)) {
                                  void update({ longPressDelay: Math.min(3000, Math.max(500, value)) })
                                }
                              }}
                              minValue={500}
                              maxValue={3000}
                              step={100}
                              aria-label={t("longPressDelayLabel")}
                            >
                              <NumberField.Group>
                                <NumberField.DecrementButton />
                                <NumberField.Input />
                                <NumberField.IncrementButton />
                              </NumberField.Group>
                              <Description className="text-xs text-muted">
                                {t("longPressDelayDescription")}
                              </Description>
                            </NumberField>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <Separator className="my-1" />

              {/* Threshold control */}
              <div className="flex items-center justify-between gap-4 py-1">
                <div className="flex flex-col gap-0.5 min-w-0">
                  <Label className="text-sm font-medium text-foreground">{t("minSelectionLengthLabel")}</Label>
                  <Description className="text-xs text-muted">
                    {t("minSelectionLengthDescription")}
                  </Description>
                </div>
                <NumberField
                  className="w-32 shrink-0"
                  value={settings.minCharacters}
                  onChange={(value) => {
                    if (Number.isFinite(value)) {
                      void update({ minCharacters: Math.min(10, Math.max(1, value)) })
                    }
                  }}
                  minValue={1}
                  maxValue={10}
                  aria-label={t("minSelectionLengthLabel")}
                >
                  <NumberField.Group>
                    <NumberField.DecrementButton />
                    <NumberField.Input />
                    <NumberField.IncrementButton />
                  </NumberField.Group>
                </NumberField>
              </div>
            </Card.Content>
          </Card>

          <TranslationPlayground
            settings={settings}
            onNavigateToPacks={() => setSelectedTab("packs")}
          />
        </Tabs.Panel>

        {/* Tab 3: System Status */}
        <Tabs.Panel id="system" className="flex flex-col gap-6 pt-5">
          <BrowserSupportCard support={BROWSER_SUPPORT} className="mt-0" />
          <ChromeInternalsCard />
        </Tabs.Panel>
      </Tabs>
    </main>
  )
}

/**
 * Settings load asynchronously; painting with the defaults first would visibly flip the
 * selects once the stored values arrive, so render nothing until they are here.
 */
function OptionsLoader() {
  const [initialSettings, setInitialSettings] = useState<NanoglossSettings | null>(null)

  useEffect(() => {
    void settingsItem.getValue().then(async (stored) => {
      // Values stored before the UI guarded the gesture pair can have both off, which
      // leaves manual mode with no way to trigger at all. Heal the pair to the defaults
      // before the first render so the page never shows (or keeps) that state.
      if (!stored.triggerAlt && !stored.triggerLongPress) {
        const healed = {
          ...stored,
          triggerAlt: DEFAULT_SETTINGS.triggerAlt,
          triggerLongPress: DEFAULT_SETTINGS.triggerLongPress,
        }
        await settingsItem.setValue(healed)
        setInitialSettings(healed)
        return
      }
      setInitialSettings(stored)
    })
  }, [])

  return initialSettings ? <OptionsContent initialSettings={initialSettings} /> : null
}

export function App() {
  return <OptionsLoader />
}