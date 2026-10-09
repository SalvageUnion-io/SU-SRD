import { Caption } from 'component-lib/stories/harness'
import type { CSSProperties, ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { Crawler } from '../../lib/schemas/crawler'
import type { Mech } from '../../lib/schemas/mech'
import type { Pilot } from '../../lib/schemas/pilot'
import { crawlerFixture, mechFixture, pilotFixture } from '../__tests__/fixtures'
import { InstrumentStage } from './_dashboardStage'
import { BoardControl } from './BoardControl'
import type { BoardOption } from './boardMenu'
import { DashboardCanvas } from './DashboardCanvas'
import { DashboardGrid } from './DashboardGrid'
import type { DisplayTab } from './DisplayTabs'
import { DisplayTabs } from './DisplayTabs'
import type { BandBay, MajorModel, StorageLot } from './MajorFrame'
import { MajorFrame, StorageBay } from './MajorFrame'
import { MinorFrame } from './MinorFrame'
import { SlotOverlay } from './SlotOverlay'
import type { SlotKind } from './slotLayout'
import { slotsFor } from './slotLayout'
import {
  bayConditions,
  crawlerMinorModel,
  hullGauge,
  injuryLines,
  mechMinorModel,
  mechStats,
  pilotMinorModel,
  pilotVitals,
  scrapLine,
} from './slotModels'
import type { MountState } from './useSeat'

export default { title: 'Compositions/Dashboard/Slot Row' }

/*
 * The slot row in each mount, with each slot in each of its forms: Pilot,
 * Mech and Crawler as a Major, as a Minor at rest, and as a Minor with
 * something wrong. The Minors are the real models (`slotModels.ts`) over
 * fixture entities; the Majors are their frames with the same numbers and
 * inert buttons, since the store-wired Majors need the app's stores.
 */

/** A real entity's id by name, so the story derives real maxima. */
function refOf(all: readonly { id: string; name: string }[], name: string): string {
  return all.find((e) => e.name === name)?.id ?? name
}

const ROOK = pilotFixture({
  id: 'story-rook',
  name: 'Rook',
  classRef: 'salvager',
  currentHP: 7,
  currentAP: 3,
  abilities: ['squeeze-it-in'],
})
const SCRAPPER = mechFixture({
  id: 'story-scrapper',
  name: 'Scrapper',
  chassisRef: refOf(SalvageUnionReference.Chassis.all(), 'Mule'),
  currentSP: 6,
  currentHeat: 3,
  currentEP: 4,
})
const HEN = crawlerFixture({
  id: 'story-hen',
  name: 'Mother Hen',
  techLevel: 'tech-2',
  currentSP: 17,
  scrapPool: { tl1: 12, tl2: 4 },
  upgradePool: 20,
  crawlerBays: [
    { bayRef: 'mech-bay' },
    { bayRef: 'med-bay' },
    { bayRef: 'crafting-bay' },
    { bayRef: 'trading-bay' },
  ],
})
const HURT: Pilot = { ...ROOK, injuries: [{ severity: 'major', note: 'broken arm' }] }
const DAMAGED: Mech = {
  ...SCRAPPER,
  shutdown: true,
  systemConditions: { [refOf(SalvageUnionReference.Systems.all(), 'Floodlights')]: 'damaged' },
}
const WORN: Crawler = {
  ...HEN,
  crawlerBays: [{ bayRef: 'mech-bay' }, { bayRef: 'cantina', condition: 'damaged' }],
}

const STACK: CSSProperties = { display: 'flex', flexDirection: 'column', gap: '16px' }

/** The slot row's grid, at its real height in the 1280×800 canvas. */
const ROW: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) 236px 236px',
  gap: '10px',
  height: 208,
}

const OVERLAY_HOST: CSSProperties = { position: 'relative', height: 480 }

const noop = () => {}

const SLOT_LABEL: Record<SlotKind, string> = { pilot: 'Pilot', mech: 'Mech', crawler: 'Crawler' }

const btn = (label: string, variant?: 'danger' | 'go') => ({ label, onClick: noop, variant })

