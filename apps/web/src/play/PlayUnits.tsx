/**
 * The Units column's unit boxes (play.md §4, wireframe pin 4): the pilot,
 * the mech and the crawler, each one `TitledBox` in its tone, and the mechs
 * left in the hangar as Tokens. Exported one by one so the Mediator's screen
 * (play.md §10) draws the same boxes with its own `live` flag.
 *
 * - **Live** — − / + on every vital (`PlayVital`), each press one write
 *   through `entityStore.update`, the patch the sheet writes for the same
 *   vital (`currentHP`, `currentSP`, …), its refusal told by `runWrite`.
 * - **Reference** — the dashed frame, every vital a read-out, and at most one
 *   control, the one that makes the unit live: Board, for a mech.
 *
 * ## Nesting (play.md §12)
 *
 * Each box is level 1, directly in the column. What it holds is level 2 and
 * plain: gauges, `Stat` chips (class, TP, injuries, bays, upkeep), a line of
 * text. A hangar mech is a full-width Token on its own line, never a box.
 *
 * The dashed frame is the box's own (`reference`); the boxes' rows are
 * `.su-play-unit__*`, in `styles/play/units.css`, which `PlayFrame` loads.
 */

import { DOWNTIME_UPKEEP_SCRAP } from 'game-domain/rules/downtime'
import type { Crawler } from 'game-domain/schemas/crawler'
import type { Mech } from 'game-domain/schemas/mech'
import type { Pilot } from 'game-domain/schemas/pilot'
import type { RangeBand } from 'game-domain/schemas/seat'
import { RANGE_BANDS } from 'game-domain/schemas/seat'
import type { CSSProperties, ReactNode } from 'react'
import { toEntityModel } from 'salvageunion-reference'
import type { TagItem } from '../components/index'
import {
  Badge,
  Button,
  Chips,
  Entity,
  heatDangerFrom,
  relation,
  Segmented,
  SegmentedOption,
  Slab,
  Stat,
  TitledBox,
  tokens,
} from '../components/index'
import { resolveClassName } from '../lib/classRef'
import { activatableEffects } from '../lib/rules/activatableEffects'
import { crawlerTechLevelOf } from '../lib/rules/downtimeEconomy'
import { runWrite } from '../lib/runWrite'
import { unitRowModel } from '../lib/units/unitModel'
import { useEntityStore } from '../stores/entityStore'
import { PLAY_TXN } from '../stores/surfaceProvenance'
import type { EntityForType } from '../stores/types'
import { PlayVital } from './PlayVital'
import { hullGauge, injuryLines, mechStats, pilotVitals } from './unitStats.model'
import type { MechRestore } from './units.model'
import { bayChips } from './units.model'

/** The store a box writes through; the app's own unless a test hands one in. */
type UnitStore = typeof useEntityStore

/** A row of level-2 chips under the vitals, wrapping as a whole. */
const CHIPS = {
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  gap: tokens.space[6],
  minWidth: 0,
} satisfies CSSProperties

/** Pushes what follows (Sheet ⤢, Board) to the row's end. */
const SPACER = { flex: '1 1 0%' } satisfies CSSProperties

const NOTE = {
  color: 'var(--color-wk-muted)',
  fontSize: tokens.fontSize.sm,
  margin: 0,
} satisfies CSSProperties

