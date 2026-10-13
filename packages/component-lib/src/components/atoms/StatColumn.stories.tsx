import type { CSSProperties } from 'react'
import type { SURefMetaEntity } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { space } from '../../design/tokens'
import type { Story } from '../../stories/_harness'
import { Caption } from '../../stories/_harness'
import { resolveEntityPageMeta } from '../referenceEntity/card/entityPage'
import { StatColumn } from './StatColumn'

export default {
  title: 'Atoms/Stat Column',
}

// Real SRD entities — reference data is preloaded by catalog.tsx.
const gopher = SalvageUnionReference.Chassis.getByName('Gopher')
const crawlerTechLevel = SalvageUnionReference.CrawlerTechLevels.all()[2]
const system = SalvageUnionReference.Systems.getByName('Salvaging Drill')

const STACK = { display: 'flex', flexDirection: 'column', gap: space[24] } satisfies CSSProperties
const COLUMN = { maxWidth: '36rem' } satisfies CSSProperties

function Column({ entity, name }: { entity: SURefMetaEntity | undefined; name: string }) {
  if (!entity) return null
  const { stats } = resolveEntityPageMeta(entity)
  return (
    <div style={COLUMN}>
      <StatColumn stats={stats} label={`${name} stats`} />
    </div>
  )
}

/**
 * The book's stat column at page scale: a framed numeral beside an ink stamp
 * in the manual's own words — `14 | STRUCTURE PTS.` — two to a row, in the
 * book's order (board 07). It replaced the entity page's header cells, whose
 * labels clipped on a phone. Real stats, through `resolveEntityPageMeta`
 * (the entity model's `bookStats`), as the SRD page feeds them.
 */
export const Default: Story = () => (
  <div style={STACK}>
    <div>
      <Caption>a chassis (Gopher) — the book's eight, in its order</Caption>
      <Column entity={gopher} name="Gopher" />
    </div>
    <div>
      <Caption>a crawler tech level — upkeep and upgrade cost</Caption>
      <Column entity={crawlerTechLevel} name="Crawler tech level" />
    </div>
    <div>
      <Caption>a system — slots required, tech level, salvage value</Caption>
      <Column entity={system} name="Salvaging Drill" />
    </div>
  </div>
)