const BOARD_SCRAPPER: BoardOption = {
  mechId: SCRAPPER.id,
  serverId: null,
  name: SCRAPPER.name,
  state: 'yours',
  note: null,
}

function pilotMajor(pilot: Pilot, crawler: Crawler | null): MajorModel {
  return {
    fam: 'pilot',
    stampLabel: 'On Foot',
    bays: [
      {
        label: 'Vitals',
        gauges: pilotVitals(pilot, crawler).gauges,
        lines: injuryLines(pilot).map((text) => ({ text, warn: true })),
        buttons: [btn('Take Dmg'), btn('Crit Injury', 'danger')],
      },
      { label: 'Kit', chips: [{ text: 'Salvaging Tools' }, { text: 'Pistol' }], buttons: [] },
      { label: 'Abilities', chips: pilot.abilities.map((text) => ({ text })), buttons: [] },
      {
        label: 'Mount',
        buttons: [],
        // Its states and menu are the Board Control stories.
        control: (
          <BoardControl
            menu={{ main: BOARD_SCRAPPER, options: [BOARD_SCRAPPER] }}
            onBoard={noop}
            onClaim={noop}
            onOpenMenu={noop}
          />
        ),
      },
    ],
  }
}

function mechMajor(mech: Mech, pilot: Pilot, boarded: boolean): MajorModel {
  const s = mechStats(mech, pilot.abilities, [])
  const rider: BandBay[] = [
    { label: 'Effects', side: true, columns: 1, buttons: [btn('○ Squeeze it in')] },
    { label: 'Egress', side: true, buttons: [btn('Dismount', 'go'), btn('Eject', 'danger')] },
  ]
  return {
    fam: 'mech',
    stampLabel: boarded ? 'Boarded' : 'Parked',
    bays: [
      {
        label: 'Reactor',
        columns: 4,
        large: true,
        gauges: [
          {
            label: 'Heat',
            value: s.heat,
            max: s.maxHeat,
            tone: 'mech',
            danger: Math.max(0, s.maxHeat - 2),
          },
          { label: 'EP', value: s.ep, max: s.maxEP, tone: 'mech' },
        ],
        buttons: [btn('Push', 'go'), btn('Heat Chk', 'go'), btn('Vent', 'go'), btn('Shutdn')],
      },
      {
        label: 'Chassis',
        large: true,
        gauges: [
          { label: 'SP', value: s.sp, max: s.maxSP, tone: 'mech' },
          { label: 'Cargo', value: s.cargo, max: s.maxCargo, tone: 'mech' },
        ],
        buttons: [btn('Take Dmg'), btn('Storage')],
      },
      ...(boarded ? rider : []),
    ],
  }
}

function crawlerMajor(crawler: Crawler, mediator: boolean): MajorModel {
  const bays = bayConditions(crawler)
  const scrap: BandBay = {
    label: 'Scrap a mech',
    side: true,
    columns: 1,
    buttons: [btn('Scrap Mech', 'danger')],
  }
  return {
    fam: 'crawler',
    stampLabel: 'Downtime',
    bays: [
      {
        label: 'Hull',
        gauges: [hullGauge(crawler)],
        lines: [{ text: 'Tech Level 2' }],
        buttons: [],
      },
      {
        label: 'Stores',
        lines: [
          { text: scrapLine(crawler) },
          ...(mediator ? [] : [{ text: 'The Mediator runs the crawler. Ask at the table.' }]),
        ],
        buttons: mediator ? [btn('Salvage'), btn('Craft')] : [],
      },
      {
        label: 'Bays',
        chips: bays.map((b) => ({
          text: b.damaged ? `${b.name} damaged` : b.name,
          warn: b.damaged,
        })),
        buttons: [],
      },
      {
        label: 'Upkeep',
        side: true,
        lines: [{ text: '5 Tech 2 Scrap per Downtime' }],
        buttons: [],
      },
      { label: 'Upgrade', side: true, lines: [{ text: 'Pool 20/60 to Tech 3' }], buttons: [] },
      ...(mediator ? [scrap] : []),
    ],
  }
}

