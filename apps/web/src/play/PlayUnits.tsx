import { pilotLabel } from 'game-domain/pilotLabel'
import { crawlerUpkeepCost } from 'salvageunion-reference/rules'
import type { UnitsStore } from '../replica/units'
/**
 * The Units column's unit boxes (play.md §4): the pilot,
 * the mech and the crawler, each one `TitledBox` in its tone, and the mechs
 * left in the hangar as Minis. Exported one by one so the Mediator's screen
 * (play.md §10) draws the same boxes with its own `live` flag.
 *
 * - **Live** — − / + on every vital (`PlayVital`), each press one write
 *   through `entityStore.update`, the patch the sheet writes for the same
 *   vital (`currentHP`, `currentSP`, …), its refusal told by `runWrite`.
 * - **Reference** — the dashed frame, every vital a read-out, and at most one
 *   control, the one that makes the unit live: Board, for a mech.
 *
 * A box's actions (Sheet, Board) are chips on its band, after its stamp
 * (chips-and-actions C8), never a button in a row of its body.
 *
 * ## Nesting (play.md §12)
 *
 * Each box is level 1, directly in the column. What it holds is level 2 and
 * plain: gauges, `Stat` chips (class, TP, injuries, bays, upkeep), a line of
 * text. A hangar mech is a full-width Mini on its own line, never a box.
 *
 * The dashed frame is the box's own (`reference`); the boxes' rows are
 * `.su-play-unit__*`, in `styles/play/units.css`, which `PlayFrame` loads.
 */

import { mechHasCondition } from 'game-domain/rules/crewStatus'
import type { Crawler } from 'game-domain/schemas/crawler'
import type { Mech } from 'game-domain/schemas/mech'
import type { Pilot } from 'game-domain/schemas/pilot'
import type { RangeBand } from 'game-domain/schemas/seat'
import { RANGE_BANDS } from 'game-domain/schemas/seat'
import type { CSSProperties, ReactNode } from 'react'
import { SalvageUnionReference, toEntityModel } from 'salvageunion-reference'
import { resolveInstalledRef } from 'salvageunion-reference/rules'
import { heatDangerFrom } from '../components/app'
import type { TagItem } from '../components/index'
import {
  Badge,
  Button,
  Chips,
  Entity,
  Mention,
  relation,
  Segmented,
  SegmentedOption,
  Slab,
  Stat,
  Text,
  TitledBox,
  tokens,
} from '../components/index'
import { changeUndoToast } from '../lib/changeUndoToast'
import { resolveClassName } from '../lib/classRef'
import type { ActivatableEffect } from '../lib/rules/activatableEffects'
import { activatableEffects } from '../lib/rules/activatableEffects'
import { runWrite } from '../lib/runWrite'
import { unitRowModel } from '../lib/units/unitModel'
import { playCopy } from '../messages/play'
import { PLAY_TXN, PLAY_UNDO } from '../replica/provenance'
import type { EntityForType } from '../replica/types'
import { useUnits } from '../replica/units'
import { ApplyInjury, ReactorStates } from './PlayUnitStates'
import { PlayVital } from './PlayVital'
import { hullGauge, injuryLines, mechStats, pilotVitals } from './unitStats.model'
import type { MechRestore } from './units.model'
import { bayChips } from './units.model'
import { headedVital, vitalNow, vitalSettled } from './vitalWrites.model'
import type { DownResult } from './zeroVital.model'
import { askPlayTable, useDownResult, zeroUnit, zeroVitalNotice } from './zeroVital.model'

/** The store a box writes through; the app's own unless a test hands one in. */
type UnitStore = UnitsStore

/** A row of level-2 chips under the vitals, wrapping as a whole. */
const CHIPS = {
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  gap: tokens.space[6],
  minWidth: 0,
} satisfies CSSProperties

const RANGE_LABEL = {
  color: 'var(--color-wk-muted)', // design-tokens-ignore(muted-note): the range label
  fontSize: tokens.fontSize.body,
} satisfies CSSProperties

/** Range's book codes, as the band switch shows them (`Close` → C). */
const RANGE_CODE: Record<RangeBand, string> = { Close: 'C', Medium: 'M', Long: 'L', Far: 'F' }

