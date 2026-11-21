import type { BrowserSupport } from "@/utils/browser-support"
import Check from "@gravity-ui/icons/Check"
import CircleFill from "@gravity-ui/icons/CircleFill"
import Pulse from "@gravity-ui/icons/Pulse"
import { Alert, Card, Chip, Typography } from "@heroui/react"
import { MINIMUM_CHROMIUM_VERSION } from "@/utils/browser-support"
import { t, type MessageKey } from "@/utils/i18n"

type CheckStatus = "ok" | "missing" | "optional"

const CHIP_COLOR: Record<CheckStatus, "success" | "danger" | "warning"> = {
  ok: "success",
  missing: "danger",
  optional: "warning",
}

const CHIP_LABEL_KEY: Record<CheckStatus, MessageKey> = {
  ok: "checkStatusSupported",
  missing: "checkStatusMissing",
  optional: "checkStatusOptional",
}

function CheckRow({ label, value, status }: { label: string, value: string, status: CheckStatus }) {
  return (
    <li className="flex items-center justify-between gap-3 border-b border-separator px-2 py-3 last:border-b-0">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <span className="flex items-center gap-2.5">
        <span className="text-xs text-muted">{value}</span>
        <Chip size="sm" color={CHIP_COLOR[status]} variant="soft">
          {status === "ok" ? (
            <Check width={12} height={12} />
          ) : (
            <CircleFill width={6} height={6} />
          )}
          <Chip.Label>{t(CHIP_LABEL_KEY[status])}</Chip.Label>
        </Chip>
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
  const versionMeetsMinimum = support.chromiumVersion === null
    ? support.translator
    : support.chromiumVersion >= MINIMUM_CHROMIUM_VERSION

  return (
    <Card className={className}>
      <Card.Header className="gap-1 pb-2">
        <div className="flex items-center gap-2.5">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-separator bg-default text-muted">
            <Pulse width={15} height={15} />
          </div>
          <Card.Title className="text-base font-semibold tracking-tight">
            {t("browserSupportTitle")}
          </Card.Title>
        </div>
        <Card.Description>
          {t("browserSupportRequirements", String(MINIMUM_CHROMIUM_VERSION))}
        </Card.Description>
      </Card.Header>

      <Card.Content className="gap-4 pt-1">
        {support.supported ? (
          <Alert status="success">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>{t("browserSupportReady")}</Alert.Title>
            </Alert.Content>
          </Alert>
        ) : (
          <Alert status="danger">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>{t("browserSupportUnsupportedTitle")}</Alert.Title>
              <Alert.Description>
                {t("browserSupportUnsupportedDescription", String(MINIMUM_CHROMIUM_VERSION))}
              </Alert.Description>
            </Alert.Content>
          </Alert>
        )}

        <ul className="flex flex-col">
          <CheckRow
            label={t("checkBuiltInTranslatorLabel")}
            value={support.translator ? t("checkValueAvailable") : t("checkValueMissing")}
            status={support.translator ? "ok" : "missing"}
          />
          <CheckRow
            label={t("checkLanguageDetectorLabel")}
            value={support.languageDetector ? t("checkValueAvailable") : t("checkValueDetectorMissing")}
            status={support.languageDetector ? "ok" : "optional"}
          />
          <CheckRow
            label={t("checkBrowserVersionLabel")}
            value={support.chromiumVersion === null ? t("checkValueUnknown") : t("checkValueChromiumVersion", String(support.chromiumVersion))}
            status={versionMeetsMinimum ? "ok" : "missing"}
          />
          <CheckRow
            label={t("checkDesktopLabel")}
            value={support.desktop ? t("checkValueYes") : t("checkValueNo")}
            status={support.desktop ? "ok" : "missing"}
          />
        </ul>

        <div className="border-t border-separator pt-3">
          <Typography.Paragraph size="xs" color="muted">
            {t("browserSupportFootnote")}
          </Typography.Paragraph>
        </div>
      </Card.Content>
    </Card>
  )
}