type RowProps = {
  mount: MountState
  pilot?: Pilot
  mech?: Mech
  crawler?: Crawler
  mediator?: boolean
  onExpand: (kind: SlotKind, trigger: HTMLButtonElement) => void
}

/** The slot row's three slots, as `SlotRow` places them for `mount`. */
function Slots({
  mount,
  pilot = ROOK,
  mech = SCRAPPER,
  crawler = HEN,
  mediator = false,
  onExpand,
}: RowProps) {
  const { major, minors } = slotsFor(mount)
  const boarded = mount === 'mech'
  const majorView =
    major === 'pilot'
      ? pilotMajor(pilot, crawler)
      : major === 'mech'
        ? mechMajor(mech, pilot, boarded)
        : crawlerMajor(crawler, mediator)
  const minorView = (kind: SlotKind) =>
    kind === 'pilot'
      ? pilotMinorModel(pilot, crawler, boarded ? mech.name : null)
      : kind === 'mech'
        ? mechMinorModel(mech, pilot.abilities, [], boarded)
        : crawlerMinorModel(crawler)
  return (
    <div style={ROW}>
      <MajorFrame view={majorView} />
      {minors.map((kind) => (
        <MinorFrame
          key={kind}
          view={minorView(kind)}
          slot={SLOT_LABEL[kind]}
          onExpand={(trigger) => onExpand(kind, trigger)}
        />
      ))}
    </div>
  )
}

function Row(props: Omit<RowProps, 'onExpand'>) {
  const [asked, setAsked] = useState<SlotKind | null>(null)
  return (
    <InstrumentStage width={1280} mount={props.mount === 'downtime' ? 'crawler' : props.mount}>
      <Slots {...props} onExpand={(kind) => setAsked(kind)} />
      {asked ? <Caption>⤢ asked to open the {asked} controls.</Caption> : null}
    </InstrumentStage>
  )
}

const DISPLAY_HOST: CSSProperties = {
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
}

const TAB_NAMES: Record<DisplayTab, string> = {
  resolve: 'Resolve',
  reference: 'Reference',
  tables: 'Tables',
  srd: 'SRD',
  log: 'Log',
  crew: 'Crew',
}

/** Each tab's panel, as a labelled stand-in: this story is about the slot row. */
const STAND_INS = Object.fromEntries(
  Object.entries(TAB_NAMES).map(([tab, name]) => [
    tab,
    <div key={tab} className="pc-fill">
      Display · {name}
    </div>,
  ])
) as Record<DisplayTab, ReactNode>

/**
 * The slot row in the scaled 1280×800 canvas, with the display tabs below it
 * and ⤢ opening a Minor's Major over the display. Resize the window to check the
 * layout at the canvas size and at its width floor (794×496, scale 0.62).
 */
export const InTheCanvas = () => {
  const [open, setOpen] = useState<{ kind: SlotKind; trigger: HTMLButtonElement } | null>(null)
  const [tab, setTab] = useState<DisplayTab>('resolve')
  const display = useRef<HTMLDivElement>(null)
  return (
    <DashboardCanvas>
      <DashboardGrid
        mount="pilot"
        rail={<Caption>Pilot · Rook</Caption>}
        primary={<Slots mount="pilot" onExpand={(kind, trigger) => setOpen({ kind, trigger })} />}
        display={
          <div ref={display} style={DISPLAY_HOST}>
            <DisplayTabs tab={tab} onTab={setTab} panels={STAND_INS} />
            {open ? (
              <SlotOverlay
                open
                title={
                  SLOT_LABEL[open.kind] + (open.kind === 'mech' ? ' · Scrapper' : ' · Mother Hen')
                }
                container={display}
                returnFocusTo={open.trigger}
                onClose={() => setOpen(null)}
              >
                <MajorFrame
                  view={
                    open.kind === 'mech'
                      ? mechMajor(SCRAPPER, ROOK, false)
                      : crawlerMajor(HEN, false)
                  }
                />
              </SlotOverlay>
            ) : null}
          </div>
        }
      />
    </DashboardCanvas>
  )
}

