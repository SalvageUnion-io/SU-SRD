import type { EntityKind } from 'game-domain/entityKinds'
import type { JobTerms } from 'game-domain/games/ledger'
import type { BoundaryKind } from 'game-domain/games/safety'
import type { LinkShape } from 'game-domain/links/linkRules'
import type { Faction } from 'game-domain/schemas/ledger'
import type { SalvageArea } from 'game-domain/schemas/salvageArea'
import type { OpInput } from '../ops'
import { entityLog } from '../ops'
import { answerOrRefuse, RoomRefusal } from '../refusal'
import type { GameRoomLogic } from './gameRoomLogic'
import type { LogEntry } from './log'
import type { TrayPatch } from './opposition'
import type { Profile } from './roster'
import { seedTemplate } from './template'

/** Who is acting, in which Game, and when: the Worker vouches for the first, the room supplies the rest. */
type ActContext = { room: GameRoomLogic; actor: string; gameId: string; at: number }

/** A seat write's address. */
type SeatArgs = { pilotId: string }

/** What `ops.propose` takes. */
type ProposeArgs = { entityId: string; field: string; after: unknown; reason?: string }

/** A unit as a reader outside the room sees it (the bot's sheets, ADR-064 §5). */
export type UnitSheet = { id: string; kind: EntityKind; body: Record<string, unknown> }

/**
 * Every act a member can ask of the room, by name. The Worker forwards the
 * signed-in player as `actor`; the room takes the time itself, so a caller
 * cannot backdate an act, and names the Game itself, so a caller cannot
 * create one under another room's id.
 */