const RANGE_LABEL = {
  color: 'var(--color-wk-muted)',
  fontSize: tokens.fontSize.sm,
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
 * A box's relation chips (chips-and-actions C11, R5): what the unit is built
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

/** One fire-and-forget vital write, as the sheet sends it. */
function writer<K extends 'pilot' | 'mech' | 'crawler'>(store: UnitStore, kind: K, id: string) {
  return (patch: Partial<EntityForType<K>>) =>
    runWrite(() => store.getState().update(kind, id, patch, PLAY_TXN))
}

/**
 * "Sheet ⤢", at its line's Size (ruleset §4.7): Mini beside the pilot's
 * Compact Stat chips (18px), Compact beside the mech's range or alone.
 */
function SheetButton({
  name,
  onOpen,
  size = 'compact',
}: {
  name: string
  onOpen: () => void
  size?: 'compact' | 'mini'
}) {
  return (
    <Button variant="ghost" size={size} aria-label={`Open ${name}’s sheet`} onClick={onOpen}>
      Sheet ⤢
    </Button>
  )
}

export type PlayPilotUnitProps = {
  pilot: Pilot
  /** The pilot's crawler: its Tech Level raises max HP and AP (Stat Training). */
  crawler: Crawler | null
  /** − / + on HP and AP; else a read-out (another's pilot, offline). */
  live: boolean
  /** "Sheet ⤢": opens the pilot's sheet over Play. */
  onOpenSheet?: () => void
  store?: UnitStore
}

/** The pilot's box: HP and AP, class, TP and injuries; LIVE whenever it may be written. */
export function PlayPilotUnit({
  pilot,
  crawler,
  live,
  onOpenSheet,
  store = useEntityStore,
}: PlayPilotUnitProps) {
  const [hp, ap] = pilotVitals(pilot, crawler).gauges
  const write = writer(store, 'pilot', pilot.id)
  const injuries = injuryLines(pilot)
  return (
    <TitledBox
      as="section"
      title={pilot.name}
      label={`Pilot: ${pilot.name}`}
      tone="pilot"
      reference={!live}
      chips={<Stat label="Pilot" size="mini" />}
      controls={stamp(live ? 'Live' : 'Read only')}
    >
      {hp ? (
        <PlayVital
          label="HP"
          value={hp.value}
          max={hp.max}
          tone="pilot"
          onChange={live ? (v) => write({ currentHP: v }) : undefined}
        />
      ) : null}
      {ap ? (
        <PlayVital
          label="AP"
          value={ap.value}
          max={ap.max}
          tone="pilot"
          onChange={live ? (v) => write({ currentAP: v }) : undefined}
        />
      ) : null}
      <div style={CHIPS}>
        {pilot.classRef ? <Stat label={resolveClassName(pilot.classRef)} size="compact" /> : null}
        <Stat label="TP" value={pilot.trainingPoints ?? 0} size="compact" />
        {injuries.length === 0 ? (
          <Stat label="No injuries" size="compact" />
        ) : (
          injuries.map((line) => <Stat key={line} label={line} size="compact" state="critical" />)
        )}
        <span style={SPACER} />
        {onOpenSheet ? <SheetButton name={pilot.name} onOpen={onOpenSheet} size="mini" /> : null}
      </div>
    </TitledBox>
  )
}

/** Where the mech is, as its box's stamp says it. */
export type MechPlace = 'boarded' | 'parked' | 'downtime'

const MECH_STAMP: Record<MechPlace, string> = {
  boarded: 'Boarded',
  parked: 'Parked',
  downtime: 'Mech Bay',
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
  /** "Sheet ⤢": opens the mech's sheet over Play. */
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
  store = useEntityStore,
}: PlayMechUnitProps) {
  const s = mechStats(mech, pilotAbilities, activeEffects)
  const write = writer(store, 'mech', mech.id)
  // What it is built on (C11): the chassis, label first, Peeking and opening it.
  const chassis = s.chassis
    ? relation('chassis', 'Chassis', s.chassis.name, { ref: toEntityModel(s.chassis).ref })
    : null
  const showHeat = place !== 'parked'
  // What the mech and its pilot can switch on (ADR-029 §4): the table keeps
  // time, so an effect stays on until the player ends it.
  const effects = place === 'boarded' ? activatableEffects(mech, pilotAbilities) : []
  return (
    <TitledBox
      as="section"
      title={mech.name}
      label={`Mech: ${mech.name}`}
      tone="mech"
      reference={!live}
      chips={chassis ? <Relations items={[chassis]} /> : undefined}
      controls={stamp(mech.destroyed ? 'Destroyed' : MECH_STAMP[place])}
    >
      <PlayVital
        label="SP"
        value={s.sp}
        max={s.maxSP}
        tone="mech"
        restoresTo={restore.sp}
        onChange={live ? (v) => write({ currentSP: v }) : undefined}
      />
      <PlayVital
        label="EP"
        value={s.ep}
        max={s.maxEP}
        tone="mech"
        restoresTo={restore.ep}
        onChange={live ? (v) => write({ currentEP: v }) : undefined}
      />
      {showHeat ? (
        <PlayVital
          label="Heat"
          value={s.heat}
          max={s.maxHeat}
          tone="mech"
          danger={s.maxHeat > 0 ? heatDangerFrom(s.maxHeat) : undefined}
          restoresTo={restore.heat}
          onChange={live ? (v) => write({ currentHeat: v }) : undefined}
        />
      ) : null}
      {effects.length > 0 ? (
        <>
          <Slab as="h4" label="Effects" />
          <Segmented label={`Effects of ${mech.name}`} size="compact" wrap>
            {effects.map((e) => {
              const on = activeEffects.includes(e.ref)
              return (
                <SegmentedOption
                  key={e.ref}
                  pressed={on}
                  disabled={!live || onToggleEffect === undefined}
                  title={on ? `${e.name} is on: press to end it` : `${e.name}: ${e.summary}`}
                  onClick={() => onToggleEffect?.(e.ref)}
                >
                  {e.name}
                </SegmentedOption>
              )
            })}
          </Segmented>
        </>
      ) : null}
      {place === 'boarded' ? (
        <div style={CHIPS}>
          {range ? (
            <>
              <span style={RANGE_LABEL}>Range</span>
              <Segmented label="Range" size="compact">
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
            </>
          ) : null}
          <span style={SPACER} />
          {onOpenSheet ? <SheetButton name={mech.name} onOpen={onOpenSheet} /> : null}
        </div>
      ) : null}
      {place === 'parked' ? (
        <div style={CHIPS}>
          <p style={NOTE}>Read only until boarded</p>
          <span style={SPACER} />
          {onBoard !== undefined ? (
            <Button
              variant="primary"
              size="compact"
              aria-label={`Board ${mech.name}`}
              disabled={onBoard === null}
              onClick={onBoard ?? undefined}
            >
              Board
            </Button>
          ) : null}
        </div>
      ) : null}
    </TitledBox>
  )
}

