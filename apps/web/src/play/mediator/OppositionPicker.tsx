/**
 * OppositionPicker — how the Mediator fields the Opposition and handles one
 * NPC (play.md §10), opened from `PlayMediatorOpposition`'s + Add and an
 * NPC's box. Hidden from players: the Opposition is the one thing ADR-030 §5
 * keeps from the crew, and `mediator.npcs` serves it to the Mediator alone.
 *
 * The picker searches the Opposition's kinds (tabs above one search that
 * carries across them) and the Mediator's own designed NPCs under Yours; a
 * new instance starts at full HP and takes a numbered name when it duplicates
 * one, or the name typed in the rail (cleared once used), so the table can
 * tell its opposition apart. The preview is the entity's Reference card,
 * weapons included. An entity with patterns (a chassis, a Bio-Titan)
 * offers them beside its Add: one step. Delete asks first and is never done for you
 * (ADR-007); Rename gives an NPC a name of the Mediator's own.
 *
 * Presentational: `usePlayMediator` reads the Opposition and makes the writes.
 */

import type { RosterLine } from 'game-domain/rules/encounterRoster'
import type { Npc } from 'game-domain/schemas/npc'
import type { ComponentProps, CSSProperties } from 'react'
import { useId, useMemo, useState } from 'react'
import type { RefEntity, RefObjectAnyPattern } from 'salvageunion-reference'
import { findEntityBySlug, searchIn } from 'salvageunion-reference'
import { resolveChassisRef } from 'salvageunion-reference/rules'
import { ConfirmDialog } from '../../components/app'
import {
  EntitySearcher,
  Eyebrow,
  Input,
  Segmented,
  SegmentedOption,
  Select,
  Stack,
  tokens,
} from '../../components/index'
import { npcAsReferenceEntity } from '../../lib/npcs/npcModel'
import { mediatorCopy } from '../../messages/play-mediator'
import type { EncounterRefSchema, SavedPattern, TrayDraw, TrayNpc } from './opposition.model'
import {
  OPPOSITION_SCHEMAS,
  patternLabel,
  patternSlugOf,
  patternsOf,
  slugOf,
} from './opposition.model'

const { space } = tokens

/** What the Mediator's screen can ask of the Opposition. */
export type TrayWrites = {
  add: (schema: EncounterRefSchema, entity: RefEntity, draw?: TrayDraw) => Promise<unknown>
  /** Field one of the Mediator's own designed NPCs, as a snapshot (ADR-067 §1). */
  addBuilt: (npc: Npc, name: string) => Promise<unknown>
  setHp: (npc: TrayNpc, next: number) => Promise<unknown>
  /** Keep a downed Mech's Mech Salvage roll with its wreck (r5 B1). */
  salvageRoll: (npc: TrayNpc, roll: number) => Promise<unknown>
  morale: (npc: TrayNpc) => Promise<unknown>
  /** One Reaction or Morale roll for a whole group, kept on each member standing (p.267-268). */
  groupRoll: (group: { id: string; name: string }, table: 'reaction' | 'morale') => Promise<unknown>
  /** Mark it important or not (Workshop Manual p.255). */
  setImportant: (npc: TrayNpc, important: boolean) => Promise<unknown>
  /** An important mech's EP or Heat. */
  setReactor: (
    npc: TrayNpc,
    patch: { currentEp?: number; currentHeat?: number }
  ) => Promise<unknown>
  /** An important NPC's Critical roll at 0. */
  critical: (npc: TrayNpc) => Promise<unknown>
  /** An important mech's Heat Check. */
  heatCheck: (npc: TrayNpc) => Promise<unknown>
  remove: (npc: TrayNpc) => Promise<unknown>
  /** Clear the field: every NPC leaves the tray at once. */
  clear: () => Promise<unknown>
  rename: (npc: TrayNpc, name: string) => Promise<unknown>
  /** Field an encounter row's roster (p.270): every line it names, how many it says. */
  field: (lines: readonly RosterLine[]) => Promise<number>
}

/** Why Rename refuses a blank name; the server would refuse it too. */
const EMPTY_NAME = mediatorCopy('nameCannotBeBlank')

/** The bare entity, in the pattern Select: no pattern picked. */
const NO_PATTERN = ''

/** A pattern Select value: a book pattern by slug, a saved one by id. */
const bookValue = (pattern: RefObjectAnyPattern) => `book:${patternSlugOf(pattern)}`
const savedValue = (pattern: SavedPattern) => `saved:${pattern.id}`

/** The saved patterns built on this chassis; none for anything else. */
function savedFor(
  schema: EncounterRefSchema,
  entity: RefEntity,
  saved: readonly SavedPattern[]
): SavedPattern[] {
  if (schema !== 'chassis') return []
  return saved.filter((p) => resolveChassisRef(p.chassisRef)?.id === entity.id)
}

/** An entity as the searcher takes one of the caller's own. */
type PoolEntity = NonNullable<ComponentProps<typeof EntitySearcher>['entities']>[number]

