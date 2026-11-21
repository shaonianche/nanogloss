import { useEffect, useRef, useState } from "react"
import { settingsItem, type NanoglossSettings } from "./storage"

/**
 * The stored settings as React state, for the extension's pages: follows changes made by other
 * open pages, and `update` writes a patch.
 */
export function useSettings(initialSettings: NanoglossSettings) {
  const [settings, setSettings] = useState(initialSettings)

  // The settings as of the last change, ahead of the render that will show them. Two changes
  // can arrive before React re-renders (a select that also starts a download, two quick
  // clicks); merging each into the rendered `settings` would write the second without the first.
  const latestSettings = useRef(initialSettings)

  useEffect(() => {
    return settingsItem.watch((next) => {
      latestSettings.current = next
      setSettings(next)
    })
  }, [])

  async function update(patch: Partial<NanoglossSettings>) {
    const next = { ...latestSettings.current, ...patch }
    latestSettings.current = next
    setSettings(next)
    await settingsItem.setValue(next)
  }

  return [settings, update] as const
}