const GAME_ACTS = {
  create: (c: ActContext, a: { name: string; templateOrigin?: string; profile: Profile }) =>
    c.room.roster.create(c.actor, { ...a, gameId: c.gameId, at: c.at }),
  createFromTemplate: (c: ActContext, a: { templateId: string; name?: string; profile: Profile }) =>
    seedTemplate(c.room, c.actor, { ...a, gameId: c.gameId, at: c.at }),
  read: (c: ActContext) => c.room.roster.read(c.actor),
  members: (c: ActContext) => c.room.roster.members(c.actor),
  setMediator: (c: ActContext, a: { userId: string; mediator: boolean }) =>
    c.room.roster.setMediator(c.actor, a.userId, a.mediator),
  updateProfile: (c: ActContext, a: { profile: Profile }) =>
    c.room.roster.updateProfile(c.actor, a.profile),
  inviteCode: (c: ActContext) => c.room.roster.inviteCode(c.actor, c.at),
  resetInvite: (c: ActContext) => c.room.roster.resetInvite(c.actor, c.at),
  invitePreview: (c: ActContext, a: { code: string }) => c.room.roster.invitePreview(a.code),
  redeem: (c: ActContext, a: { code: string; profile: Profile }) =>
    c.room.roster.redeem(c.actor, a.code, a.profile, c.at),

  createUnit: (c: ActContext, a: { id: string; kind: EntityKind; body: unknown }) =>
    c.room.units.create(c.actor, { ...a, at: c.at }),
  submit: (c: ActContext, a: { ops: OpInput[]; replayed?: boolean }) =>
    c.room.units.submit(c.actor, a.ops, { replayed: a.replayed === true }),
  units: (c: ActContext) => c.room.units.list(c.actor),
  links: (c: ActContext) => c.room.units.links(c.actor),
  assign: (c: ActContext, a: { unitId: string; userId?: string }) =>
    c.room.units.assign(c.actor, a.unitId, c.at, a.userId),
  unassign: (c: ActContext, a: { unitId: string }) =>
    c.room.units.unassign(c.actor, a.unitId, c.at),
  removeUnit: (c: ActContext, a: { unitId: string }) => c.room.units.remove(c.actor, a.unitId),
  drawLink: (c: ActContext, a: { link: LinkShape }) => c.room.units.drawLink(c.actor, a.link),
  removeLink: (c: ActContext, a: { link: LinkShape }) => c.room.units.removeLink(c.actor, a.link),
  setPrimaryCrawler: (c: ActContext, a: { crawlerId: string }) =>
    c.room.units.setPrimaryCrawler(c.actor, a.crawlerId),

  // The table in play, under the names a client's act
  // carries, with their args (`gameId` is the room's own, so it is ignored).
  'ops.propose': (c: ActContext, a: ProposeArgs) => {
    const id = c.room.newId()
    c.room.proposals.propose(c.actor, {
      id,
      unitId: a.entityId,
      field: a.field,
      value: a.after,
      ...(a.reason === undefined ? {} : { reason: a.reason }),
      at: c.at,
    })
    return id
  },
  'ops.pending': (c: ActContext) => c.room.proposals.pending(c.actor),
  'ops.sent': (c: ActContext) => c.room.proposals.sent(c.actor),
  'ops.accept': (c: ActContext, a: { opId: string }) => {
    const result = c.room.proposals.applyProposal(c.actor, a.opId, c.at)
    if (!result.ok) throw new RoomRefusal('That changed since it was proposed; ask for it again')
  },
  'ops.decline': (c: ActContext, a: { opId: string }) =>
    c.room.proposals.declineProposal(c.actor, a.opId),

  'seats.forGame': (c: ActContext) => c.room.play.seats(c.actor),
  'seats.board': (c: ActContext, a: SeatArgs & { mechId: string }) =>
    c.room.play.board(c.actor, a.pilotId, a.mechId, c.at),
  'seats.dismount': (c: ActContext, a: SeatArgs) => c.room.play.dismount(c.actor, a.pilotId, c.at),
  'seats.eject': (c: ActContext, a: SeatArgs) => c.room.play.eject(c.actor, a.pilotId, c.at),
  'seats.setRange': (c: ActContext, a: SeatArgs & { range: string }) =>
    c.room.play.setRange(c.actor, a.pilotId, a.range, c.at),
  'seats.toggleEffect': (c: ActContext, a: SeatArgs & { ref: string }) =>
    c.room.play.toggleEffect(c.actor, a.pilotId, a.ref, c.at),
  'seats.setResolving': (c: ActContext, a: SeatArgs & { resolving: unknown }) =>
    c.room.play.setResolving(c.actor, a.pilotId, a.resolving, c.at),
  'seats.clearResolving': (c: ActContext, a: SeatArgs) =>
    c.room.play.clearResolving(c.actor, a.pilotId, c.at),

  'downtime.state': (c: ActContext) => c.room.play.downtime(c.actor),
  'downtime.begin': (c: ActContext) => c.room.play.beginDowntime(c.actor, c.at),
  'downtime.advance': (c: ActContext) => c.room.play.advanceDowntime(c.actor),
  'downtime.setStep': (c: ActContext, a: { stepIndex: number }) =>
    c.room.play.setDowntimeStep(c.actor, a.stepIndex),
  'downtime.end': (c: ActContext) => c.room.play.endDowntime(c.actor),
  'downtime.markStepDone': (c: ActContext, a: { done: boolean }) =>
    c.room.play.markStepDone(c.actor, a.done),
  'downtime.spendUpkeep': (c: ActContext) => c.room.play.spendUpkeep(c.actor),

  'changeLog.appendChangeLog': (c: ActContext, a: { entries: LogEntry[] }) =>
    c.room.log.append(c.actor, a.entries),
  'changeLog.broadcast': (c: ActContext, a: { message: string }) =>
    c.room.log.broadcast(c.actor, a.message, c.at),
  'changeLog.rolls': (c: ActContext) => c.room.log.rolls(c.actor),
  'changeLog.alerts': (c: ActContext) => c.room.log.alerts(c.actor),
  'changeLog.forEntity': (c: ActContext, a: { entityId: string }) =>
    entityLog(c.room.units.history(c.actor, a.entityId)),

  // The Mediator's tray and running encounter, under the names a client's act carries.
  'mediator.npcs': (c: ActContext) => c.room.opposition.tray(c.actor),
  'mediator.amMediator': (c: ActContext) => c.room.opposition.mediates(c.actor),
  'mediator.addNpc': (c: ActContext, a: { body: unknown }) =>
    c.room.opposition.addNpc(c.actor, a.body, c.at),
  'mediator.removeNpc': (c: ActContext, a: { npcId: string }) =>
    c.room.opposition.removeNpc(c.actor, a.npcId),
  'mediator.updateNpc': (c: ActContext, a: { npcId: string; patch: TrayPatch }) =>
    c.room.opposition.updateNpc(c.actor, a.npcId, a.patch, c.at),
  'mediator.recordGroupRoll': (c: ActContext, a: { groupId: string; roll: unknown }) =>
    c.room.opposition.recordGroupRoll(c.actor, a.groupId, a.roll, c.at),
  'mediator.running': (c: ActContext) => c.room.opposition.running(c.actor),
  'mediator.runEncounter': (
    c: ActContext,
    a: { encounter: unknown; clear: boolean; waves?: boolean }
  ) => c.room.opposition.runEncounter(c.actor, a.encounter, a, c.at),
  'mediator.bringInWave': (c: ActContext, a: { wave: number }) =>
    c.room.opposition.bringInWave(c.actor, a.wave, c.at),
  'mediator.endEncounter': (c: ActContext) => c.room.opposition.endEncounter(c.actor),

  // The table's state, under the names a client's act carries.
  'scenes.current': (c: ActContext) => c.room.scene.scene(c.actor),
  'scenes.setConditions': (c: ActContext, a: { conditions: string[] }) =>
    c.room.scene.setConditions(c.actor, a.conditions, c.at),
  'scenes.passHour': (c: ActContext) => c.room.scene.passHour(c.actor, c.at),
  'salvageAreas.here': (c: ActContext) => c.room.scene.salvageArea(c.actor),
  'salvageAreas.set': (c: ActContext, a: { area: SalvageArea | null }) =>
    c.room.scene.setSalvageArea(c.actor, a.area, c.at),
  'salvageAreas.spend': (c: ActContext, a: { pilotId: string }) =>
    c.room.scene.spendSupply(c.actor, a.pilotId, c.at),

  'ledger.get': (c: ActContext) => c.room.ledger.ledger(c.actor),
  'ledger.setFaction': (c: ActContext, a: { faction: Faction }) =>
    c.room.ledger.setFaction(c.actor, a.faction, c.at),
  'ledger.removeFaction': (c: ActContext, a: { id: string }) =>
    c.room.ledger.removeFaction(c.actor, a.id, c.at),
  'ledger.setJob': (c: ActContext, a: { job: JobTerms }) =>
    c.room.ledger.setJob(c.actor, a.job, c.at),
  'ledger.setJobState': (c: ActContext, a: { id: string; state: 'open' | 'dropped' }) =>
    c.room.ledger.setJobState(c.actor, a.id, a.state, c.at),
  'ledger.removeJob': (c: ActContext, a: { id: string }) =>
    c.room.ledger.removeJob(c.actor, a.id, c.at),
  'ledger.completeJob': (c: ActContext, a: { id: string }) =>
    c.room.ledger.completeJob(c.actor, a.id, c.at),
  'ledger.collectIncome': (c: ActContext) => c.room.ledger.collectIncome(c.actor, c.at),

  'safety.boundaries': (c: ActContext) => c.room.safety.boundaries(c.actor),
  'safety.addBoundary': (c: ActContext, a: { kind: BoundaryKind; text: string }) =>
    c.room.safety.addBoundary(c.actor, a.kind, a.text, c.at),
  'safety.removeBoundary': (c: ActContext, a: { boundaryId: string }) =>
    c.room.safety.removeBoundary(c.actor, a.boundaryId),
  'safety.stopSign': (c: ActContext) => c.room.safety.stopSign(c.actor),
  'safety.showStop': (c: ActContext) => c.room.safety.showStop(c.actor, c.at),
  'safety.liftStop': (c: ActContext) => c.room.safety.liftStop(c.actor, c.at),
  'safety.setPostToChannel': (c: ActContext, a: { on: boolean }) =>
    c.room.safety.setPostToChannel(c.actor, a.on, c.at),

  'publicSheet.setPublic': (
    c: ActContext,
    a: { kind: EntityKind; appId: string; isPublic: boolean }
  ) => c.room.units.setPublic(c.actor, a.kind, a.appId, a.isPublic),

  unitsFor: (c: ActContext): UnitSheet[] => {
    const crawler = c.room.units.primaryCrawler()
    return c.room.units
      .list(c.actor)
      .filter((u) => u.ownerId === c.actor || u.id === crawler?.id)
      .map(sheetOf)
  },
  unit: (
    c: ActContext,
    a: { unitId: string }
  ): (UnitSheet & { ownerName: string | null }) | null => {
    const found = c.room.units.list(c.actor).find((u) => u.id === a.unitId)
    if (found === undefined) return null
    const owner = c.room.roster.members(c.actor).find((m) => m.userId === found.ownerId)
    return { ...sheetOf(found), ownerName: owner?.displayName ?? null }
  },
} satisfies Record<string, (c: ActContext, a: never) => unknown>

