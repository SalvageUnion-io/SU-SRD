/**
 * OppositionTab — the encounter tray on the Mediator Dashboard (board M1;
 * docs/architecture/mediator-dashboard.md Q9). Hidden from players: the tray
 * is the one thing ADR-030 §5 keeps from the crew, and `mediator.npcs` serves
 * it to the Mediator alone.
 *
 * Each NPC is its reference card at `size="medium"`, `extent="head"`, carrying
 * the instance's own name; tapping it opens the full reference card in the
 * detail modal (listings never expand in place). Beside it, a compact
 * `VitalGauge` for its HP or SP (ruleset §2.1: a vital is a `VitalGauge`, never a bare
 * stepper) and a **Morale** button: a d20 on the reference Morale
 * table (Workshop Manual p.268), kept on the NPC and shown under its row —
 * never on the Game's log, which the crew reads.
 *
 * At 0 an NPC is shown as down (struck through) and is never removed for you
 * (ADR-007); Remove asks first, and Rename gives a row a name of the
 * Mediator's own. **+ From the reference** opens the picker over
 * the tray schemas; a new instance starts at full HP and takes a numbered
 * name when it duplicates one, or the name typed under Draw from (cleared
 * once used), so the table can tell its opposition apart. An entity with
 * patterns (a chassis, a Bio-Titan) asks which one beneath the list before it
 * is added.
 *
 * Presentational: the Dashboard reads the tray and makes the writes.
 */

import type { CSSProperties } from 'react'
import { useId, useState } from 'react'
import type { RefEntity, RefObjectAnyPattern } from 'salvageunion-reference'
import { findEntityBySlug } from 'salvageunion-reference'
import { resolveChassisRef } from 'salvageunion-reference/rules'
import type { CSSVarStyle } from '../index'
import {
  Button,
  ConfirmDialog,
  EmptyState,
  Entity,
  EntitySearcher,
  Input,
  Select,
  tokens,
  useDetailModal,
  VitalGauge,
} from '../index'
import { SheetPickerModal } from '../sheet/SheetSection'
import { BODY, EYEBROW, HEAD_ROW, MUTED, NUMBERS } from './mediatorStyles.model'
import type { EncounterRefSchema, SavedPattern, TrayDraw, TrayNpc } from './opposition.model'
import { OPPOSITION_SCHEMAS, patternSlugOf, patternsOf, slugOf } from './opposition.model'

const { borderWidth, color, font, fontSize, radius, space, weight } = tokens

/** What a row can ask of the tray. */
export type TrayWrites = {
  add: (schema: EncounterRefSchema, entity: RefEntity, draw?: TrayDraw) => Promise<unknown>
  setHp: (npc: TrayNpc, next: number) => Promise<unknown>
  morale: (npc: TrayNpc) => Promise<unknown>
  remove: (npc: TrayNpc) => Promise<unknown>
  rename: (npc: TrayNpc, name: string) => Promise<unknown>
}

const SCROLL = {
  height: '100%',
  overflowY: 'auto',
  padding: space[12],
  display: 'flex',
  flexDirection: 'column',
  gap: space[12],
} satisfies CSSProperties

const LIST = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: space[10],
} satisfies CSSProperties

/** The gauge's bay: wide enough for six pips a row at a legible size. */
const GAUGE_WIDTH = '8rem'

/** The fieldset that names a gauge, without the browser's frame. */
const GAUGE_GROUP = { border: 0, margin: 0, minWidth: 0, padding: 0 } satisfies CSSProperties

/** The gauge lights in the opposition's own tone, the one its Row's band wears. */
const ADVERSARY_TONE: CSSVarStyle = { '--tone': color.adversary, '--tone-deep': color.adversary }

const ROW = {
  display: 'grid',
  gridTemplateColumns: `minmax(0, 1fr) ${GAUGE_WIDTH} auto`,
  alignItems: 'center',
  gap: space[8],
} satisfies CSSProperties

const DOWN = { textDecoration: 'line-through' } satisfies CSSProperties

const RESULT = { ...BODY, ...NUMBERS, padding: `${space[4]} ${space[2]} 0` } satisfies CSSProperties

const RESULT_HEAD = { fontWeight: weight.bold } satisfies CSSProperties

const ACTIONS = { display: 'flex', alignItems: 'center', gap: space[6] } satisfies CSSProperties

