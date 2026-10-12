import '../../styles/sheet.css'
import { tokens } from 'component-lib'
import { Caption } from 'component-lib/stories/harness'
import { SheetSkeleton } from './SheetSkeleton'

export default {
  title: 'Containers/Sheet Skeleton',
}

/** Live-sheet loading placeholder — shown while the account's rows arrive. */
export const Default = () => (
  <div style={{ backgroundColor: tokens.color.paper, padding: tokens.space[16] }}>
    <Caption>SheetSkeleton</Caption>
    <SheetSkeleton />
  </div>
)
