import type { NanoglossSettings } from "@/utils/storage"
import Check from "@gravity-ui/icons/Check"
import { Button, Card, Chip, ProgressBar, Spinner, Typography } from "@heroui/react"
import type { RefObject } from "react"
import { t } from "@/utils/i18n"
import { getLanguageLabel, resolveLanguageCode } from "@/utils/languages"
import { PackRow, useLanguagePacks } from "../options/language-packs"
import { LanguageSelects } from "../options/language-selects"

/**
 * The languages and the target language's pack, with the same selects and pack states as the
 * settings page: picking a target starts its download, and the row below follows it.
 */
export function LanguagesCard({ ref, settings, onChange }: {
  ref: RefObject<HTMLDivElement | null>
  settings: NanoglossSettings
  onChange: (patch: Partial<NanoglossSettings>) => void
}) {
  const target = resolveLanguageCode(settings.targetLanguage) ?? "en"
  const packs = useLanguagePacks({ targetLanguage: target, selectedSourceLanguage: settings.sourceLanguage })
  const row = packs.rows[target]
  const status = row?.status ?? "checking"
  const size = t("packApproximateSize")

  return (
    <Card ref={ref}>
      <Card.Header>
        <Card.Title className="text-sm font-semibold">{t("welcomeLanguagesTitle")}</Card.Title>
      </Card.Header>
      <Card.Content className="gap-3">
        <LanguageSelects settings={settings} packs={packs} onChange={onChange} stacked />

        {target === "en" ? (
          <Typography.Paragraph size="xs" color="muted">{t("welcomeEnglishTargetNote", size)}</Typography.Paragraph>
        ) : (
          <ul className="flex flex-col">
            {status === "downloading" ? (
              <PackRow code={target} packs={packs} subtitle={t("packDownloadingSubtitle")}>
                <ProgressBar className="w-20" value={row?.percent ?? 0} color="accent" size="sm" aria-label={t("packDownloadingSubtitle")}>
                  <ProgressBar.Track>
                    <ProgressBar.Fill />
                  </ProgressBar.Track>
                  <ProgressBar.Output />
                </ProgressBar>
              </PackRow>
            ) : status === "available" ? (
              <PackRow code={target} packs={packs} subtitle={t("packPairSubtitle", [getLanguageLabel("en"), size])}>
                <Chip size="sm" color="success" variant="soft">
                  <Check width={12} height={12} />
                  <Chip.Label>{t("packStatusReady")}</Chip.Label>
                </Chip>
              </PackRow>
            ) : status === "error" ? (
              <PackRow code={target} packs={packs} subtitle={t("packErrorSubtitle")}>
                <Button size="sm" variant="secondary" onPress={() => void packs.prepare(target)}>{t("packRetryButton")}</Button>
              </PackRow>
            ) : status === "unavailable" ? (
              <PackRow code={target} packs={packs} subtitle={t("welcomePackUnavailableSubtitle")}>{null}</PackRow>
            ) : status === "checking" ? (
              <PackRow code={target} packs={packs} subtitle={t("bubbleChecking")}><Spinner size="sm" /></PackRow>
            ) : (
              <PackRow code={target} packs={packs} subtitle={t("welcomePackNeededSubtitle", size)}>
                <Button size="sm" variant="primary" onPress={() => void packs.prepare(target)}>{t("bubbleActionDownload")}</Button>
              </PackRow>
            )}
          </ul>
        )}

        {status === "error" && row?.message && (
          <Typography.Paragraph size="xs" className="motion-enter text-danger">{row.message}</Typography.Paragraph>
        )}

        <Typography.Paragraph size="xs" color="muted">{t("welcomePackScopeNote")}</Typography.Paragraph>
        <div role="status" className="sr-only">{packs.announcement}</div>
      </Card.Content>
    </Card>
  )
}
