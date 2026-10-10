import { proposalTargets } from '../../lib/games/proposals'
import { downtimeStepNames } from '../../lib/rules/downtime'
import { TABLE_CREW, TABLE_MEMBERS, TABLE_SEATS } from './__tests__/tableFixture'
import type { MediatorTableView, MediatorTableWrites } from './MediatorDashboardView'
import { MediatorDashboardView } from './MediatorDashboardView'
import { readTrayNpc } from './opposition'
import type { SentProposal } from './proposalLine'
import { tableSeats } from './seatCards'

export default { title: 'Compositions/Dashboard/Mediator Dashboard View' }

/**
 * Board M1 (issue 1278): the Mediator Dashboard on its 1280×800 canvas, staged
 * with board M1's table. Resize the frame below 0.8 of the canvas to see the
 * stacked phone column. Writes do nothing here.
 */

const NOW = Date.parse('2026-10-09T12:00:00.000Z')

const done = async () => undefined

const WRITES: MediatorTableWrites = {
  downtime: { begin: done, advance: done, end: done, spendUpkeep: done },
  tray: { add: done, setHp: done, morale: done, remove: done },
  propose: done,
  broadcast: done,
  moreSent: () => undefined,
  onFailure: () => undefined,
}

const proposal = (
  id: string,
  targetName: string,
  field: string,
  after: number,
  reason: string,
  state: SentProposal['state'],
  minutes: number
) =>
  ({
    _id: id,
    entityId: id,
    entityType: 'pilot',
    targetName,
    field,
    after,
    reason,
    state,
    ts: NOW - minutes * 60_000,
    mine: true,
    actorName: null,
  }) as unknown as SentProposal

const NPC = (id: string, refSchema: string, refSlug: string, name: string, hp: number) =>
  readTrayNpc({
    _id: id,
    body: {
      refSchema,
      refSlug,
      name,
      currentHp: hp,
      maxHp: 10,
      statKind: 'hp',
      conditions: [],
    },
  })

const VIEW: MediatorTableView = {
  gameId: 'g1',
  gameName: 'Reclamation of the Wastes',
  seats: tableSeats(TABLE_CREW, TABLE_SEATS, TABLE_MEMBERS),
  crawler: {
    id: 'tenacity',
    name: '#430 Tenacity',
    sp: 20,
    maxSP: 20,
    techLevel: 1,
    bays: 10,
    baysIntact: 10,
    scrapAtTl: 5,
  },
  downtime: { running: false, stepIndex: null, done: 0, upkeepSpent: false },
  downtimeSteps: downtimeStepNames(),
  memberCount: 5,
  npcs: [
    NPC('n1', 'squads', 'rifle-squad', 'Rifle Squad', 7),
    NPC('n2', 'squads', 'raider-band', 'Raider Band', 6),
  ],
  targets: proposalTargets(TABLE_CREW),
  sent: [
    proposal('c1', 'Bonesaw', 'currentHP', 8, 'Shrapnel', 'applied', 9),
    proposal('c2', 'Judge', 'currentHP', 4, 'Ejection burn', 'proposed', 2),
    proposal('c3', 'Driftwood', 'currentAP', 3, 'Climb', 'declined', 14),
  ],
  sentLimit: 20,
  alerts: [],
  rolls: [],
  now: NOW,
  canWrite: true,
}

const FRAME = { height: 720, resize: 'both', overflow: 'hidden', border: '1px solid #ccc' } as const

export const RunningTheTable = () => (
  <div style={FRAME}>
    <MediatorDashboardView view={VIEW} writes={WRITES} toRef={{ current: null }} />
  </div>
)

export const InDowntime = () => (
  <div style={FRAME}>
    <MediatorDashboardView
      view={{ ...VIEW, downtime: { running: true, stepIndex: 1, done: 3, upkeepSpent: false } }}
      writes={WRITES}
      toRef={{ current: null }}
    />
  </div>
)

/** Offline or outdated: what was read stays, every control is disabled. */
export const Offline = () => (
  <div style={FRAME}>
    <MediatorDashboardView
      view={{ ...VIEW, canWrite: false }}
      writes={WRITES}
      toRef={{ current: null }}
    />
  </div>
)
