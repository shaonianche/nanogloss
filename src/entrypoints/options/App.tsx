import {
  Alert,
  Button,
  Card,
  Chip,
  Description,
  Kbd,
  Label,
  Link,
  ListBox,
  NumberField,
  Radio,
  RadioGroup,
  Select,
  Separator,
  Switch,
  Tabs,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@heroui/react"
import Globe from "@gravity-ui/icons/Globe"
import LogoGithub from "@gravity-ui/icons/LogoGithub"
import Pulse from "@gravity-ui/icons/Pulse"
import SlidersVertical from "@gravity-ui/icons/SlidersVertical"
import { useEffect, useState } from "react"
import { getBrowserSupport, MINIMUM_CHROMIUM_VERSION } from "@/utils/browser-support"
import { t, type MessageKey } from "@/utils/i18n"
import { getLanguageLabel, resolveLanguageCode, SUPPORTED_LANGUAGE_CODES } from "@/utils/languages"
import { DEFAULT_SETTINGS, settingsItem, type NanoglossSettings } from "@/utils/storage"
import { BrowserSupportCard } from "./browser-support-card"
import { ChromeInternalsCard } from "./chrome-internals-card"
import { LanguagePacks, useLanguagePacks } from "./language-packs"
import { TranslationPlayground } from "./translation-playground"

/** Browser capabilities are fixed for the lifetime of the page, so read them once. */
const BROWSER_SUPPORT = getBrowserSupport()

const TRIGGER_MODES: { value: NanoglossSettings["triggerMode"], title: MessageKey, description: MessageKey }[] = [
  { value: "manual", title: "triggerManualTitle", description: "triggerManualDescription" },
  { value: "auto", title: "triggerAutoTitle", description: "triggerAutoDescription" },
]

const LONG_PRESS_PRESETS = [500, 1000, 1500]

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
            alt=""
            className="size-12 shrink-0 rounded-2xl ring-1 ring-border/50 shadow-sm"
          />
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2.5">
              <Typography.Heading level={2} className="text-xl font-bold">
                {t("extensionName")}
              </Typography.Heading>
              <Chip size="sm">{t("brandBadge")}</Chip>
            </div>
            <Typography.Paragraph size="sm" color="muted">
              {t("brandTagline")}
            </Typography.Paragraph>
          </div>
        </div>

        {/* Translation engine status indicator & external links */}
        <div className="flex shrink-0 items-center gap-2.5">
          <Button size="sm" variant="ghost" onPress={() => setSelectedTab("system")}>
            <Chip size="sm" variant="soft" color={BROWSER_SUPPORT.supported ? "success" : "danger"}>
              {/* Static on purpose: a permanent ping on a settings page reads as an alert that never resolves. */}
              <span className={`inline-flex size-1.5 rounded-full ${BROWSER_SUPPORT.supported ? "bg-success" : "bg-danger"}`} />
              <Chip.Label>
                {BROWSER_SUPPORT.supported ? t("engineAvailable") : t("engineUnavailable")}
              </Chip.Label>
            </Chip>
          </Button>
          <Link
            href="https://github.com/shaonianche/nanogloss"
            target="_blank"
            rel="noreferrer"
            aria-label={t("githubRepoAria")}
            className="text-muted"
          >
            <LogoGithub width={16} height={16} />
          </Link>
        </div>
      </header>

      {/* Unavailable guidance alert */}
      {!BROWSER_SUPPORT.supported && (
        <Alert status="danger" className="mt-4">
          <Alert.Indicator />
          <Alert.Content className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-0.5">
              <Alert.Title>
                {t("engineUnavailableBannerTitle")}
              </Alert.Title>
              <Alert.Description>
                {t("engineUnavailableBannerDescription", String(MINIMUM_CHROMIUM_VERSION))}
              </Alert.Description>
            </div>
            <Button
              size="sm"
              variant="danger-soft"
              className="shrink-0 self-start sm:self-center"
              onPress={() => setSelectedTab("system")}
            >
              {t("viewSystemStatusButton")}
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
                <Chip size="sm" className="tabular-nums">{packs.readyCodes.length}</Chip>
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
            <Card.Header className="gap-1 pb-2">
              <Card.Title className="text-base font-semibold tracking-tight">
                {t("languagesCardTitle")}
              </Card.Title>
              <Card.Description>
                {t("languagesCardDescription")}
              </Card.Description>
            </Card.Header>

            <Card.Content className="gap-6 pt-1">
              <div className="rounded-xl bg-default/40 p-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
            <Card.Header className="gap-1 pb-2">
              <Card.Title className="text-base font-semibold tracking-tight">
                {t("selectionBehaviorTitle")}
              </Card.Title>
              <Card.Description>
                {t("selectionBehaviorDescription")}
              </Card.Description>
            </Card.Header>

            <Card.Content className="gap-6 pt-1">
              {/* Trigger behavior selector */}
              <RadioGroup
                value={settings.triggerMode}
                onChange={value => void update({ triggerMode: value === "auto" ? "auto" : "manual" })}
              >
                <Label>{t("whenToTranslateLabel")}</Label>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {TRIGGER_MODES.map(mode => (
                    <Radio key={mode.value} value={mode.value}>
                      <Radio.Content className="w-full items-start rounded-xl border border-separator p-3.5 transition-colors data-[selected=true]:border-accent data-[selected=true]:bg-accent/10">
                        <Radio.Control className="mt-0.5">
                          <Radio.Indicator />
                        </Radio.Control>
                        <div className="flex flex-col gap-1">
                          <span className="flex items-center gap-2">
                            {t(mode.title)}
                            {mode.value === "manual" && <Chip size="sm">{t("recommendedBadge")}</Chip>}
                          </span>
                          <Description className="font-normal">{t(mode.description)}</Description>
                        </div>
                      </Radio.Content>
                    </Radio>
                  ))}
                </div>
              </RadioGroup>

              {settings.triggerMode === "manual" && (
                <div className="flex flex-col gap-4 rounded-xl bg-default/40 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <Label>{t("activeShortcutsHeading")}</Label>
                    <Description>{t("activeShortcutsRequirement")}</Description>
                  </div>

                  <Switch
                    size="sm"
                    isSelected={settings.triggerAlt}
                    isDisabled={altIsLastGesture}
                    onChange={checked => void update({ triggerAlt: checked })}
                  >
                    <Switch.Content>
                      <Switch.Control>
                        <Switch.Thumb />
                      </Switch.Control>
                      <span className="flex items-center gap-2">
                        {t("shortcutAltTitle")}
                        <Kbd>{t("shortcutAltBadge")}</Kbd>
                      </span>
                    </Switch.Content>
                    <Description>{t("shortcutAltDescription")}</Description>
                  </Switch>

                  <Switch
                    size="sm"
                    isSelected={settings.triggerLongPress}
                    isDisabled={longPressIsLastGesture}
                    onChange={checked => void update({ triggerLongPress: checked })}
                  >
                    <Switch.Content>
                      <Switch.Control>
                        <Switch.Thumb />
                      </Switch.Control>
                      <span className="flex items-center gap-2">
                        {t("shortcutLongPressTitle")}
                        <Kbd>{t("shortcutLongPressBadge")}</Kbd>
                      </span>
                    </Switch.Content>
                    <Description>{t("shortcutLongPressDescription")}</Description>
                  </Switch>

                  {settings.triggerLongPress && (
                    <div className="flex flex-col gap-2 border-t border-separator pt-4">
                      <div className="flex items-center justify-between gap-2">
                        <Label>{t("longPressDelayLabel")}</Label>
                        <ToggleButtonGroup
                          size="sm"
                          aria-label={t("longPressDelayLabel")}
                          selectionMode="single"
                          selectedKeys={[String(settings.longPressDelay)]}
                          onSelectionChange={(keys) => {
                            const [key] = keys
                            if (key !== undefined) {
                              void update({ longPressDelay: Number(key) })
                            }
                          }}
                        >
                          {LONG_PRESS_PRESETS.map((ms, index) => (
                            <ToggleButton key={ms} id={String(ms)} className="tabular-nums">
                              {index > 0 && <ToggleButtonGroup.Separator />}
                              {t("longPressDelayUnit", String(ms))}
                            </ToggleButton>
                          ))}
                        </ToggleButtonGroup>
                      </div>
                      <NumberField
                        className="w-full"
                        aria-label={t("longPressDelayLabel")}
                        value={settings.longPressDelay}
                        onChange={(value) => {
                          if (Number.isFinite(value)) {
                            void update({ longPressDelay: Math.min(3000, Math.max(500, value)) })
                          }
                        }}
                        minValue={500}
                        maxValue={3000}
                        step={100}
                        formatOptions={{ useGrouping: false }}
                      >
                        <NumberField.Group>
                          <NumberField.DecrementButton />
                          <NumberField.Input />
                          <NumberField.IncrementButton />
                        </NumberField.Group>
                        <Description>
                          {t("longPressDelayDescription")}
                        </Description>
                      </NumberField>
                    </div>
                  )}
                </div>
              )}

              <Separator className="my-1" />

              {/* Threshold control */}
              <div className="flex items-center justify-between gap-4 py-1">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <Label>{t("minSelectionLengthLabel")}</Label>
                  <Description>
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