import { browser } from "#imports"
import ArrowUpRightFromSquare from "@gravity-ui/icons/ArrowUpRightFromSquare"
import Gear from "@gravity-ui/icons/Gear"
import { Button, Card } from "@heroui/react"
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
    <div className="flex flex-col gap-3 border-b border-separator/60 py-3.5 px-2 rounded-xl transition-colors hover:bg-default/40 first:pt-2 last:border-b-0 last:pb-2 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1 sm:max-w-md">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-foreground">{title}</span>
          <code className="rounded-md bg-default px-2 py-0.5 font-mono text-xs text-muted border border-separator/50">
            {url}
          </code>
        </div>
        <p className="text-xs text-muted leading-relaxed">
          {description}
        </p>
      </div>

      <Button
        size="sm"
        variant="secondary"
        className="shrink-0 self-start sm:self-center gap-1.5 text-foreground"
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
      <Card.Header className="flex flex-col gap-1 pb-2">
        <div className="flex items-center gap-2.5">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-default border border-separator/60 text-muted">
            <Gear width={15} height={15} />
          </div>
          <Card.Title className="text-base font-semibold tracking-tight text-foreground">
            {t("chromeInternalsTitle")}
          </Card.Title>
        </div>
        <Card.Description className="text-sm text-muted leading-relaxed">
          {t("chromeInternalsDescription")}
        </Card.Description>
      </Card.Header>

      <Card.Content className="flex flex-col gap-3 pt-1">
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
