import type { BrowserSupport } from "@/utils/browser-support"
import Check from "@gravity-ui/icons/Check"
import CircleFill from "@gravity-ui/icons/CircleFill"
import { Alert, Card, Chip, Typography } from "@heroui/react"
import { MINIMUM_CHROMIUM_VERSION } from "@/utils/browser-support"
import { useI18n } from "./i18n"

const REQUIREMENTS = `NanoGloss runs entirely on Chrome's built-in translator, so it needs desktop Chrome ${MINIMUM_CHROMIUM_VERSION} or newer. Edge, Firefox and Safari do not expose that API.`

type CheckStatus = "ok" | "missing" | "optional"

const CHIP_COLOR: Record<CheckStatus, "success" | "danger" | "warning"> = {
  ok: "success",
  missing: "danger",
  optional: "warning",
}

const CHIP_LABEL: Record<CheckStatus, string> = {
  ok: "Yes",
  missing: "No",
  optional: "Optional",
}

function CheckRow({ label, value, status, translateValue = true }: { label: string, value: string, status: CheckStatus, translateValue?: boolean }) {
  const { t } = useI18n()
  return (
    <li className="flex items-center justify-between gap-3 border-b border-separator/80 py-3 last:border-b-0">
      <span className="text-sm font-medium text-foreground">{t(label)}</span>
      <span className="flex items-center gap-2.5">
        <span className="text-xs text-muted">{translateValue ? t(value) : value}</span>
        {status === "ok" ? (
          <Chip size="sm" variant="secondary" className="text-xs text-muted font-normal">
            <Check width={12} height={12} className="text-foreground/70" />
            <Chip.Label>{t("Yes")}</Chip.Label>
          </Chip>
        ) : (
          <Chip size="sm" color={CHIP_COLOR[status]} variant="soft">
            <CircleFill width={6} height={6} />
            <Chip.Label>{t(CHIP_LABEL[status])}</Chip.Label>
          </Chip>
        )}
      </span>
    </li>
  )
}

/**
 * Shows what the current browser can do. The translator API is the hard requirement; the
 * language detector is a convenience (only `auto` needs it), so it reads as optional
 * instead of as a failure.
 */
export function BrowserSupportCard({ support, className = "mt-6" }: { support: BrowserSupport, className?: string }) {
  const { t } = useI18n()
  const versionMeetsMinimum = support.chromiumVersion === null
    ? support.translator
    : support.chromiumVersion >= MINIMUM_CHROMIUM_VERSION

  return (
    <Card className={className}>
      <Card.Header className="flex flex-col gap-1 pb-2">
        <Card.Title className="text-base font-semibold tracking-tight text-foreground">
          {t("Browser support")}
        </Card.Title>
        <Card.Description className="text-sm text-muted leading-relaxed">
          {t(REQUIREMENTS)}
        </Card.Description>
      </Card.Header>

      <Card.Content className="flex flex-col gap-4 pt-1">
        {!support.supported && (
          <Alert status="danger">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>{t("This browser cannot translate")}</Alert.Title>
              <Alert.Description>
                {t(`The built-in Translator API is missing, so NanoGloss has no engine to run. Open this page in desktop Chrome ${MINIMUM_CHROMIUM_VERSION} or newer.`)}
              </Alert.Description>
            </Alert.Content>
          </Alert>
        )}

        <ul className="flex flex-col">
          <CheckRow
            label="Built-in translator"
            value={support.translator ? "available" : "missing"}
            status={support.translator ? "ok" : "missing"}
          />
          <CheckRow
            label="Language detector"
            value={support.languageDetector ? "available" : "missing — pick a source language instead"}
            status={support.languageDetector ? "ok" : "optional"}
          />
          <CheckRow
            label="Browser version"
            value={support.chromiumVersion === null ? "unknown" : `Chromium ${support.chromiumVersion}`}
            translateValue={support.chromiumVersion === null}
            status={versionMeetsMinimum ? "ok" : "missing"}
          />
          <CheckRow
            label="Desktop"
            value={support.desktop ? "yes" : "no"}
            status={support.desktop ? "ok" : "missing"}
          />
        </ul>

        <div className="border-t border-separator/60 pt-3">
          <Typography.Paragraph size="sm" color="muted" className="text-xs text-muted leading-relaxed">
            {t("The language detector is only used when the source language is “Auto” and the page does not declare one. A fixed source language works without it.")}
          </Typography.Paragraph>
        </div>
      </Card.Content>
    </Card>
  )
}