/** A row whose reference no longer resolves: its name, plainly. */
const PLAIN = {
  padding: `${space[10]} ${space[12]}`,
  fontFamily: font.cond,
  fontWeight: weight.bold,
  fontSize: fontSize.readout,
  textTransform: 'uppercase',
  background: color.paper,
  border: `${borderWidth.entityCompact} solid ${color.ink}`,
  borderRadius: radius.card,
} satisfies CSSProperties

const PICKER_RAIL = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[6],
} satisfies CSSProperties

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

function NpcRow({
  npc,
  canWrite,
  writes,
  onFailure,
  onRemove,
  onRename,
}: {
  npc: TrayNpc
  canWrite: boolean
  writes: TrayWrites
  onFailure: (err: unknown) => void
  onRemove: (npc: TrayNpc) => void
  onRename: (npc: TrayNpc) => void
}) {
  const detail = useDetailModal(npc.entity ?? undefined, {
    pattern: npc.pattern ?? undefined,
  })
  const stat = npc.statKind === 'sp' ? 'SP' : 'HP'
  return (
    <li>
      <div style={ROW}>
        <div style={npc.down ? DOWN : undefined}>
          {npc.entity === null ? (
            <div style={PLAIN}>{npc.name}</div>
          ) : (
            // The tray's Row (E1): the instance's name as its title, greyed
            // when down; the whole Row opens the full reference card.
            <Entity
              form="row"
              entity={npc.entity}
              pattern={npc.pattern ?? undefined}
              instance={{ title: npc.name, ...(npc.down ? { condition: 'destroyed' } : {}) }}
              mode={{
                kind: 'link',
                onOpen: () => detail.control.onClick?.(),
                attrs: { 'aria-label': `${npc.name}: the full reference card` },
              }}
            />
          )}
        </div>
        {npc.maxHp > 0 ? (
          // The gauge's slider is named by its stat alone ("HP"); the group
          // names whose it is, as every row has one.
          <fieldset aria-label={`${npc.name} ${stat}`} style={GAUGE_GROUP}>
            <VitalGauge
              size="compact"
              label={stat}
              value={npc.currentHp}
              max={npc.maxHp}
              readOnly={!canWrite}
              onChange={(next) => void writes.setHp(npc, next).catch(onFailure)}
              style={ADVERSARY_TONE}
            />
          </fieldset>
        ) : (
          <span />
        )}
        <div style={ACTIONS}>
          <Button
            variant="primary"
            size="compact"
            disabled={!canWrite}
            aria-label={`Roll Morale for ${npc.name}`}
            onClick={() => void writes.morale(npc).catch(onFailure)}
          >
            Morale
          </Button>
          <Button
            variant="ghost"
            size="compact"
            disabled={!canWrite}
            aria-label={`Rename ${npc.name}`}
            onClick={() => onRename(npc)}
          >
            Rename
          </Button>
          <Button
            variant="ghost"
            size="compact"
            disabled={!canWrite}
            aria-label={`Remove ${npc.name}`}
            onClick={() => onRemove(npc)}
          >
            Remove
          </Button>
        </div>
      </div>
      <p role="status" aria-live="polite" style={RESULT}>
        {npc.down ? <span style={RESULT_HEAD}>Down. </span> : null}
        {npc.lastRoll ? (
          <>
            <span style={RESULT_HEAD}>
              Morale {npc.lastRoll.roll}
              {npc.lastRoll.label ? ` · ${npc.lastRoll.label}` : ''}
            </span>
            {` — ${npc.lastRoll.value}`}
          </>
        ) : null}
      </p>
      {detail.modal}
    </li>
  )
}

/**
 * The picker, inside the shared floating picker modal: `SheetPickerModal`
 * hands it its `title` and `onClose`, and it passes them to the searcher,
 * which owns the frame. Which schema it searches is chosen beneath the list.
 */