/** The stamp on a box's band: LIVE, BOARDED, PARKED, … */
function stamp(text: string) {
  return (
    <Badge shape="stamp" size="mini">
      {text}
    </Badge>
  )
}

/**
 * A box's relation chips (chips-and-actions C11): what the unit is built
 * on or linked to, label first (`CHASSIS | Scrapper`), drawn by `Chips` in
 * the relation lane, never a loose stamp.
 */
function Relations({ items }: { items: readonly TagItem[] }) {
  return (
    <Chips
      chips={{ durations: [], facts: [], tags: [], relations: [...items] }}
      size="mini"
      linkable
    />
  )
}

/**
 * One fire-and-forget vital write, as the sheet sends it: `vital(field, shown,
 * max, label)` is a gauge's `onChange`, each press a step from where the
 * vital is heading (`vitalWrites.model`), so quick presses all apply.
 *
 * The change says itself with Undo, as the phone's pinned strip does
 * ("HP 10 → 8 · Undo", `changeUndoToast`; r2 C6), on the vital's one line
 * (`PlayCockpit`'s key), with the amount entry's note when it was capped.
 */
function writer<K extends 'pilot' | 'mech' | 'crawler'>(store: UnitStore, kind: K, id: string) {
  const write = (field: string, value: number, meta = PLAY_TXN) =>
    store.getState().update(kind, id, { [field]: value } as Partial<EntityForType<K>>, meta)
  return (field: keyof EntityForType<K> & string, shown: number, max: number, label: string) =>
    (next: number, note?: string) => {
      const key = `${id}:${field}`
      // Undo takes back this change alone (r3 B2).
      const from = vitalNow(key, shown)
      const to = headedVital(key, shown, next, max)
      runWrite(() => write(field, to).finally(() => vitalSettled(key)))
      changeUndoToast({
        id: `${kind}:${id}:${field}`,
        label,
        from,
        to,
        ...(note === undefined ? {} : { did: note }),
        undo: (value) => {
          runWrite(() => write(field, value, PLAY_UNDO))
          zeroVitalNotice(zeroUnit(store.getState(), kind, id), field, to, value)
        },
      })
      // At 0 SP or 0 HP: what is due, on the Feed and with its table's button (r4 A5).
      zeroVitalNotice(zeroUnit(store.getState(), kind, id), field, from, to)
    }
}

/** "Sheet", putting the unit’s sheet on the screen (`useOpenSheet`), a chip on the box’s band: Mini, the band's Size (ruleset §4.7). */
function SheetButton({ name, onOpen }: { name: string; onOpen: () => void }) {
  return (
    <Button
      variant="ghost"
      size="mini"
      aria-label={playCopy('openSSheet', { name })}
      onClick={onOpen}
    >
      {playCopy('sheet')}
    </Button>
  )
}

export type PlayPilotUnitProps = {
  pilot: Pilot
  /** The pilot's crawler: its Tech Level raises max HP and AP (Stat Training). */
  crawler: Crawler | null
  /** − / + on HP and AP; else a read-out (another's pilot, offline). */
  live: boolean
  /** "Sheet": opens the pilot's sheet over Play. */
  onOpenSheet?: () => void
  store?: UnitStore
}

