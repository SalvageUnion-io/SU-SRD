/**
 * OppositionPicker — how the Mediator fields the Opposition and handles one
 * NPC (play.md §10), opened from `PlayMediatorOpposition`'s + Add and an
 * NPC's box. Hidden from players: the Opposition is the one thing ADR-030 §5
 * keeps from the crew, and `mediator.npcs` serves it to the Mediator alone.
 *
 * The picker searches the Opposition's schemas; a new instance starts at full
 * HP and takes a numbered name when it duplicates one, or the name typed under
 * Draw from (cleared once used), so the table can tell its opposition apart.
 * An entity with patterns (a chassis, a Bio-Titan) asks which one beneath the
 * list before it is added. Delete asks first and is never done for you
 * (ADR-007); Rename gives an NPC a name of the Mediator's own.
 *
 * Presentational: `usePlayMediator` reads the Opposition and makes the writes.
 */

import type { CSSProperties } from 'react'
import { useId, useState } from 'react'
import type { RefEntity, RefObjectAnyPattern } from 'salvageunion-reference'
import { findEntityBySlug } from 'salvageunion-reference'
import { resolveChassisRef } from 'salvageunion-reference/rules'
import {
  Button,
  ConfirmDialog,
  EntitySearcher,
  Eyebrow,
  Input,
  Select,
  Stack,
  tokens,
} from '../../components/index'
import { mediatorCopy } from '../../messages/play-mediator'
import type { RosterLine } from './encounterRoster.model'
import type { EncounterRefSchema, SavedPattern, TrayDraw, TrayNpc } from './opposition.model'
import { OPPOSITION_SCHEMAS, patternSlugOf, patternsOf, slugOf } from './opposition.model'

const { space } = tokens

/** What the Mediator's screen can ask of the Opposition. */
export type TrayWrites = {
  add: (schema: EncounterRefSchema, entity: RefEntity, draw?: TrayDraw) => Promise<unknown>
  setHp: (npc: TrayNpc, next: number) => Promise<unknown>
  morale: (npc: TrayNpc) => Promise<unknown>
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
  rename: (npc: TrayNpc, name: string) => Promise<unknown>
  /** Field an encounter row's roster (p.270): every line it names, how many it says. */
  field: (lines: readonly RosterLine[]) => Promise<number>
}

const PATTERN_ACTIONS = {
  display: 'flex',
  gap: space[6],
  marginTop: space[4],
} satisfies CSSProperties

/** Why Rename refuses a blank name; the server would refuse it too. */
const EMPTY_NAME = 'A name cannot be blank.'

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

/**
 * The picker, inside the shared floating picker modal: `SheetPickerModal`
 * hands it its `title` and `onClose`, and it passes them to the searcher,
 * which owns the frame. Which schema it searches is chosen beneath the list.
 */
export function OppositionPicker({
  npcs,
  saved,
  onAdd,
  title,
  onClose,
}: {
  npcs: readonly TrayNpc[]
  saved: readonly SavedPattern[]
  onAdd: (schema: EncounterRefSchema, entity: RefEntity, draw: TrayDraw) => void
  title?: string
  onClose?: () => void
}) {
  const id = useId()
  const [schema, setSchema] = useState<EncounterRefSchema>('npcs')
  // An entity with patterns waits here while its pattern is chosen.
  const [pending, setPending] = useState<{ entity: RefEntity; pattern: string } | null>(null)
  // The Mediator's own name for the next one added, cleared once used.
  const [name, setName] = useState('')
  const add = (entity: RefEntity, draw: TrayDraw = {}) => {
    onAdd(schema, entity, { ...draw, ...(name.trim() === '' ? {} : { name }) })
    setName('')
  }
  // The Opposition's own counts, so a card says how many are already out.
  const selected = npcs
    .filter((n) => n.refSchema === schema && n.refSlug)
    .map((n) => n.refSlug ?? '')
  const pendingPatterns = pending ? patternsOf(pending.entity) : []
  const pendingSaved = pending ? savedFor(schema, pending.entity, saved) : []
  const addPending = () => {
    if (pending === null) return
    const pattern = pendingPatterns.find((p) => bookValue(p) === pending.pattern)
    const own = pendingSaved.find((p) => savedValue(p) === pending.pattern)
    add(pending.entity, pattern ? { pattern } : own ? { saved: own } : {})
    setPending(null)
  }
  return (
    <EntitySearcher
      key={schema}
      schema={schema}
      mode="count"
      selected={selected}
      idOf={slugOf}
      onAdd={(slug) => {
        const entity = findEntityBySlug(schema, slug)
        if (entity === null) return
        const [book] = patternsOf(entity)
        const [own] = savedFor(schema, entity, saved)
        if (book) setPending({ entity, pattern: bookValue(book) })
        else if (own) setPending({ entity, pattern: savedValue(own) })
        else add(entity)
      }}
      chosenLabel={mediatorCopy('onTheField')}
      title={title}
      onClose={onClose}
      railActions={
        <Stack gap={6}>
          <Eyebrow as="label" tone="muted" htmlFor={`${id}-schema`}>
            {mediatorCopy('drawFrom')}
          </Eyebrow>
          <Select
            id={`${id}-schema`}
            value={schema}
            onChange={(e) => {
              setPending(null)
              setSchema(e.target.value as EncounterRefSchema)
            }}
          >
            {OPPOSITION_SCHEMAS.map((s) => (
              <option key={s.schema} value={s.schema}>
                {s.label}
              </option>
            ))}
          </Select>
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
          {pending ? (
            <>
              <Eyebrow as="label" tone="muted" htmlFor={`${id}-pattern`}>
                {mediatorCopy('pattern', { name: pending.entity.name })}
              </Eyebrow>
              <Select
                id={`${id}-pattern`}
                value={pending.pattern}
                onChange={(e) => setPending({ ...pending, pattern: e.target.value })}
              >
                {pendingSaved.length > 0 ? (
                  <optgroup label={mediatorCopy('savedPatterns')}>
                    {pendingSaved.map((p) => (
                      <option key={p.id} value={savedValue(p)}>
                        {p.name} · {p.madeBy}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
                {pendingPatterns.length > 0 ? (
                  <optgroup label={mediatorCopy('fromTheBook')}>
                    {pendingPatterns.map((p) => (
                      <option key={p.name} value={bookValue(p)}>
                        {p.name}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
                <option value={NO_PATTERN}>{mediatorCopy('noPattern')}</option>
              </Select>
              <div style={PATTERN_ACTIONS}>
                <Button variant="primary" size="compact" onClick={addPending}>
                  {mediatorCopy('addToTheField')}
                </Button>
                <Button variant="ghost" size="compact" onClick={() => setPending(null)}>
                  {mediatorCopy('cancel')}
                </Button>
              </div>
            </>
          ) : null}
        </Stack>
      }
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
        title={`Delete ${removing?.name ?? 'this NPC'}?`}
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
      title={`Rename ${npc?.name ?? 'this NPC'}`}
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
          : 'That did not work. Try again.'
      }
    />
  )
}