function sheetOf(u: UnitSheet): UnitSheet {
  return { id: u.id, kind: u.kind, body: u.body }
}

export type GameActName = keyof typeof GAME_ACTS
type Act<N extends GameActName> = (typeof GAME_ACTS)[N]
export type GameActArgs<N extends GameActName> = Parameters<Act<N>>[1]
export type GameActResult<N extends GameActName> = ReturnType<Act<N>>

/** The acts that change nothing a socket carries. */
export const GAME_READ_ACTS: ReadonlySet<GameActName> = new Set<GameActName>([
  'read',
  'members',
  'invitePreview',
  'inviteCode',
  'units',
  'links',
  'ops.pending',
  'ops.sent',
  'seats.forGame',
  'downtime.state',
  'changeLog.rolls',
  'changeLog.alerts',
  'changeLog.forEntity',
  'mediator.npcs',
  'mediator.amMediator',
  'mediator.running',
  'unitsFor',
  'unit',
  'scenes.current',
  'salvageAreas.here',
  'ledger.get',
  'safety.boundaries',
  'safety.stopSign',
])

/** A refusal the player reads, apart from a defect, which the Worker logs. */
export type GameActAnswer<T> = { ok: true; value: T } | { ok: false; refusal: string }

/** Run one act; a `RoomRefusal` becomes an answer, anything else is a defect and throws. */
export function runAct<N extends GameActName>(
  context: ActContext,
  name: N,
  args: GameActArgs<N>
): GameActAnswer<GameActResult<N>> {
  if (!Object.hasOwn(GAME_ACTS, name)) throw new Error(`No Game act named ${String(name)}`)
  const act = GAME_ACTS[name] as (c: ActContext, a: GameActArgs<N>) => GameActResult<N>
  return answerOrRefuse(() => act(context, args))
}
