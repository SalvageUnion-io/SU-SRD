/**
 * SlotRow — the Dashboard's top row: one Major slot and two Minor slots
 * (docs/architecture/dashboard-redesign.md D1–D3).
 *
 * Which entity holds the Major is the mount, and nothing else (`slotsFor` in
 * `slotLayout.ts`). The mount comes from the pilot's seat, and Downtime from `playStateStore`
 * until the Dashboard follows the Game's own Downtime (plan layer 8).
 *
 * Each entity's two forms live in its own file (`PilotSlot`, `MechSlot`,
 * `CrawlerSlot`); this file only places them. `SlotMajor` is also what the ⤢
 * overlay renders, so a Minor opens into exactly the controls its Major has.
 *
 * Every band runs its verbs through the pure rules engine (`dashboardRules.ts` /
 * `dashboardEconomy.ts` → `lib/rules/*`) and the entity store under the
 * ADR-007 automation boundary:
 *
 *   - Auto-apply (single click): Push, Heat Check, Vent, Shutdown toggle, the
 *     SP/HP value of a self-declared hit.
 *   - Player-confirmed (explicit extra step): the Critical Damage / Critical
 *     Injury *roll* when a hit hits 0, marking the mech Destroyed, and Eject.
 */

import type { CSSProperties } from 'react'
import type { Crawler } from '../../lib/schemas/crawler'
import type { Mech } from '../../lib/schemas/mech'
import type { Pilot } from '../../lib/schemas/pilot'
import type { EntityState } from '../../stores/entityStore'
import { useEntityStore } from '../../stores/entityStore'
import { CrawlerMajor, CrawlerMinor } from './CrawlerSlot'
import { MechMajor, MechMinor } from './MechSlot'
import { PilotMajor, PilotMinor } from './PilotSlot'
import type { SlotKind } from './slotLayout'
import { slotsFor } from './slotLayout'
import type { MountState, SeatHandle } from './useSeat'

/** The store surface the slots need — injectable so tests can assert patches. */
export type PlayStore = Pick<EntityState, 'get' | 'update' | 'transfer'>

/** What every slot reads. */
export type SlotEntities = {
  /** The boarded mech, or on foot the pilot's assigned one. */
  mech: Mech
  pilot: Pilot
  /** The pilot's crawler (`pilot-to-crawler`), if it has one. */
  crawler: Crawler | null
  /** Whether the seat has the pilot aboard `mech`. */
  boarded: boolean
  /** The pilot's seat: Board, Dismount, Eject and the activated effects. */
  seat: SeatHandle
  /** The viewer is the Game's Mediator, who alone runs the crawler (D11). */
  mediator: boolean
  store: PlayStore
}

const ROW: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) 236px 236px',
  gap: '10px',
  height: '100%',
}

const EMPTY: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  padding: '8px',
  textAlign: 'center',
  background: 'var(--color-band-cream)',
  border: 'var(--bw-chrome) dashed color-mix(in srgb, var(--color-ink) 30%, transparent)',
  borderRadius: 'var(--radius-panel)',
  fontFamily: 'var(--font-body)',
  fontSize: 'var(--text-note)',
  // ink-75: ink-50 on band-cream fails AA contrast for small text (3.04:1).
  color: 'var(--color-ink-75)',
}

/** A slot whose entity the pilot doesn't have (no crawler yet). */
function EmptySlot({ text }: { text: string }) {
  return <div style={EMPTY}>{text}</div>
}

const NO_CRAWLER = 'No crawler. Assign one on the pilot’s sheet.'

/**
 * One entity's Major form. The slot row's copy hosts the deck's Take Damage
 * hand-off; the ⤢ overlay's copy does not, so the two never both answer it.
 */
export function SlotMajor({
  kind,
  mount,
  hostsDamagePrompt,
  ...e
}: SlotEntities & { kind: SlotKind; mount: MountState; hostsDamagePrompt: boolean }) {
  if (kind === 'crawler') {
    if (!e.crawler) return <EmptySlot text={NO_CRAWLER} />
    return (
      <CrawlerMajor
        crawler={e.crawler}
        mech={e.mech}
        store={e.store}
        mediator={e.mediator}
        stampLabel={mount === 'downtime' ? 'Downtime' : 'Crawler'}
      />
    )
  }
  if (kind === 'pilot') {
    return (
      <PilotMajor
        pilot={e.pilot}
        crawler={e.crawler}
        store={e.store}
        boardedIn={e.boarded ? e.mech.name : null}
        onBoard={() => e.seat.board(e.mech.id)}
        hostsDamagePrompt={hostsDamagePrompt}
      />
    )
  }
  return (
    <MechMajor
      mech={e.mech}
      store={e.store}
      pilotAbilities={e.pilot.abilities}
      activeEffects={e.seat.seat.activeEffects}
      boarded={e.boarded}
      onToggleEffect={e.seat.toggleEffect}
      onDismount={e.seat.dismount}
      onEject={e.seat.eject}
      hostsDamagePrompt={hostsDamagePrompt}
    />
  )
}

function SlotMinor({
  kind,
  onExpand,
  ...e
}: SlotEntities & { kind: SlotKind; onExpand: (trigger: HTMLButtonElement) => void }) {
  if (kind === 'pilot') {
    return (
      <PilotMinor
        pilot={e.pilot}
        crawler={e.crawler}
        boardedIn={e.boarded ? e.mech.name : null}
        onExpand={onExpand}
      />
    )
  }
  if (kind === 'mech') {
    return (
      <MechMinor
        mech={e.mech}
        pilotAbilities={e.pilot.abilities}
        activeEffects={e.seat.seat.activeEffects}
        boarded={e.boarded}
        onExpand={onExpand}
      />
    )
  }
  if (!e.crawler) return <EmptySlot text={NO_CRAWLER} />
  return <CrawlerMinor crawler={e.crawler} onExpand={onExpand} />
}

type SlotRowProps = Omit<SlotEntities, 'store'> & {
  /** Which entity runs the Dashboard, derived from the seat and Downtime. */
  mount: MountState
  /** ⤢ on a Minor: open that entity's Major as an overlay. */
  onExpand: (kind: SlotKind, trigger: HTMLButtonElement) => void
  /** Injectable store (defaults to the live entity store). */
  store?: PlayStore
}

export function SlotRow({ mount, onExpand, store, ...rest }: SlotRowProps) {
  // Unconditional hook; the prop wins when a stub is injected (tests / harness).
  const liveStore = useEntityStore()
  const e: SlotEntities = { ...rest, store: store ?? liveStore }
  const { major, minors } = slotsFor(mount)
  return (
    <div style={ROW} data-major={major}>
      <SlotMajor kind={major} mount={mount} hostsDamagePrompt {...e} />
      {minors.map((kind) => (
        <SlotMinor key={kind} kind={kind} onExpand={(trigger) => onExpand(kind, trigger)} {...e} />
      ))}
    </div>
  )
}