/** The pilot's box: HP and AP, class, TP and injuries; LIVE whenever it may be written. */
export function PlayPilotUnit({
  pilot,
  crawler,
  live,
  onOpenSheet,
  store = useUnits,
}: PlayPilotUnitProps) {
  const [hp, ap] = pilotVitals(pilot, crawler).gauges
  const vital = writer(store, 'pilot', pilot.id)
  const injuries = injuryLines(pilot)
  // At 0 HP the pilot is Down (r5 A1), with its Critical Injury roll's result once rolled.
  const down = hp?.value === 0
  const result = useDownResult(down ? pilot.id : null)
  return (
    <TitledBox
      as="section"
      title={pilotLabel(pilot)}
      label={playCopy('pilot', { name: pilotLabel(pilot) })}
      tone="pilot"
      className="su-play-unit"
      reference={!live}
      chips={<Stat label={playCopy('pilot2')} size="mini" />}
      controls={
        <>
          {stamp(live ? playCopy('live') : playCopy('readOnlyWords'))}
          {onOpenSheet ? <SheetButton name={pilotLabel(pilot)} onOpen={onOpenSheet} /> : null}
        </>
      }
    >
      {hp ? (
        <PlayVital
          label={playCopy('hp')}
          value={hp.value}
          max={hp.max}
          tone="pilot"
          onChange={live ? vital('currentHP', hp.value, hp.max, playCopy('hp')) : undefined}
        />
      ) : null}
      {ap ? (
        <PlayVital
          label={playCopy('ap2')}
          value={ap.value}
          max={ap.max}
          tone="pilot"
          onChange={live ? vital('currentAP', ap.value, ap.max, playCopy('ap2')) : undefined}
        />
      ) : null}
      <div style={CHIPS}>
        {down ? <Stat label={playCopy('down')} size="mini" state="critical" /> : null}
        {pilot.classRef ? <Stat label={resolveClassName(pilot.classRef)} size="mini" /> : null}
        <Stat label={playCopy('tp')} value={pilot.trainingPoints ?? 0} size="mini" />
        {injuries.length === 0 ? (
          <Stat label={playCopy('noInjuries')} size="mini" />
        ) : (
          injuries.map((line) => <Stat key={line} label={line} size="mini" state="critical" />)
        )}
      </div>
      {result === null ? null : <DownResultLine result={result} />}
      {live ? <ApplyInjury pilot={pilot} maxHp={hp?.max ?? 0} store={store} /> : null}
    </TitledBox>
  )
}

/** Where the mech is, as its box's stamp says it. */
export type MechPlace = 'boarded' | 'parked' | 'downtime'

const MECH_STAMP: Record<MechPlace, string> = {
  boarded: playCopy('boarded'),
  parked: playCopy('parked'),
  downtime: playCopy('mechBay'),
}

export type PlayMechUnitProps = {
  mech: Mech
  /** The pilot in it or assigned to it: Beefcake raises its Max SP (ADR-029). */
  pilotAbilities?: string[]
  /** The seat's switched-on effects (ADR-029 §4). */
  activeEffects?: readonly string[]
  /**
   * Switch an activated effect on or off (`seats.toggleEffect`). Shown while
   * Boarded; omitted, the effects read but cannot be changed.
   */
  onToggleEffect?: (ref: string) => void
  place: MechPlace
  /** − / + on SP, EP and Heat, and the range band; only while Boarded. */
  live: boolean
  /** The seat's range band, shown and set while Boarded. */
  range?: RangeBand
  onRange?: (band: RangeBand) => void
  /** In Downtime: what the current step will set each vital to. */
  restore?: MechRestore
  /** Reference only: the one control that makes the mech live; null when it cannot be boarded. */
  onBoard?: (() => void) | null
  /** "Sheet": opens the mech's sheet over Play. */
  onOpenSheet?: () => void
  store?: UnitStore
}

/**
 * The mech's box: SP, EP and Heat (its redline as danger segments), and while
 * Boarded the range band (`seats.setRange`). Parked it is for reference, with
 * Board; in Downtime it is in the Mech Bay and says what the step restores.
 */