/** On foot: the Pilot Major (Vitals, Kit, Abilities, Mount); Mech and Crawler Minors. */
export const OnFoot = () => (
  <div style={STACK}>
    <Caption>On foot — Pilot Major, the parked Mech and the Crawler as Minors.</Caption>
    <Row mount="pilot" />
  </div>
)

/** Boarded: the Mech Major with Effects and Egress in the side column. */
export const Boarded = () => (
  <div style={STACK}>
    <Caption>Boarded — Mech Major; Pilot and Crawler as Minors.</Caption>
    <Row mount="mech" />
  </div>
)

/** Downtime, as a player sees it: the crawler's numbers and bays, no verbs. */
export const DowntimePlayer = () => (
  <div style={STACK}>
    <Caption>Downtime, a player — Crawler Major read-only; Pilot and Mech as Minors.</Caption>
    <Row mount="downtime" />
  </div>
)

/** Downtime, as the Mediator sees it: Salvage, Craft and Scrap Mech. */
export const DowntimeMediator = () => (
  <div style={STACK}>
    <Caption>Downtime, the Mediator — the crawler verbs are live.</Caption>
    <Row mount="downtime" mediator />
  </div>
)

/** Each Minor surfacing a problem: an injury, a damaged system, a damaged bay. */
export const MinorsWithProblems = () => (
  <div style={STACK}>
    <Caption>Boarded, with an injured pilot and a damaged bay.</Caption>
    <Row mount="mech" pilot={HURT} crawler={WORN} />
    <Caption>On foot, with a damaged, shut-down mech and a damaged bay.</Caption>
    <Row mount="pilot" mech={DAMAGED} crawler={WORN} />
    <Caption>Downtime, with an injured pilot and a damaged mech.</Caption>
    <Row mount="downtime" pilot={HURT} mech={DAMAGED} crawler={WORN} />
  </div>
)

/** ⤢ — the parked Mech's Major, as a modal over the display. */
export const Expanded = () => {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const host = useRef<HTMLDivElement>(null)
  // Open once the host has mounted: the portal resolves its container on open.
  useEffect(() => setOpen(true), [])
  return (
    <div style={STACK}>
      <Caption>⤢ on the Mech Minor: its Reactor and Chassis, without boarding it.</Caption>
      <InstrumentStage width={1280} mount="pilot">
        <button ref={trigger} type="button" onClick={() => setOpen(true)}>
          Reopen
        </button>
        <div ref={host} style={OVERLAY_HOST}>
          <SlotOverlay
            open={open}
            title="Mech · Scrapper"
            container={host}
            returnFocusTo={trigger.current}
            onClose={() => setOpen(false)}
          >
            <MajorFrame view={mechMajor(SCRAPPER, ROOK, false)} />
          </SlotOverlay>
        </div>
      </InstrumentStage>
    </div>
  )
}

const CARGO: StorageLot[] = [
  { id: 'l1', code: 'SCR', name: 'Scrap', kind: 'bulk', qty: 3, units: 3 },
  { id: 'l2', code: 'CHM', name: 'Chimerium Shard', kind: 'unit', units: 1 },
]

/** The Cargo Hold overlay body — the StorageBay list (Jettison is destructive). */
export const Storage = () => {
  const [lots, setLots] = useState(CARGO)
  return (
    <div style={STACK}>
      <Caption>Cargo hold overlay — StorageBay with Jettison.</Caption>
      <InstrumentStage width={720}>
        <div style={{ height: 208 }}>
          <MajorFrame
            view={{
              fam: 'mech',
              stampLabel: 'Boarded',
              bays: [{ label: 'Chassis', buttons: [btn('Storage')] }],
              overlay: {
                title: 'Cargo Hold',
                onClose: noop,
                body: (
                  <StorageBay
                    lots={lots}
                    used={lots.reduce((n, l) => n + l.units, 0)}
                    cap={5}
                    onJettison={(id) => setLots((ls) => ls.filter((l) => l.id !== id))}
                  />
                ),
              },
            }}
          />
        </div>
      </InstrumentStage>
    </div>
  )
}
