import { Description, Label, ListBox, Select } from "@heroui/react"
import { t } from "@/utils/i18n"
import { getLanguageLabel, resolveLanguageCode, SUPPORTED_LANGUAGE_CODES } from "@/utils/languages"
import type { NanoglossSettings } from "@/utils/storage"
import type { LanguagePacksState } from "./language-packs"

interface LanguageSelectsProps {
  settings: NanoglossSettings
  packs: LanguagePacksState
  onChange: (patch: Partial<NanoglossSettings>) => void
  /** One select per row, for a narrow column. */
  stacked?: boolean
}

/**
 * The source and target language selects, shared by the Language Packs tab and the welcome page.
 * Picking a target starts its language pack download: the pick is the click Chrome asks for.
 */
export function LanguageSelects({ settings, packs, onChange, stacked = false }: LanguageSelectsProps) {
  // The target and source selects offer the same language list.
  const languageItems = SUPPORTED_LANGUAGE_CODES.map((code) => {
    const label = getLanguageLabel(code)
    return (
      <ListBox.Item key={code} id={code} textValue={label}>
        <Label>{label}</Label>
      </ListBox.Item>
    )
  })

  return (
    <div className="rounded-xl bg-default/40 p-4">
      <div className={`grid grid-cols-1 gap-4 ${stacked ? "" : "sm:grid-cols-2"}`}>
        <Select
          className="w-full"
          value={settings.sourceLanguage}
          onChange={(key) => {
            if (key != null) {
              onChange({ sourceLanguage: String(key) })
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
              onChange({ targetLanguage: next })

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
  )
}