export function PlayMechUnit({
  mech,
  pilotAbilities,
  activeEffects = [],
  onToggleEffect,
  place,
  live,
  range,
  onRange,
  restore = {},
  onBoard,
  onOpenSheet,
  store = useUnits,
}: PlayMechUnitProps) {
  const s = mechStats(mech, pilotAbilities, activeEffects)
  const vital = writer(store, 'mech', mech.id)
  // What it is built on (C11): the chassis, label first, Peeking and opening it.
  const chassis = s.chassis
    ? relation('chassis', 'Chassis', s.chassis.name, { ref: toEntityModel(s.chassis).ref })
    : null
  const showHeat = place !== 'parked'
  // At 0 SP the mech is Down (r5 A1), with its Critical Damage roll's result once rolled.
  const destroyed = mechHasCondition(mech, 'Destroyed')
  const down = !destroyed && s.sp === 0
  const result = useDownResult(down ? mech.id : null)
  // What the mech and its pilot can switch on (ADR-029 §4): the table keeps
  // time, so an effect stays on until the player ends it.
  const effects = place === 'boarded' ? activatableEffects(mech, pilotAbilities) : []
  return (
    <TitledBox
      as="section"
      title={mech.name}
      label={playCopy('mech', { name: mech.name })}
      tone="mech"
      className="su-play-unit"
      reference={!live}
      chips={chassis ? <Relations items={[chassis]} /> : undefined}
      controls={
        <>
          {stamp(destroyed ? 'Destroyed' : down ? playCopy('down') : MECH_STAMP[place])}
          {(place === 'boarded' || place === 'downtime') && onOpenSheet ? (
            <SheetButton name={mech.name} onOpen={onOpenSheet} />
          ) : null}
          {place === 'parked' && onBoard !== undefined ? (
            <Button
              variant="primary"
              size="mini"
              aria-label={playCopy('board2', { name: mech.name })}
              disabled={onBoard === null}
              onClick={onBoard ?? undefined}
            >
              {playCopy('board')}
            </Button>
          ) : null}
        </>
      }
    >
      <PlayVital
        label={playCopy('sp')}
        value={s.sp}
        max={s.maxSP}
        tone="mech"
        restoresTo={restore.sp}
        onChange={live ? vital('currentSP', s.sp, s.maxSP, playCopy('sp')) : undefined}
      />
      <PlayVital
        label={playCopy('ep2')}
        value={s.ep}
        max={s.maxEP}
        tone="mech"
        restoresTo={restore.ep}
        onChange={live ? vital('currentEP', s.ep, s.maxEP, playCopy('ep2')) : undefined}
      />
      {showHeat ? (
        <PlayVital
          label={playCopy('heat')}
          value={s.heat}
          max={s.maxHeat}
          tone="mech"
          danger={s.maxHeat > 0 ? heatDangerFrom(s.maxHeat) : undefined}
          restoresTo={restore.heat}
          onChange={live ? vital('currentHeat', s.heat, s.maxHeat, playCopy('heat')) : undefined}
        />
      ) : null}
      <ReactorStates mech={mech} live={live} store={store} />
      {effects.length > 0 ? (
        <>
          <Slab as="h4" label={playCopy('effects')} />
          <Segmented label={playCopy('effectsOf', { name: mech.name })} size="compact" wrap>
            {effects.map((e) => {
              const on = activeEffects.includes(e.ref)
              return (
                <SegmentedOption
                  key={e.ref}
                  pressed={on}
                  disabled={!live || onToggleEffect === undefined}
                  title={
                    on ? playCopy('isOnPressToEnd', { name: e.name }) : `${e.name}: ${e.summary}`
                  }
                  onClick={() => onToggleEffect?.(e.ref)}
                >
                  {e.name}
                </SegmentedOption>
              )
            })}
          </Segmented>
          {effects.map((e) => (
            <EffectLine key={e.ref} effect={e} />
          ))}
        </>
      ) : null}
      {place === 'boarded' && range ? (
        <div style={CHIPS}>
          <span style={RANGE_LABEL}>{playCopy('range')}</span>
          <Segmented label={playCopy('range')} size="compact">
            {RANGE_BANDS.map((band) => (
              <SegmentedOption
                key={band}
                pressed={range === band}
                aria-label={band}
                disabled={!live || onRange === undefined}
                onClick={() => onRange?.(band)}
              >
                {RANGE_CODE[band]}
              </SegmentedOption>
            ))}
          </Segmented>
        </div>
      ) : null}
      {result === null ? null : <DownResultLine result={result} />}
      {place === 'parked' ? <Text variant="note">{playCopy('readOnlyUntilBoarded')}</Text> : null}
    </TitledBox>
  )
}

/** A Down unit's Critical result, named once: a press opens its row (r6 A4). */
function DownResultLine({ result }: { result: DownResult }) {
  return (
    <Text variant="note">
      <Button variant="ghost" size="compact" onClick={() => askPlayTable(result.table)}>
        {result.text}
      </Button>
    </Text>
  )
}

