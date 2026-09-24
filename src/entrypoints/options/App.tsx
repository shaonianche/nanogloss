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
  Tabs,
  Typography,
} from "@heroui/react"
import ArrowRight from "@gravity-ui/icons/ArrowRight"
import CircleFill from "@gravity-ui/icons/CircleFill"
import { useEffect, useState } from "react"
import { getBrowserSupport } from "@/utils/browser-support"
import { LANGUAGE_LABELS, resolveLanguageCode, SUPPORTED_LANGUAGE_CODES, type SupportedLanguageCode } from "@/utils/languages"
import { settingsItem, type NanoglossSettings } from "@/utils/storage"
import { BrowserSupportCard } from "./browser-support-card"
import { ChromeInternalsCard } from "./chrome-internals-card"
import { I18nProvider, useI18n } from "./i18n"
import { LanguagePacks, useLanguagePacks } from "./language-packs"
import { TranslationPlayground } from "./translation-playground"

/** Browser capabilities are fixed for the lifetime of the page, so read them once. */
const BROWSER_SUPPORT = getBrowserSupport()

const AUTO_LANGUAGE_KEY = "auto"

function OptionsContent({ initialSettings }: { initialSettings: NanoglossSettings }) {
  const { t } = useI18n()
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

  async function update(patch: Partial<NanoglossSettings>) {
    const next = { ...settings, ...patch }
    setSettings(next)
    await settingsItem.setValue(next)
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      {/* Brand header */}
      <header className="flex flex-col gap-4 border-b border-separator pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <img src="/icon/48.png" alt="NanoGloss icon" className="size-12 shrink-0 rounded-xl shadow-xs" />
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2.5">
              <Typography.Heading level={2} className="text-xl font-bold tracking-tight text-foreground">
                NanoGloss
              </Typography.Heading>
              <Chip size="sm" variant="secondary" className="text-xs font-normal">
                <Chip.Label>On-Device AI</Chip.Label>
              </Chip>
            </div>
            <Typography.Paragraph size="sm" color="muted" className="text-sm text-muted leading-normal">
              {t("Select text on any page to translate with Chrome's built-in translator.")}
            </Typography.Paragraph>
          </div>
        </div>

        {/* Translation engine status indicator */}
        <div className="flex shrink-0 items-center">
          <Chip
            size="sm"
            variant="soft"
            color={BROWSER_SUPPORT.supported ? "success" : "danger"}
            className="cursor-pointer gap-1.5 transition-opacity hover:opacity-80"
            onClick={() => setSelectedTab("system")}
            title={t("Click to view system status")}
          >
            <CircleFill width={6} height={6} />
            <Chip.Label>
              {BROWSER_SUPPORT.supported ? t("Engine available") : t("Engine unavailable")}
            </Chip.Label>
          </Chip>
        </div>
      </header>

      {/* Unavailable guidance alert */}
      {!BROWSER_SUPPORT.supported && (
        <Alert status="danger" className="mt-4">
          <Alert.Indicator />
          <Alert.Content className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-0.5">
              <Alert.Title className="text-sm font-semibold">
                {t("Translation engine unavailable")}
              </Alert.Title>
              <Alert.Description className="text-xs text-muted leading-relaxed">
                {t("Chrome's built-in translation API is not available in this browser. NanoGloss requires desktop Chrome 138+.")}
              </Alert.Description>
            </div>
            <Button
              size="sm"
              variant="danger-soft"
              className="shrink-0 self-start sm:self-center cursor-pointer"
              onPress={() => setSelectedTab("system")}
            >
              {t("View System Status")}
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
          <Tabs.List aria-label="Settings tabs">
            <Tabs.Tab id="packs">
              {t("Language Packs")}
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="settings">
              <Tabs.Separator />
              {t("General")}
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="system">
              <Tabs.Separator />
              {t("System Status")}
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>

        {/* Tab 1: Language Packs & Configuration */}
        <Tabs.Panel id="packs" className="flex flex-col gap-6 pt-5">
          <Card>
            <Card.Header className="flex flex-col gap-1 pb-2">
              <Card.Title className="text-base font-semibold tracking-tight text-foreground">
                {t("Language packs & configuration")}
              </Card.Title>
              <Card.Description className="text-sm text-muted leading-relaxed">
                {t("Configure translation languages and view ready on-device models.")}
              </Card.Description>
            </Card.Header>

            <Card.Content className="flex flex-col gap-6 pt-1">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
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
                  <Label>{t("Target language")}</Label>
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {SUPPORTED_LANGUAGE_CODES.map(code => (
                        <ListBox.Item key={code} id={code} textValue={LANGUAGE_LABELS[code]}>
                          <Label>{t(LANGUAGE_LABELS[code])}</Label>
                        </ListBox.Item>
                      ))}
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
                  <Label>{t("Source language")}</Label>
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      <ListBox.Item id={AUTO_LANGUAGE_KEY} textValue="Auto">
                        <Label>{t("Auto (page language)")}</Label>
                        <Description>{t("Uses declared or detected language")}</Description>
                      </ListBox.Item>
                      {SUPPORTED_LANGUAGE_CODES.map(code => (
                        <ListBox.Item key={code} id={code} textValue={LANGUAGE_LABELS[code]}>
                          <Label>{t(LANGUAGE_LABELS[code])}</Label>
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
              </div>

              <Separator className="my-2" />

              <LanguagePacks packs={packs} targetLanguage={targetLanguage} />
            </Card.Content>
          </Card>
        </Tabs.Panel>

        {/* Tab 2: General Settings & Playground */}
        <Tabs.Panel id="settings" className="flex flex-col gap-6 pt-5">
          <Card>
            <Card.Header className="flex flex-col gap-1 pb-2">
              <Card.Title className="text-base font-semibold tracking-tight text-foreground">
                {t("Selection & appearance")}
              </Card.Title>
              <Card.Description className="text-sm text-muted leading-relaxed">
                {t("Configure when the translation bubble triggers and customize visual theme.")}
              </Card.Description>
            </Card.Header>

            <Card.Content className="flex flex-col gap-5 pt-1">
              <Select
                className="w-full"
                value={settings.trigger}
                onChange={(key) => {
                  if (key != null) {
                    void update({ trigger: String(key) as NanoglossSettings["trigger"] })
                  }
                }}
              >
                <Label>{t("When to translate")}</Label>
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    <ListBox.Item id="auto" textValue={t("Right after selecting")}>
                      <Label>{t("Right after selecting")}</Label>
                      <Description>{t("Every text selection opens the translation bubble.")}</Description>
                    </ListBox.Item>
                    <ListBox.Item id="alt" textValue={t("While holding Alt")}>
                      <Label>{t("While holding Alt")}</Label>
                      <Description>{t("Only selections made with Alt held down are translated.")}</Description>
                    </ListBox.Item>
                    <ListBox.Item id="long-press" textValue={t("Long-press left button")}>
                      <Label>{t("Long-press left button")}</Label>
                      <Description>{t("Hold the left mouse button at the end of selection to translate.")}</Description>
                    </ListBox.Item>
                  </ListBox>
                </Select.Popover>
              </Select>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <NumberField
                  className="w-full"
                  value={settings.minCharacters}
                  onChange={(value) => {
                    if (Number.isFinite(value)) {
                      void update({ minCharacters: Math.min(10, Math.max(1, value)) })
                    }
                  }}
                  minValue={1}
                  maxValue={10}
                >
                  <Label>{t("Minimum selection length")}</Label>
                  <NumberField.Group>
                    <NumberField.DecrementButton />
                    <NumberField.Input />
                    <NumberField.IncrementButton />
                  </NumberField.Group>
                  <Description>{t("Minimum characters required to open bubble")}</Description>
                </NumberField>

                <Select
                  className="w-full"
                  value={settings.theme}
                  onChange={(key) => {
                    if (key != null) {
                      void update({ theme: String(key) as NanoglossSettings["theme"] })
                    }
                  }}
                >
                  <Label>{t("Theme appearance")}</Label>
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      <ListBox.Item id="system" textValue={t("Follow system")}>
                        <Label>{t("Follow system")}</Label>
                        <Description>{t("Adapts to OS color scheme")}</Description>
                      </ListBox.Item>
                      <ListBox.Item id="light" textValue={t("Light")}>
                        <Label>{t("Light")}</Label>
                        <Description>{t("Always use light appearance")}</Description>
                      </ListBox.Item>
                      <ListBox.Item id="dark" textValue={t("Dark")}>
                        <Label>{t("Dark")}</Label>
                        <Description>{t("Always use dark appearance")}</Description>
                      </ListBox.Item>
                    </ListBox>
                  </Select.Popover>
                </Select>

                {settings.trigger === "long-press" && (
                  <NumberField
                    className="w-full sm:col-span-2"
                    value={settings.longPressDelay}
                    onChange={(value) => {
                      if (Number.isFinite(value)) {
                        void update({ longPressDelay: Math.min(3000, Math.max(500, value)) })
                      }
                    }}
                    minValue={500}
                    maxValue={3000}
                    step={100}
                  >
                    <Label>{t("Long-press delay (ms)")}</Label>
                    <NumberField.Group>
                      <NumberField.DecrementButton />
                      <NumberField.Input />
                      <NumberField.IncrementButton />
                    </NumberField.Group>
                    <Description>{t("How long to hold the left mouse button before translating (default 1000ms)")}</Description>
                  </NumberField>
                )}
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
    void settingsItem.getValue().then(setInitialSettings)
  }, [])

  return initialSettings ? <OptionsContent initialSettings={initialSettings} /> : null
}

export function App() {
  return (
    <I18nProvider>
      <OptionsLoader />
    </I18nProvider>
  )
}