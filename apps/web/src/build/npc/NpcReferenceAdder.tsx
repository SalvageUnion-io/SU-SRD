/**
 * The NPC designer's search that adds an action or a trait from the reference
 * (npc-builder.md §4.1, D6): the rules text stays the book's.
 */

import type { CSSProperties } from 'react'
import { useMemo, useState } from 'react'
import { displayTitle, SalvageUnionReference } from 'salvageunion-reference'
import { Button, SearchField } from '../../components/index'
import { npcActionSlug } from '../../lib/npcs/npcModel'
import { readReference } from '../../lib/readReference'
import { npcCopy } from '../../messages/build-npc'
import { COLUMN, LIST } from './npcStyles.model'

/** A match: the outlined `Button` (R16), the row's width, its kind at the far end. */
const RESULT_BUTTON = { justifyContent: 'space-between', width: '100%' } satisfies CSSProperties

/** The search that adds an action or a trait from the reference (D6). */
export function ReferenceAdder({
  carriedActions,
  carriedTraits,
  onAction,
  onTrait,
}: {
  carriedActions: readonly string[]
  carriedTraits: readonly string[]
  onAction: (slug: string) => void
  onTrait: (type: string) => void
}) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const matches = useMemo(() => {
    if (q.length < 2) return []
    const actions = readReference(
      'ReferenceAdder.actions',
      () => SalvageUnionReference.Actions.all(),
      []
    )
      .filter((a) => a.name.toLowerCase().includes(q))
      .map((a) => ({ kind: 'Action' as const, name: a.name }))
    const traits = readReference(
      'ReferenceAdder.traits',
      () => SalvageUnionReference.Traits.all(),
      []
    )
      .filter((t) => t.name.toLowerCase().includes(q))
      .map((t) => ({ kind: 'Trait' as const, name: t.name }))
    return [...traits, ...actions].slice(0, 8)
  }, [q])

  return (
    <div style={COLUMN}>
      <SearchField
        aria-label={npcCopy('addAnActionOrTrait')}
        placeholder={npcCopy('addAnActionOrTrait')}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {matches.length > 0 && (
        <ul style={LIST} aria-label={npcCopy('matches')}>
          {matches.map((m) => {
            const slug = m.kind === 'Action' ? npcActionSlug(m.name) : m.name
            const has =
              m.kind === 'Action' ? carriedActions.includes(slug) : carriedTraits.includes(m.name)
            return (
              <li key={`${m.kind}:${m.name}`}>
                <Button
                  variant="default"
                  style={RESULT_BUTTON}
                  disabled={has}
                  onClick={() => {
                    if (m.kind === 'Action') onAction(slug)
                    else onTrait(m.name)
                    setQuery('')
                  }}
                >
                  <span>
                    {has
                      ? npcCopy('alreadyListed', { displayTitle: displayTitle(m.name) })
                      : npcCopy('add', { displayTitle: displayTitle(m.name) })}
                  </span>
                  <span>{m.kind}</span>
                </Button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