/**
 * What an Effect does, under its toggle (r6 A11): its name Peeking the full
 * text, what turning it on changes, its cost, and the rule's line.
 */
function EffectLine({ effect }: { effect: ActivatableEffect }) {
  const record =
    effect.source === 'ability'
      ? SalvageUnionReference.Abilities.getBySlug(effect.ref)
      : resolveInstalledRef(effect.ref)
  const entityRef = record ? toEntityModel(record as never).ref : undefined
  const facts = [effect.summary, effect.cost].filter((f) => f !== null).join(' · ')
  return (
    <Text variant="note">
      <Mention entityRef={entityRef}>{effect.name}</Mention>
      {`: ${facts}.`}
      {effect.rule === null ? null : ` ${effect.rule}`}
    </Text>
  )
}

export type PlayCrawlerUnitProps = {
  crawler: Crawler
  /** − / + on SP: solo Downtime, or always for the Mediator. */
  live: boolean
  /** Downtime is running: the box carries the Downtime stamp and the Upkeep due. */
  downtime: boolean
  /** "Sheet": opens the crawler's sheet over Play. */
  onOpenSheet?: () => void
  store?: UnitStore
}

/**
 * The crawler's box: SP, its Tech Level, and every bay as a chip, damaged
 * first, wrapping onto as many lines as they need: none is dropped for room
 * (C3). In Downtime it carries the Upkeep due.
 */
export function PlayCrawlerUnit({
  crawler,
  live,
  downtime,
  onOpenSheet,
  store = useUnits,
}: PlayCrawlerUnitProps) {
  const sp = hullGauge(crawler)
  const tl = crawler.techLevel
  const chips = bayChips(crawler)
  const vital = writer(store, 'crawler', crawler.id)
  // Solid while it is the Downtime's unit, whoever may write it; dashed for reference otherwise.
  const solid = live || downtime
  return (
    <TitledBox
      as="section"
      title={crawler.name}
      label={playCopy('crawler', { name: crawler.name })}
      tone="crawler"
      className="su-play-unit"
      reference={!solid}
      chips={<Stat label={playCopy('crawler2')} size="mini" />}
      controls={
        <>
          {downtime ? stamp('Downtime') : <Stat label={playCopy('tl')} value={tl} size="mini" />}
          {onOpenSheet ? <SheetButton name={crawler.name} onOpen={onOpenSheet} /> : null}
        </>
      }
    >
      <PlayVital
        label={playCopy('sp')}
        value={sp.value}
        max={sp.max}
        tone="crawler"
        onChange={live ? vital('currentSP', sp.value, sp.max, playCopy('sp')) : undefined}
      />
      {downtime ? (
        <div style={CHIPS}>
          <Stat
            label={playCopy('upkeep')}
            value={`${crawlerUpkeepCost(tl, crawler.type)} Scrap · T${tl}`}
            size="mini"
          />
        </div>
      ) : null}
      {chips.length > 0 ? (
        <ul className="su-play-unit__bays" aria-label={playCopy('sBays', { name: crawler.name })}>
          {chips.map((bay, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: two bays may share a name
            <li key={`${bay.name}-${i}`}>
              <Stat
                label={bay.damaged ? playCopy('damaged2', { name: bay.name }) : bay.name}
                size="mini"
                state={bay.damaged ? 'critical' : undefined}
              />
            </li>
          ))}
        </ul>
      ) : null}
    </TitledBox>
  )
}

/**
 * A mech in the hangar: a Mini in the hangar's Mini grid (level 2), its
 * chassis its note, "In hangar" (or why it cannot fly) its state chip, last in
 * its chip group at the Mini's Size (C8), never loose words after it.
 */
export function PlayHangarMech({
  name,
  chassis,
  note,
}: {
  name: string
  chassis: string | null
  /** What stops it flying ("Destroyed"); "In hangar" when nothing does. */
  note: string | null
}): ReactNode {
  return (
    <li className="su-play-unit__hangar">
      <Entity
        size="mini"
        context="play"
        model={unitRowModel({ kind: 'mech', name, note: chassis ?? undefined })}
        state={<Stat label={note ?? playCopy('inHangar')} size="mini" />}
      />
    </li>
  )
}
