/* Ported from packages/component-lib/src/components/shared/RosterSkeleton.stories.tsx. */
import { RosterSkeleton } from 'component-lib'
import { Caption } from '../preview-lib/harness'

/** The roster loading placeholder, shown while IndexedDB hydrates. */
export function Loading() {
  return (
    <div className="bg-paper p-4">
      <Caption>roster skeleton</Caption>
      <RosterSkeleton />
    </div>
  )
}
