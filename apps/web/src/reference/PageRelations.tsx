// A Page's cross-references back (EDL E26, `lib/pageRelations.ts`): one
// Ledger a list (ledger.md L9, a Page's list), full width under the body, its
// rows' names the links. The tables an entry is rolled on are a short list
// of links in its side column instead (`sideLinksOf`, `lib/pageRelations.ts`). A list of one kind wears that kind's band; a mixed
// one ink, with a Kind column (L9).
import type { CSSProperties } from 'react'
import { Ledger } from '../components/index'
import { ReferenceSurface } from '../components/ReferenceSurface'
import { space } from '../design/tokens'
import type { Relation } from '../lib/pageRelations'
import { relationTone } from '../lib/pageRelations'

/** The key of a Page's Related rules list (`relationsFor`). */
const RELATED_RULES = 'guides'

/** Level-1 blocks on a Page sit 12px apart (ruleset §1.7). */
const STACK = {
  display: 'grid',
  gap: space[12],
  minWidth: 0,
  marginTop: space[12],
} satisfies CSSProperties

export function PageRelations({ relations }: { relations: readonly Relation[] }) {
  if (relations.length === 0) return null
  return (
    <ReferenceSurface>
      <div style={STACK}>
        {relations.map((relation) => {
          const list = (
            <Ledger
              key={relation.key}
              label={relation.label}
              nameLabel={relation.label}
              tone={relationTone(relation)}
              columns={relation.columns}
              rows={relation.rows.map((row, index) => ({
                id: `${row.ref.id}:${row.ref.pattern ?? ''}:${index}`,
                name: row.name,
                entityRef: row.ref,
                cells: row.cells,
              }))}
            />
          )
          // Related rules are the screen's way on: paper prints the entry (RR6-08).
          return relation.key === RELATED_RULES ? (
            <div key={relation.key} data-print="hide">
              {list}
            </div>
          ) : (
            list
          )
        })}
      </div>
    </ReferenceSurface>
  )
}