export type PlayCrawlerUnitProps = {
  crawler: Crawler
  /** − / + on SP: solo Downtime, or always for the Mediator. */
  live: boolean
  /** Downtime is running: the box carries the Downtime stamp and the Upkeep due. */
  downtime: boolean
  /** "Sheet ⤢": opens the crawler's sheet over Play. */
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
  store = useEntityStore,
}: PlayCrawlerUnitProps) {
  const sp = hullGauge(crawler)
  const tl = crawlerTechLevelOf(crawler)
  const chips = bayChips(crawler)
  const write = writer(store, 'crawler', crawler.id)
  // Solid while it is the Downtime's unit, whoever may write it (wireframes
  // player-downtime and player-solo-downtime); dashed for reference otherwise.
  const solid = live || downtime
  return (
    <TitledBox
      as="section"
      title={crawler.name}
      label={`Crawler: ${crawler.name}`}
      tone="crawler"
      reference={!solid}
      chips={<Stat label="Crawler" size="mini" />}
      controls={
        downtime ? (
          stamp('Downtime')
        ) : tl === undefined ? undefined : (
          <Stat label="TL" value={tl} size="mini" />
        )
      }
    >
      <PlayVital
        label="SP"
        value={sp.value}
        max={sp.max}
        tone="crawler"
        onChange={live ? (v) => write({ currentSP: v }) : undefined}
      />
      {downtime && tl !== undefined ? (
        <div style={CHIPS}>
          <Stat label="Upkeep" value={`${DOWNTIME_UPKEEP_SCRAP} Scrap · T${tl}`} size="compact" />
        </div>
      ) : null}
      {chips.length > 0 ? (
        <ul className="su-play-unit__bays" aria-label={`${crawler.name}’s bays`}>
          {chips.map((bay, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: two bays may share a name
            <li key={`${bay.name}-${i}`}>
              <Stat
                label={bay.damaged ? `${bay.name} · damaged` : bay.name}
                size="compact"
                state={bay.damaged ? 'critical' : undefined}
              />
            </li>
          ))}
        </ul>
      ) : null}
      {onOpenSheet ? (
        <div style={CHIPS}>
          <span style={SPACER} />
          <SheetButton name={crawler.name} onOpen={onOpenSheet} />
        </div>
      ) : null}
    </TitledBox>
  )
}

/**
 * A mech in the hangar: a full-width Token on its own line (level 2), its
 * chassis its note, "In hangar" (or why it cannot fly) its state chip, last in
 * its chip group at the Token's Size (C8), never loose words after it.
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
    <div className="su-play-unit__hangar">
      <Entity
        form="token"
        context="play"
        model={unitRowModel({ kind: 'mech', name, note: chassis ?? undefined })}
        trailing={<Stat label={note ?? 'In hangar'} size="mini" />}
      />
    </div>
  )
}
