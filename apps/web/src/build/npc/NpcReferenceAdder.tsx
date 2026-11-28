/**
 * The NPC designer's search that adds an action or a trait from the reference
 * (npc-builder.md §4.1, D6): the rules text stays the book's. A search that
 * finds nothing says so, and each action says where in the book it comes
 * from, so two of one name are told apart (r5 B11).
 */

import type { CSSProperties } from 'react'
import { useMemo, useState } from 'react'
import { displayTitle, isSchemaName, SalvageUnionReference } from 'salvageunion-reference'
import { Button, SearchField, tokens } from '../../components/index'
import { npcActionSlug } from '../../lib/npcs/npcModel'
import { readReference } from '../../lib/readReference'
import { npcCopy } from '../../messages/build-npc'
import { COLUMN, LIST } from './npcStyles.model'

/** A match: the outlined `Button` (R16), the row's width, its kind at the far end. */
const RESULT_BUTTON = { justifyContent: 'space-between', width: '100%' } satisfies CSSProperties

/** The quiet line a search with no match reads. */
const NONE = { color: tokens.color.ink75, margin: 0 } satisfies CSSProperties

/**
 * Where an action is printed: the entry that carries it ("Combat Pilot",
 * "Gully Crusher Squad"), else the kind of entry it belongs to.
 */
function actionOrigin(action: { name: string; actionSource?: string }): string | null {
  const schema = action.actionSource
  if (schema === undefined || !isSchemaName(schema)) return null
  const owner = readReference(
    'ReferenceAdder.origin',
    () =>
      SalvageUnionReference.findIn(schema, (entity) => {
        const actions = (entity as { actions?: unknown }).actions
        return Array.isArray(actions) && actions.includes(action.name)
      }),
    undefined
  )
  const name = (owner as { name?: unknown } | undefined)?.name
  return typeof name === 'string' ? name : null
}

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
      .map((a) => ({ kind: 'Action' as const, name: a.name, from: actionOrigin(a) }))
    const traits = readReference(
      'ReferenceAdder.traits',
      () => SalvageUnionReference.Traits.all(),
      []
    )
      .filter((t) => t.name.toLowerCase().includes(q))
      .map((t) => ({ kind: 'Trait' as const, name: t.name, from: null }))
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
      {q.length >= 2 && matches.length === 0 && (
        <p role="status" style={NONE}>
          {npcCopy('noActionsMatch')}
        </p>
      )}
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
                  <span>{m.from === null ? m.kind : `${m.kind} · ${m.from}`}</span>
                </Button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
