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
 * (ADR-007); Remove asks first. **+ From the reference** opens the picker over
 * the six tray schemas; a new instance starts at full HP and takes a numbered
 * name when it duplicates one.
 *
 * Presentational: the Dashboard reads the tray and makes the writes.
 */

import type { CSSProperties } from 'react'
import { useId, useState } from 'react'
import type { RefEntity } from 'salvageunion-reference'
import { findEntityBySlug } from 'salvageunion-reference'
import type { CSSVarStyle } from '../../../ui/index'
import {
  Button,
  ConfirmDialog,
  EmptyState,
  Entity,
  EntitySearcher,
  Select,
  tokens,
  useDetailModal,
  VitalGauge,
} from '../../../ui/index'
import { SheetPickerModal } from '../sheet/SheetSection'
import { BODY, EYEBROW, HEAD_ROW, MUTED, NUMBERS } from './mediatorStyles.model'
import type { EncounterRefSchema, TrayNpc } from './opposition.model'
import { OPPOSITION_SCHEMAS, slugOf } from './opposition.model'

const { borderWidth, color, font, fontSize, radius, space, weight } = tokens

/** What a row can ask of the tray. */
export type TrayWrites = {
  add: (schema: EncounterRefSchema, entity: RefEntity) => Promise<unknown>
  setHp: (npc: TrayNpc, next: number) => Promise<unknown>
  morale: (npc: TrayNpc) => Promise<unknown>
  remove: (npc: TrayNpc) => Promise<unknown>
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

function NpcRow({
  npc,
  canWrite,
  writes,
  onFailure,
  onRemove,
}: {
  npc: TrayNpc
  canWrite: boolean
  writes: TrayWrites
  onFailure: (err: unknown) => void
  onRemove: (npc: TrayNpc) => void
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
            size="mini"
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
  onAdd,
  title,
  onClose,
}: {
  npcs: readonly TrayNpc[]
  onAdd: (schema: EncounterRefSchema, entity: RefEntity) => void
  title?: string
  onClose?: () => void
}) {
  const id = useId()
  const [schema, setSchema] = useState<EncounterRefSchema>('npcs')
  // The tray's own counts, so a card says how many are already out.
  const selected = npcs
    .filter((n) => n.refSchema === schema && n.refSlug)
    .map((n) => n.refSlug ?? '')
  return (
    <EntitySearcher
      key={schema}
      schema={schema}
      mode="count"
      selected={selected}
      idOf={slugOf}
      onAdd={(slug) => {
        const entity = findEntityBySlug(schema, slug)
        if (entity !== null) onAdd(schema, entity)
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
            onChange={(e) => setSchema(e.target.value as EncounterRefSchema)}
          >
            {OPPOSITION_SCHEMAS.map((s) => (
              <option key={s.schema} value={s.schema}>
                {s.label}
              </option>
            ))}
          </Select>
        </div>
      }
    />
  )
}

export function OppositionTab({
  npcs,
  canWrite,
  writes,
  onFailure,
}: {
  npcs: readonly TrayNpc[] | null
  canWrite: boolean
  writes: TrayWrites
  onFailure: (err: unknown) => void
}) {
  const [picking, setPicking] = useState(false)
  const [removing, setRemoving] = useState<TrayNpc | null>(null)
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
          onAdd={(schema, entity) => void writes.add(schema, entity).catch(onFailure)}
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
    </div>
  )
}
