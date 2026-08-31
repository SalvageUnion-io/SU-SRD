/* Ported from packages/component-lib/src/components/sheet/SheetSkeleton.stories.tsx. */
import { SheetSkeleton } from 'component-lib'
import { Caption } from '../preview-lib/harness'

/** The live-sheet loading placeholder, shown while IndexedDB hydrates. */
export function Loading() {
  return (
    <div className="bg-paper p-4">
      <Caption>sheet skeleton</Caption>
      <SheetSkeleton />
    </div>
  )
}
