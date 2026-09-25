import { Caption } from 'component-lib/stories/harness'
import { SheetSkeleton } from './SheetSkeleton'

export default {
  title: 'Containers/Sheet Skeleton',
}

/** Live-sheet loading placeholder — shown while IndexedDB hydrates. */
export const Default = () => (
  <div className="bg-paper p-4">
    <Caption>SheetSkeleton</Caption>
    <SheetSkeleton />
  </div>
)
