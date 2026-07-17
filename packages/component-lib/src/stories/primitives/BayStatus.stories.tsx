import type { Story } from '@ladle/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { BayStatus } from '../../components/stat/BayStatus'
import type { EntityStatus } from '../../components/shared/entityStatus'
import { Caption } from '../_harness'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Atoms/Bay Status',
}

// Real crawler bays supply the count; a repeating pattern exercises every state.
const PATTERN: EntityStatus[] = ['intact', 'intact', 'damaged', 'destroyed', 'intact', 'damaged']
const bays = SalvageUnionReference.CrawlerBays.all()
const fullFleet: EntityStatus[] =
  bays.length > 0 ? bays.map((_, i) => PATTERN[i % PATTERN.length] ?? 'intact') : PATTERN

/** The crawler-bay condition tally — header + counts-per-state legend + a
 *  per-bay swatch grid (fill-shape encodes the state). */
export const Default: Story = () => (
  <div className="flex flex-col gap-5">
    <div className="flex flex-col gap-1.5">
      <Caption>a full crawler's bays — mixed conditions</Caption>
      <BayStatus states={fullFleet} />
    </div>
    <div className="flex flex-wrap items-start gap-6">
      <div className="flex flex-col gap-1.5">
        <Caption>all intact</Caption>
        <BayStatus states={['intact', 'intact', 'intact', 'intact']} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Caption>a single damaged bay</Caption>
        <BayStatus states={['damaged']} />
      </div>
    </div>
  </div>
)
