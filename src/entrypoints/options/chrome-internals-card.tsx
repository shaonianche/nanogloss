import { browser } from "#imports"
import ArrowUpRightFromSquare from "@gravity-ui/icons/ArrowUpRightFromSquare"
import { Button, Card, Typography } from "@heroui/react"
import { t } from "@/utils/i18n"

interface ToolRowProps {
  title: string
  url: string
  description: string
  buttonText: string
  onOpen: () => void
}

function ToolRow({ title, url, description, buttonText, onOpen }: ToolRowProps) {
  return (
    <div className="flex flex-col gap-3 border-b border-separator px-2 py-3.5 first:pt-2 last:border-b-0 last:pb-2 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1 sm:max-w-md">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-foreground">{title}</span>
          <Typography.Code className="text-xs text-muted">{url}</Typography.Code>
        </div>
        <Typography.Paragraph size="xs" color="muted">
          {description}
        </Typography.Paragraph>
      </div>

      <Button
        size="sm"
        variant="secondary"
        className="shrink-0 self-start sm:self-center"
        onPress={onOpen}
      >
        <ArrowUpRightFromSquare width={14} height={14} />
        {buttonText}
      </Button>
    </div>
  )
}

export function ChromeInternalsCard({ className = "" }: { className?: string }) {
  function openExternalTab(url: string) {
    if (browser.tabs?.create) {
      void browser.tabs.create({ url })
    } else {
      window.open(url, "_blank", "noopener,noreferrer")
    }
  }

  return (
    <Card className={className}>
      <Card.Header className="gap-1 pb-2">
        <Card.Title className="text-base font-semibold tracking-tight">
          {t("chromeInternalsTitle")}
        </Card.Title>
        <Card.Description>
          {t("chromeInternalsDescription")}
        </Card.Description>
      </Card.Header>

      <Card.Content className="gap-3 pt-1">
        <ToolRow
          title={t("chromeComponentsTitle")}
          url="chrome://components/"
          description={t("chromeComponentsDescription")}
          buttonText={t("chromeComponentsButton")}
          onOpen={() => openExternalTab("chrome://components/")}
        />

        <ToolRow
          title={t("chromeTranslationInternalsTitle")}
          url="chrome://on-device-translation-internals/"
          description={t("chromeTranslationInternalsDescription")}
          buttonText={t("chromeTranslationInternalsButton")}
          onOpen={() => openExternalTab("chrome://on-device-translation-internals/")}
        />
      </Card.Content>
    </Card>
  )
}