/** The picker's kinds: the Opposition's schemas, then the Mediator's own designed NPCs. */
type Kind = EncounterRefSchema | typeof YOURS
const YOURS = 'yours'

const yoursId = (item: { id?: string }) => item.id ?? ''

const LEAD = {
  padding: `${space[12]} ${space[16]} 0`,
} satisfies CSSProperties

const PATTERN = { flex: '0 1 16rem', minWidth: 0 } satisfies CSSProperties

/** The focused Page keeps its actions, which a picker hides by default. */
const SHOW_ACTIONS = { actions: false } as const

/** How many of a kind's entries the query finds; null with nothing typed. */
function matches(kind: Kind, query: string, yours: readonly { name: string }[]): number | null {
  const q = query.trim()
  if (q === '') return null
  if (kind === YOURS) {
    return yours.filter((n) => n.name.toLowerCase().includes(q.toLowerCase())).length
  }
  return searchIn(kind, q).length
}

/**
 * The picker, inside the shared floating picker modal: `SheetPickerModal`
 * hands it its `title` and `onClose`, and it passes them to the searcher,
 * which owns the frame. The kinds sit above the search, which carries across
 * them: each kind says how many it finds. A mech's pattern is chosen beside
 * its Add, in one step. "On the field" lists everything out, of every kind.
 */
export function OppositionPicker({
  npcs,
  saved,
  yours = [],
  onAdd,
  onAddBuilt,
  title,
  onClose,
}: {
  npcs: readonly TrayNpc[]
  saved: readonly SavedPattern[]
  /** The Mediator's own designed NPCs, offered under Yours. */
  yours?: readonly Npc[]
  onAdd: (schema: EncounterRefSchema, entity: RefEntity, draw: TrayDraw) => void
  onAddBuilt?: (npc: Npc, name: string) => void
  title?: string
  onClose?: () => void
}) {
  const id = useId()
  const [kind, setKind] = useState<Kind>('npcs')
  const [query, setQuery] = useState('')
  // The pattern picked for an entity, by its slug; unset, its first one.
  const [patterns, setPatterns] = useState<Record<string, string>>({})
  // The Mediator's own name for the next one added, cleared once used.
  const [name, setName] = useState('')
  const ownEntities = useMemo(
    () => yours.map((npc) => npcAsReferenceEntity(npc) as PoolEntity),
    [yours]
  )
  const railEntities = useMemo(
    () => npcs.flatMap((n) => (n.entity === null ? [] : [n.entity as PoolEntity])),
    [npcs]
  )
  const kinds: { kind: Kind; label: string }[] = [
    ...OPPOSITION_SCHEMAS.map((s) => ({ kind: s.schema as Kind, label: s.label })),
    ...(onAddBuilt ? [{ kind: YOURS as Kind, label: mediatorCopy('yours') }] : []),
  ]
  const lead = (
    <div style={LEAD}>
      <Segmented label={mediatorCopy('drawFrom')} size="compact" wrap>
        {kinds.map((k) => {
          const found = matches(k.kind, query, yours)
          return (
            <SegmentedOption key={k.kind} pressed={k.kind === kind} onClick={() => setKind(k.kind)}>
              {found === null ? k.label : `${k.label} ${found}`}
            </SegmentedOption>
          )
        })}
      </Segmented>
    </div>
  )
  const nameField = (
    <Stack gap={6}>
      <Eyebrow as="label" tone="muted" htmlFor={`${id}-name`}>
        {mediatorCopy('nameOptional')}
      </Eyebrow>
      <Input
        id={`${id}-name`}
        value={name}
        placeholder={mediatorCopy('eGRedLeader')}
        autoComplete="off"
        onChange={(e) => setName(e.target.value)}
      />
    </Stack>
  )
  const shared = {
    mode: 'count' as const,
    chosenLabel: mediatorCopy('onTheField'),
    title,
    onClose,
    lead,
    initialQuery: query,
    onQueryChange: setQuery,
    railEntities,
    railActions: nameField,
    emptyMessage: mediatorCopy('nothingOfThisKind'),
    // What it can do is what it is picked by (r4 D4): its Page lists its
    // weapons, as its Reference page does.
    hide: SHOW_ACTIONS,
  }

  if (kind === YOURS) {
    return (
      <EntitySearcher
        key={kind}
        {...shared}
        schema="npcs"
        entities={ownEntities}
        userMade
        selected={npcs.flatMap((n) => (n.builtFrom === null ? [] : [n.builtFrom]))}
        idOf={yoursId}
        emptyMessage={
          yours.length === 0 ? mediatorCopy('noNpcsOfYourOwn') : mediatorCopy('nothingOfThisKind')
        }
        onAdd={(npcId) => {
          const npc = yours.find((n) => n.id === npcId)
          if (npc === undefined) return
          onAddBuilt?.(npc, name)
          setName('')
        }}
      />
    )
  }

  const schema = kind
  /** The pattern Select's value for an entity: the one picked, else its first. */
  const patternOf = (entity: RefEntity): string => {
    const picked = patterns[slugOf(entity as { name: string })]
    if (picked !== undefined) return picked
    const [book] = patternsOf(entity)
    const [own] = savedFor(schema, entity, saved)
    return book ? bookValue(book) : own ? savedValue(own) : NO_PATTERN
  }
  return (
    <EntitySearcher
      key={kind}
      {...shared}
      schema={schema}
      selected={npcs
        .filter((n) => n.refSchema === schema && n.refSlug && n.builtFrom === null)
        .map((n) => n.refSlug ?? '')}
      idOf={slugOf}
      onAdd={(slug) => {
        const entity = findEntityBySlug(schema, slug)
        if (entity === null) return
        const value = patternOf(entity)
        const pattern = patternsOf(entity).find((p) => bookValue(p) === value)
        const own = savedFor(schema, entity, saved).find((p) => savedValue(p) === value)
        onAdd(schema, entity, {
          ...(pattern ? { pattern } : own ? { saved: own } : {}),
          ...(name.trim() === '' ? {} : { name }),
        })
        setName('')
      }}
      focusExtra={(item) => {
        const entity = findEntityBySlug(schema, slugOf(item))
        if (entity === null) return null
        const book = patternsOf(entity)
        const own = savedFor(schema, entity, saved)
        if (book.length === 0 && own.length === 0) return null
        // A chassis's pattern is listed as it will stand on the field (r4 D5).
        const listed = (pattern: string) =>
          schema === 'chassis' ? patternLabel(item.name, pattern) : pattern
        return (
          <Select
            aria-label={mediatorCopy('pattern', { name: item.name })}
            style={PATTERN}
            value={patternOf(entity)}
            onChange={(e) => setPatterns({ ...patterns, [slugOf(item)]: e.target.value })}
          >
            {own.length > 0 ? (
              <optgroup label={mediatorCopy('savedPatterns')}>
                {own.map((p) => (
                  <option key={p.id} value={savedValue(p)}>
                    {listed(p.name)} · {p.madeBy}
                  </option>
                ))}
              </optgroup>
            ) : null}
            {book.length > 0 ? (
              <optgroup label={mediatorCopy('fromTheBook')}>
                {book.map((p) => (
                  <option key={p.name} value={bookValue(p)}>
                    {listed(p.name)}
                  </option>
                ))}
              </optgroup>
            ) : null}
            <option value={NO_PATTERN}>{mediatorCopy('noPattern')}</option>
          </Select>
        )
      }}
    />
  )
}

