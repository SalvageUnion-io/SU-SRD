/**
 * SlotRow — the Dashboard's top row: one Major slot and two Minor slots
 * (ADR-038 §3).
 *
 * Which entity holds the Major is the mount, and nothing else (`slotsFor` in
 * `slotLayout.ts`). The mount comes from the pilot's seat, and Downtime from
 * the Game's `downtime` row (`useDowntime`): the Crawler is Major while a step
 * is running, for every member at once.
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
import type { BoardMenu } from './boardMenu'
import { boardMenu, NO_BOARD_SOURCES } from './boardMenu'
import type { CrawlerUpkeep } from './CrawlerSlot'
import { CrawlerMajor, CrawlerMinor } from './CrawlerSlot'
import { MechMajor, MechMinor } from './MechSlot'
import { PilotMajor, PilotMinor } from './PilotSlot'
import type { SlotKind } from './slotLayout'
import { NO_CRAWLER, NO_MECH, slotsFor } from './slotLayout'
import type { MountState, SeatHandle } from './useSeat'

/** The store surface the slots need — injectable so tests can assert patches. */
export type PlayStore = Pick<EntityState, 'get' | 'update' | 'transfer'>

/**
 * The deck's Take Damage hand-off: its Apply step arms it on a destructive
 * outcome, and the Major opens its Take Damage overlay for the player to
 * confirm (ADR-007), then consumes it. Component state on the Dashboard.
 */
export type DamagePrompt = { armed: boolean; consume: () => void }

/** What every slot reads. */
export type SlotEntities = {
  /**
   * The boarded mech, or on foot the pilot's assigned one: null on foot for a
   * pilot with no assigned mech, who boards one from the Board menu.
   */
  mech: Mech | null
  pilot: Pilot
  /** The pilot's crawler (`pilot-to-crawler`), if it has one. */
  crawler: Crawler | null
  /** Whether the seat has the pilot aboard `mech`. */
  boarded: boolean
  /** The pilot's seat: Board, Dismount, Eject and the activated effects. */
  seat: SeatHandle
  /** What the Pilot's Board control offers (`boardMenu.ts`). */
  board: BoardMenu
  /** The viewer is the Game's Mediator, who alone runs the crawler. */
  mediator: boolean
  /** This Downtime's Upkeep, while one is running; null or absent otherwise. */
  upkeep?: CrawlerUpkeep | null
  store: PlayStore
}

const ROW: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) 236px 236px',
  gap: '10px',
  height: '100%',
}

/** Downtime: the Crawler alone, across the whole row. */
const ROW_ALONE: CSSProperties = { ...ROW, gridTemplateColumns: 'minmax(0, 1fr)' }

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

/** A slot whose entity the pilot doesn't have (no crawler, no mech yet). */
function EmptySlot({ text }: { text: string }) {
  return <div style={EMPTY}>{text}</div>
}

/**
 * One entity's Major form. The slot row's copy hosts the deck's Take Damage
 * hand-off; the ⤢ overlay's copy gets null, so the two never both answer it.
 */
export function SlotMajor({
  kind,
  mount,
  damagePrompt,
  ...e
}: SlotEntities & { kind: SlotKind; mount: MountState; damagePrompt: DamagePrompt | null }) {
  if (kind === 'crawler') {
    if (!e.crawler) return <EmptySlot text={NO_CRAWLER} />
    return (
      <CrawlerMajor
        crawler={e.crawler}
        mech={e.mech}
        store={e.store}
        mediator={e.mediator}
        upkeep={e.upkeep ?? null}
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
        boardedIn={e.boarded ? (e.mech?.name ?? null) : null}
        board={e.board}
        onBoard={e.seat.board}
        onClaimAndBoard={({ mechId, serverId }) => {
          // A spare is only ever known from the Game's listing, which names its row.
          if (serverId !== null) e.seat.claimAndBoard({ mechId, serverId })
        }}
        damagePrompt={damagePrompt}
      />
    )
  }
  if (!e.mech) return <EmptySlot text={NO_MECH} />
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
      damagePrompt={damagePrompt}
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
        boardedIn={e.boarded ? (e.mech?.name ?? null) : null}
        onExpand={onExpand}
      />
    )
  }
  if (kind === 'mech') {
    if (!e.mech) return <EmptySlot text={NO_MECH} />
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

type SlotRowProps = Omit<SlotEntities, 'store' | 'board'> & {
  /** Which entity runs the Dashboard, derived from the seat and Downtime. */
  mount: MountState
  /** ⤢ on a Minor: open that entity's Major as an overlay. */
  onExpand: (kind: SlotKind, trigger: HTMLButtonElement) => void
  /** Injectable store (defaults to the live entity store). */
  store?: PlayStore
  /**
   * What the Board control offers. Defaults to what is known before the Game
   * answers: the assigned mech alone.
   */
  board?: BoardMenu
  /** The deck's Take Damage hand-off, answered by the Major (Dashboard state). */
  damagePrompt?: DamagePrompt | null
}

export function SlotRow({
  mount,
  onExpand,
  store,
  board,
  damagePrompt = null,
  ...rest
}: SlotRowProps) {
  // Unconditional hook; the prop wins when a stub is injected (tests / harness).
  const liveStore = useEntityStore()
  const e: SlotEntities = {
    ...rest,
    store: store ?? liveStore,
    board:
      board ??
      boardMenu({ pilotId: rest.pilot.id, assigned: rest.mech, sources: NO_BOARD_SOURCES }),
  }
  const { major, minors } = slotsFor(mount)
  return (
    <div style={minors.length === 0 ? ROW_ALONE : ROW} data-major={major}>
      <SlotMajor kind={major} mount={mount} damagePrompt={damagePrompt} {...e} />
      {minors.map((kind) => (
        <SlotMinor key={kind} kind={kind} onExpand={(trigger) => onExpand(kind, trigger)} {...e} />
      ))}
    </div>
  )
}
