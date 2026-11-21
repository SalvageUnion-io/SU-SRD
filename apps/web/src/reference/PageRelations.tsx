// A Page's cross-references back (EDL E26, `lib/pageRelations.ts`): one
// Ledger a list (ledger.md L9, a Page's list), full width under the body, its
// rows' names the links. A list of one kind wears that kind's band; a mixed
// one ink, with a Kind column (L9).
import type { CSSProperties } from 'react'
import type { RefMetaEntity } from 'salvageunion-reference'
import { SalvageUnionReference, toEntityModel } from 'salvageunion-reference'
import { Ledger } from '../components/index'
import { ReferenceSurface } from '../components/ReferenceSurface'
import { space } from '../design/tokens'
import type { Relation } from '../lib/pageRelations'

/** Level-1 blocks on a Page sit 12px apart (ruleset §1.7). */
const STACK = {
  display: 'grid',
  gap: space[12],
  minWidth: 0,
  marginTop: space[12],
} satisfies CSSProperties

/** The band a list wears: its rows' kind's, or ink where they mix. */
function toneOf(relation: Relation): string {
  const kinds = new Set(relation.rows.map((row) => row.ref.schemaName))
  const [first] = relation.rows
  if (kinds.size !== 1 || !first) return 'ink'
  const entity = SalvageUnionReference.get(first.ref.schemaName as never, first.ref.id)
  return entity ? toEntityModel(entity as RefMetaEntity).tone : 'ink'
}

export function PageRelations({ relations }: { relations: readonly Relation[] }) {
  if (relations.length === 0) return null
  return (
    <ReferenceSurface>
      <div style={STACK}>
        {relations.map((relation) => (
          <Ledger
            key={relation.key}
            label={relation.label}
            nameLabel={relation.label}
            tone={toneOf(relation)}
            columns={relation.columns}
            rows={relation.rows.map((row, index) => ({
              id: `${row.ref.id}:${row.ref.pattern ?? ''}:${index}`,
              name: row.name,
              entityRef: row.ref,
              cells: row.cells,
            }))}
          />
        ))}
      </div>
    </ReferenceSurface>
  )
}
