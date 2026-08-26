/*
 * Composed from the SheetActionsMenu cluster in
 * packages/component-lib/src/components/sheet/NpcInset.stories.tsx, where it is
 * demonstrated alongside the inset rather than in a file of its own.
 *
 * The menu is closed until its ⋯ trigger is pressed, so the preview clicks the
 * trigger on mount — a card showing a lone ⋯ would document nothing.
 */
import { Button, SheetActionsMenu } from 'component-lib'
import { useEffect, useRef } from 'react'
import { Caption } from '../preview-lib/harness'

/** The sheet's ⋯ overflow, open — typically the same items the sheet shows inline. */
export function Open() {
  const frameRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const trigger = frameRef.current?.querySelector<HTMLButtonElement>('button')
    trigger?.click()
  }, [])
  return (
    <div ref={frameRef} className="sheet--mech min-h-[320px] bg-paper p-4">
      <Caption>the sheet overflow menu</Caption>
      <SheetActionsMenu>
        <Button surface="paper">Export</Button>
        <Button surface="paper">Duplicate</Button>
        <Button surface="paper">Publish snapshot</Button>
      </SheetActionsMenu>
    </div>
  )
}

/** The closed trigger, as it sits in a sheet header. */
export function Trigger() {
  return (
    <div className="sheet--mech bg-paper p-4">
      <Caption>closed</Caption>
      <SheetActionsMenu>
        <Button surface="paper">Export</Button>
        <Button surface="paper">Duplicate</Button>
      </SheetActionsMenu>
    </div>
  )
}
