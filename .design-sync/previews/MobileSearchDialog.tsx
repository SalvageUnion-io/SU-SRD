/*
 * Ported from packages/component-lib/src/components/shared/MobileSearchDialog.stories.tsx.
 *
 * The dialog has no `open` prop — it owns its own state and the sheet mounts
 * only once the trigger is tapped, so the preview clicks the trigger on mount to
 * show the open sheet. Without that the card is a lone magnifier glyph.
 */
import { MobileSearchDialog, SearchField } from 'component-lib'
import { useEffect, useRef } from 'react'

/**
 * The mobile top-nav search trigger and its full-screen sheet. The injected
 * search content mounts only while open — here the shared `SearchField`; the SRD
 * injects its full combobox island instead.
 */
export function OpenSheet() {
  const frameRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    frameRef.current
      ?.querySelector<HTMLButtonElement>('[aria-label="Search the SRD"]')
      ?.click()
  }, [])
  return (
    <div ref={frameRef} className="min-h-[420px]">
      <div className="flex items-center gap-3 rounded bg-ink px-4 py-2">
        <span className="font-cond text-sm font-bold uppercase text-paper">Salvage Union</span>
        <div className="ml-auto">
          <MobileSearchDialog triggerAriaLabel="Search the SRD">
            <div className="[&_input]:w-full">
              <SearchField
                type="search"
                aria-label="Search the SRD"
                placeholder="Search the SRD…"
                glyphSize={16}
                defaultValue="Iron Mongrel"
              />
            </div>
          </MobileSearchDialog>
        </div>
      </div>
    </div>
  )
}

/** The closed trigger, in its bar — how it sits before it is tapped. */
export function Trigger() {
  return (
    <div className="flex items-center gap-3 rounded bg-ink px-4 py-2">
      <span className="font-cond text-sm font-bold uppercase text-paper">Salvage Union</span>
      <div className="ml-auto">
        <MobileSearchDialog triggerAriaLabel="Search the SRD">
          <SearchField type="search" aria-label="Search the SRD" placeholder="Search the SRD…" />
        </MobileSearchDialog>
      </div>
    </div>
  )
}
