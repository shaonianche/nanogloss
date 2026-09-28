import { browser } from "#imports"
import ArrowUpRightFromSquare from "@gravity-ui/icons/ArrowUpRightFromSquare"
import { Button, Card, Chip, Typography } from "@heroui/react"

interface ToolRowProps {
  title: string
  url: string
  description: string
  buttonText: string
  onOpen: () => void
}

function ToolRow({ title, url, description, buttonText, onOpen }: ToolRowProps) {
  return (
    <div className="flex flex-col gap-3 border-b border-separator/80 py-3.5 first:pt-1 last:border-b-0 last:pb-1 sm:flex-row sm:items-start sm:justify-between">
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
      <Card.Header className="flex flex-col gap-1 pb-2">
        <Card.Title className="text-base font-semibold tracking-tight text-foreground">
          Chrome internal diagnostics
        </Card.Title>
        <Card.Description className="text-sm text-muted leading-relaxed">
          Quick access to Chrome's internal diagnostic and component management tools.
        </Card.Description>
      </Card.Header>

      <Card.Content className="flex flex-col gap-3 pt-1">
        <ToolRow
          title="Optimization Guide Component"
          url="chrome://components/"
          description="Chrome's on-device translation engine requires the Optimization Guide On DeviceModel component. If model downloads stall or fail to initialize, check this page and click 'Check for update' to ensure its status is Up-to-date."
          buttonText="Open components"
          onOpen={() => openExternalTab("chrome://components/")}
        />

        <ToolRow
          title="Translation Internals"
          url="chrome://on-device-translation-internals/"
          description="Chrome's built-in translation dashboard. Inspect active translator instances, downloaded language pack models on disk, and runtime translation errors."
          buttonText="Open internals"
          onOpen={() => openExternalTab("chrome://on-device-translation-internals/")}
        />
      </Card.Content>
    </Card>
  )
}