/**
 * Delete (asks first: the NPC leaves the Opposition for good, ADR-007) and Rename
 * (a name of the Mediator's own, never blank) for one NPC, asked from its box.
 */
export function OppositionDialogs({
  removing,
  renaming,
  onClose,
  writes,
}: {
  /** The NPC Delete asks about, or null. */
  removing: TrayNpc | null
  /** The NPC being renamed, or null. */
  renaming: TrayNpc | null
  onClose: () => void
  writes: Pick<TrayWrites, 'remove' | 'rename'>
}) {
  return (
    <>
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => {
          if (!open) onClose()
        }}
        tone="danger"
        title={mediatorCopy('deleteNpcTitle', { name: removing?.name ?? mediatorCopy('thisNpc') })}
        body={mediatorCopy('itLeavesTheOppositionFor')}
        confirmLabel={mediatorCopy('delete')}
        onConfirm={async () => {
          if (removing !== null) await writes.remove(removing)
        }}
      />
      <RenameDialog key={renaming?.id ?? ''} npc={renaming} onClose={onClose} writes={writes} />
    </>
  )
}

/** Rename, starting from the NPC's own name (keyed by the NPC, so it starts afresh). */
function RenameDialog({
  npc,
  onClose,
  writes,
}: {
  npc: TrayNpc | null
  onClose: () => void
  writes: Pick<TrayWrites, 'rename'>
}) {
  const renameId = useId()
  const [newName, setNewName] = useState(npc?.name ?? '')
  return (
    <ConfirmDialog
      open={npc !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={mediatorCopy('renameNpcTitle', { name: npc?.name ?? mediatorCopy('thisNpc') })}
      body={
        <>
          <Eyebrow as="label" tone="muted" htmlFor={renameId}>
            {mediatorCopy('name')}
          </Eyebrow>
          <Input
            id={renameId}
            value={newName}
            autoComplete="off"
            onChange={(e) => setNewName(e.target.value)}
          />
        </>
      }
      confirmLabel={mediatorCopy('rename')}
      onConfirm={async () => {
        if (newName.trim() === '') throw new Error(EMPTY_NAME)
        if (npc !== null) await writes.rename(npc, newName.trim())
      }}
      describeError={(err) =>
        err instanceof Error && err.message === EMPTY_NAME
          ? EMPTY_NAME
          : mediatorCopy('thatDidNotWork')
      }
    />
  )
}