function OppositionPicker({
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
  // The tray's own counts, so a card says how many are already out.
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
      chosenLabel="On the field"
      title={title}
      onClose={onClose}
      railActions={
        <div style={PICKER_RAIL}>
          <label htmlFor={`${id}-schema`} style={EYEBROW}>
            Draw from
          </label>
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
          <label htmlFor={`${id}-name`} style={EYEBROW}>
            Name (optional)
          </label>
          <Input
            id={`${id}-name`}
            value={name}
            placeholder="e.g. Red Leader"
            autoComplete="off"
            onChange={(e) => setName(e.target.value)}
          />
          {pending ? (
            <>
              <label htmlFor={`${id}-pattern`} style={EYEBROW}>
                {pending.entity.name} pattern
              </label>
              <Select
                id={`${id}-pattern`}
                value={pending.pattern}
                onChange={(e) => setPending({ ...pending, pattern: e.target.value })}
              >
                {pendingSaved.length > 0 ? (
                  <optgroup label="Saved patterns">
                    {pendingSaved.map((p) => (
                      <option key={p.id} value={savedValue(p)}>
                        {p.name} · {p.madeBy}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
                {pendingPatterns.length > 0 ? (
                  <optgroup label="From the book">
                    {pendingPatterns.map((p) => (
                      <option key={p.name} value={bookValue(p)}>
                        {p.name}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
                <option value={NO_PATTERN}>No pattern</option>
              </Select>
              <div style={PATTERN_ACTIONS}>
                <Button variant="primary" size="compact" onClick={addPending}>
                  Add to the field
                </Button>
                <Button variant="ghost" size="compact" onClick={() => setPending(null)}>
                  Cancel
                </Button>
              </div>
            </>
          ) : null}
        </div>
      }
    />
  )
}

export function OppositionTab({
  npcs,
  savedPatterns = [],
  canWrite,
  writes,
  onFailure,
}: {
  npcs: readonly TrayNpc[] | null
  /** Saved mech patterns the picker may field: the Mediator's, and the crew's shared ones. */
  savedPatterns?: readonly SavedPattern[]
  canWrite: boolean
  writes: TrayWrites
  onFailure: (err: unknown) => void
}) {
  const [picking, setPicking] = useState(false)
  const [removing, setRemoving] = useState<TrayNpc | null>(null)
  const [renaming, setRenaming] = useState<TrayNpc | null>(null)
  const [newName, setNewName] = useState('')
  const renameId = useId()
  const startRename = (npc: TrayNpc) => {
    setNewName(npc.name)
    setRenaming(npc)
  }
  const onField = npcs?.filter((n) => !n.down).length ?? 0

  return (
    <div style={SCROLL}>
      <div style={HEAD_ROW}>
        <h3 style={EYEBROW}>Hidden from players · {onField} on the field</h3>
        <Button variant="default" size="full" disabled={!canWrite} onClick={() => setPicking(true)}>
          + From the reference
        </Button>
      </div>
      {npcs === null ? (
        <p style={MUTED}>The tray is on its way.</p>
      ) : npcs.length === 0 ? (
        <EmptyState
          variant="quiet"
          body="No opposition yet. Add squads, NPCs and creatures from the reference; players never see this tab."
        />
      ) : (
        <ul style={LIST} aria-label="Opposition">
          {npcs.map((npc) => (
            <NpcRow
              key={npc.id}
              npc={npc}
              canWrite={canWrite}
              writes={writes}
              onFailure={onFailure}
              onRemove={setRemoving}
              onRename={startRename}
            />
          ))}
        </ul>
      )}
      <SheetPickerModal
        open={picking}
        onClose={() => setPicking(false)}
        title="Add opposition from the reference"
        floating
      >
        <OppositionPicker
          npcs={npcs ?? []}
          saved={savedPatterns}
          onAdd={(schema, entity, draw) => void writes.add(schema, entity, draw).catch(onFailure)}
        />
      </SheetPickerModal>
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => {
          if (!open) setRemoving(null)
        }}
        tone="danger"
        title={`Remove ${removing?.name ?? 'this NPC'}?`}
        body="It leaves the tray for good, with its HP and its last Morale roll."
        confirmLabel="Remove"
        onConfirm={async () => {
          if (removing !== null) await writes.remove(removing)
        }}
      />
      <ConfirmDialog
        open={renaming !== null}
        onOpenChange={(open) => {
          if (!open) setRenaming(null)
        }}
        title={`Rename ${renaming?.name ?? 'this NPC'}`}
        body={
          <>
            <label htmlFor={renameId} style={EYEBROW}>
              Name
            </label>
            <Input
              id={renameId}
              value={newName}
              autoComplete="off"
              onChange={(e) => setNewName(e.target.value)}
            />
          </>
        }
        confirmLabel="Rename"
        onConfirm={async () => {
          if (newName.trim() === '') throw new Error(EMPTY_NAME)
          if (renaming !== null) await writes.rename(renaming, newName.trim())
        }}
        describeError={(err) =>
          err instanceof Error && err.message === EMPTY_NAME
            ? EMPTY_NAME
            : 'That did not work. Try again.'
        }
      />
    </div>
  )
}
