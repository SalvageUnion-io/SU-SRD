import type { CSSProperties } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { space } from '../../design/tokens'
import type { Story } from '../../stories/_harness'
import { Caption } from '../../stories/_harness'
import { resolveEntityPageMeta } from '../referenceEntity/card/entityPage'
import { ChapterFoot } from './ChapterFoot'

export default {
  title: 'Atoms/Chapter Foot',
}

// Real SRD content — reference data is preloaded by catalog.tsx.
const gopher = SalvageUnionReference.Chassis.getByName('Gopher')
const coreMechanic = SalvageUnionReference.RollTables.getByName('Core Mechanic')
const bioTitan = SalvageUnionReference.BioTitans.all()[0]

const STACK = { display: 'flex', flexDirection: 'column', gap: space[24] } satisfies CSSProperties

function citation(entity: Parameters<typeof resolveEntityPageMeta>[0] | undefined) {
  const meta = entity ? resolveEntityPageMeta(entity) : undefined
  return {
    start: meta?.page != null ? `p.${meta.page}` : undefined,
    end: meta?.citation,
  }
}

/**
 * The band across the foot of a Workshop Manual page: the chapter's colour and
 * ink speckle again, under an ink rule, carrying the citation — the page
 * number large at its start, the book (and any reprint) at its end. An SRD
 * entity page closes on it (board 07); the site footer is the Contents
 * chapter's (board 06). Real citations, from `resolveEntityPageMeta`.
 */
export const Default: Story = () => (
  <div style={STACK}>
    <div>
      <Caption>mech — an entity page's citation (Gopher)</Caption>
      <ChapterFoot tone="mech" measure="75rem" {...citation(gopher)} />
    </div>
    <div>
      <Caption>rules — a roll table's (Core Mechanic)</Caption>
      <ChapterFoot tone="rules" measure="85rem" {...citation(coreMechanic)} />
    </div>
    <div>
      <Caption>denizen — the navy band carries paper text</Caption>
      <ChapterFoot tone="denizen" measure="75rem" {...citation(bioTitan)} />
    </div>
  </div>
)
