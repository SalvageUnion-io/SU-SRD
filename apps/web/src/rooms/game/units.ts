import type { EntityKind } from 'game-domain/entityKinds'
import type { LinkShape } from 'game-domain/links/linkRules'
import {
  CROSS_CONTAINER_REFUSAL,
  conflictingLinks,
  endsMatchType,
  isSlotted,
} from 'game-domain/links/linkRules'
import { UNIT_SCHEMAS } from 'game-domain/ops/applyOp'
import type { ApplyOp, OpInput } from '../ops'
import { RoomRefusal } from '../refusal'
import type { GameStore, Member, StoredOp, UnitRow } from './store'

/**
 * A Game's units and their op logs (ADR-063): creating one, writing it by
 * ops, proposals, assignment, scrapping, and the links between units
 * (ADR-037, ADR-044).
 *
 * In a room every unit has one id, the one its body carries: a Game is its
 * own namespace, so a template pre-gen whose id repeats in every Game made
 * from the template is no longer a special case.
 */

/** The source a Mediator's proposal carries; no client op may. */
export const PROPOSAL_SOURCE = 'mediator-proposal'

/** The source of a ledger pay-out into the crawler (`ledger.ts`). */
export const LEDGER_SOURCE = 'ledger'

/** A body parsed with its kind's schema, carrying `id`; or a defect thrown. */
export function parseUnitBody(
  kind: EntityKind,
  id: string,
  body: unknown
): Record<string, unknown> {
  const result = UNIT_SCHEMAS[kind].safeParse({ ...(body as Record<string, unknown>), id })
  if (!result.success) {
    throw new Error(`Invalid ${kind} payload: ${result.error.issues[0]?.message ?? 'unknown'}`)
  }
  return result.data as Record<string, unknown>
}

/** What a sheet is called on a roster or a proposal: a pilot's callsign first. */
export function unitName(unit: Pick<UnitRow, 'kind' | 'body'>): string | null {
  const fields = unit.kind === 'pilot' ? ['callsign', 'name'] : ['name']
  for (const field of fields) {
    const value = unit.body[field]
    if (typeof value === 'string' && value.trim().length > 0) return value.trim()
  }
  return null
}

const UNASSIGNED = 'That entity is unassigned — it must be assigned before it can be edited'
const NOT_YOURS = "You cannot edit another player's entity"
const LEAVING = 'That is on its way somewhere else; try again in a moment'
const SERVER_ONLY = 'That change can only come from the Game itself'
/** Op sources only the room writes: a proposal (`propose`), an assignment (`reassign`) and a ledger pay-out. */
const SERVER_SOURCES: ReadonlySet<string> = new Set([PROPOSAL_SOURCE, 'ownership', LEDGER_SOURCE])
const ONLINE_ONLY = 'That changes the whole table, so it needs a connection: try it again now'
const CREW_REFUSAL =
  'Only whoever runs the table assigns crawler crew — design an NPC in your Training Bay and move it into this Game to offer it.'
const PAIRED_ELSEWHERE =
  'That Pilot already flies another Mech — whoever holds that Mech or that Pilot has to unassign it first'

/** The answer to a batch of ops: every op applied, or the first one refused and nothing written. */
export type SubmitResult =
  /** `fresh`: the op ids this batch applied; the rest of `applied` had landed before. */
  | { ok: true; applied: { id: string; seq: number }[]; fresh: string[] }
  | { ok: false; opId: string; reason: 'conflict'; fields: string[] }
  | { ok: false; opId: string; reason: 'invalid'; message: string }

type Refused = Extract<SubmitResult, { ok: false }>

/** Thrown inside a batch's transaction to roll it back, and caught outside it. */
export class BatchRefused extends Error {
  constructor(readonly result: Refused) {
    super(result.reason)
  }
}

export class GameUnits {
  constructor(
    private readonly store: GameStore,
    private readonly applyOp: ApplyOp,
    private readonly newId: () => string
  ) {}

  // --------------------------------------------------------------- creating

  /**
   * Create a unit in this Game. A pilot, mech or NPC is the creator's and
   * any member may make one; a pilot or mech goes aboard the primary crawler
   * (ADR-037). A crawler is raised by the table runner, communal from the
   * start, and the first one becomes primary and takes the crew aboard.
   * Creating an id that is already here is a no-op, so a retried create
   * lands once.
   */
  create(actor: string, args: { id: string; kind: EntityKind; body: unknown; at: number }): void {
    this.store.sql.transaction(() => {
      const member =
        args.kind === 'crawler'
          ? this.store.requireTableRunner(actor)
          : this.store.requireMember(actor)
      const existing = this.store.unit(args.id)
      if (existing !== null) {
        if (existing.kind !== args.kind) {
          throw new RoomRefusal(`${args.id} is already a ${existing.kind}`)
        }
        return
      }
      const unit: UnitRow = {
        id: args.id,
        kind: args.kind,
        ownerId: args.kind === 'crawler' ? null : member.userId,
        body: parseUnitBody(args.kind, args.id, args.body),
        headSeq: 0,
        fieldSeqs: {},
        publicRead: false,
        createdAt: args.at,
        updatedAt: args.at,
        leaseId: null,
      }
      this.store.putUnit(unit)
      this.arrived(unit)
    })
  }

  /**
   * A unit just arrived, created here or moved in: a pilot or mech boards
   * the primary crawler, and a crawler may become primary.
   */
  arrived(unit: UnitRow): void {
    if (unit.kind === 'crawler') this.crawlerEntered(unit)
    else if (unit.kind === 'pilot' || unit.kind === 'mech') this.assignToPrimary(unit)
  }

  // ---------------------------------------------------------------- writing

  /**
   * Apply a batch of ops, all or none (ADR-063 §3). One op is a batch of
   * one; a transfer (cargo, scrap) is several units' ops together. Each op
   * answers to its unit's writer: a pilot, mech or NPC's assigned member, a
   * crawler's table runner. An op id already applied is skipped, so a
   * replayed outbox lands nothing twice. A `replayed` batch, sent from the
   * outbox after time offline, may touch only the player's own units: a
   * player plays their own units offline, and the crawler, like every other
   * Game-wide act, waits for a connection.
   */
  submit(actor: string, ops: readonly OpInput[], { replayed = false } = {}): SubmitResult {
    return this.applyBatch(actor, ops, (input) => {
      if (SERVER_SOURCES.has(input.source)) throw new RoomRefusal(SERVER_ONLY)
      const unit = this.store.requireUnit(input.unitId)
      this.assertMayWrite(actor, unit)
      if (replayed && unit.ownerId !== actor) throw new RoomRefusal(ONLINE_ONLY)
      return unit
    })
  }

  /**
   * Apply a batch of ops as `actor`'s, all or none: each new op's unit is
   * `writable`'s, which refuses one the actor may not write. An op id already
   * applied is skipped.
   */
  applyBatch(
    actor: string,
    ops: readonly OpInput[],
    writable: (input: OpInput) => UnitRow
  ): SubmitResult {
    try {
      return this.store.sql.transaction(() => {
        const applied: { id: string; seq: number }[] = []
        const fresh: string[] = []
        for (const input of ops) {
          const seen = this.store.op(input.id)
          if (seen !== null) {
            if (seen.unitId !== input.unitId) {
              throw new RoomRefusal(`Op ${input.id} names another unit`)
            }
            if (seen.seq !== null) applied.push({ id: seen.id, seq: seen.seq })
            continue
          }
          applied.push({ id: input.id, seq: this.applyTo(writable(input), input, actor) })
          fresh.push(input.id)
        }
        return { ok: true, applied, fresh } as const
      })
    } catch (error) {
      if (error instanceof BatchRefused) return error.result
      throw error
    }
  }

  /** Run `input` through `applyOp` and store the op and the new snapshot, or refuse the batch. */
  applyTo(unit: UnitRow, input: OpInput, author: string, reason?: string): number {
    const result = this.applyOp(this.store.asUnit(unit), input)
    if (!result.ok) {
      throw new BatchRefused(
        result.reason === 'conflict'
          ? { ok: false, opId: input.id, reason: 'conflict', fields: result.fields }
          : { ok: false, opId: input.id, reason: 'invalid', message: result.message }
      )
    }
    this.store.putOp({
      ...input,
      author,
      state: 'applied',
      seq: result.seq,
      before: result.before,
      ...(reason === undefined ? {} : { reason }),
      supersededBy: null,
    })
    this.store.putUnit({
      ...unit,
      body: result.unit.body,
      headSeq: result.seq,
      fieldSeqs: result.unit.fieldSeqs,
      updatedAt: input.at,
    })
    return result.seq
  }

  /**
   * Who may write a unit: a crawler's table runner (ADR-038 §5), and
   * otherwise only the member it is assigned to. There is deliberately no
   * path for the Mediator to write a player's sheet; that is a proposal.
   */
  assertMayWrite(actor: string, unit: UnitRow): Member {
    if (unit.leaseId !== null) throw new RoomRefusal(LEAVING)
    if (unit.kind === 'crawler') return this.store.requireTableRunner(actor)
    const member = this.store.requireMember(actor)
    if (unit.ownerId === actor) return member
    throw new RoomRefusal(unit.ownerId === null ? UNASSIGNED : NOT_YOURS)
  }

  /**
   * Share a unit by link, or stop (ADR-032): a crawler's table runner, else
   * its holder. An unassigned unit cannot be shared but can always be
   * withdrawn, so a link is never left up that nobody may take down. Sharing
   * parses the body first, so a sheet its page cannot draw fails here.
   */
  setPublic(actor: string, kind: EntityKind, unitId: string, isPublic: boolean): boolean {
    return this.store.sql.transaction(() => {
      const unit = this.store.requireUnit(unitId)
      if (unit.kind !== kind) throw new RoomRefusal('That entity no longer exists')
      if (isPublic || unit.kind === 'crawler' || unit.ownerId !== null) {
        this.assertMayWrite(actor, unit)
      } else {
        this.store.requireMember(actor)
      }
      if (isPublic) {
        try {
          parseUnitBody(kind, unitId, unit.body)
        } catch {
          throw new RoomRefusal(`This ${kind} cannot be shared publicly: it is not a whole ${kind}`)
        }
      }
      this.store.putUnit({ ...unit, publicRead: isPublic })
      return isPublic
    })
  }

  /** Every unit, for any member to read. Non-members read nothing (ADR-030 §5). */
  list(actor: string): UnitRow[] {
    if (this.store.member(actor) === null) return []
    return this.store.units()
  }

  /** The Game's wiring, for any member. */
  links(actor: string): LinkShape[] {
    if (this.store.member(actor) === null) return []
    return this.store.links()
  }

  /** One unit's op log, newest first, for its Change Log. */
  history(actor: string, unitId: string): StoredOp[] {
    if (this.store.member(actor) === null) return []
    return this.store.opsOf(unitId).reverse()
  }

  // ------------------------------------------------------------- assignment

  /**
   * Assign a pilot or mech to a member (`userId`, the caller when absent).
   * Any member takes a free one for themselves; only the table runner
   * assigns to someone else or takes one a crewmate holds (ADR-055).
   * Assigning moves nothing and touches no link.
   */
  assign(actor: string, unitId: string, at: number, userId?: string): void {
    this.store.sql.transaction(() => {
      const unit = this.ownable(unitId)
      const member = this.store.requireMember(actor)
      const assignee = userId ?? actor
      if (unit.ownerId === assignee) return
      const self = assignee === actor
      if ((!self || unit.ownerId !== null) && !this.store.isTableRunner(member)) {
        throw new RoomRefusal(
          self
            ? 'A crewmate already holds that — it has to be unassigned before anyone else can take it'
            : 'Only the Mediator can assign that to somebody else'
        )
      }
      if (!self && this.store.member(assignee) === null) {
        throw new RoomRefusal('They are not in this Game')
      }
      this.reassign(unit, assignee, actor, at)
    })
  }

  /** Hand back what is assigned to you, or (table runner) unassign anyone's. It stays here. */
  unassign(actor: string, unitId: string, at: number): void {
    this.store.sql.transaction(() => {
      const unit = this.ownable(unitId)
      if (unit.ownerId === null) return
      const member = this.store.requireMember(actor)
      if (unit.ownerId !== actor && !this.store.isTableRunner(member)) {
        throw new RoomRefusal('Only its holder or the Mediator can unassign this')
      }
      this.reassign(unit, null, actor, at)
    })
  }

  private ownable(unitId: string): UnitRow {
    const unit = this.store.requireUnit(unitId)
    if (unit.kind !== 'pilot' && unit.kind !== 'mech') {
      throw new Error(`A ${unit.kind} is not assigned to a member`)
    }
    if (unit.leaseId !== null) throw new RoomRefusal(LEAVING)
    return unit
  }

  /**
   * Put a new holder on a unit, logged as an op on it so its history reads
   * whole (ADR-063 §7). The op moves the head but no body field, so it
   * conflicts with nobody's edit.
   */
  reassign(unit: UnitRow, ownerId: string | null, author: string, at: number): void {
    const seq = unit.headSeq + 1
    this.store.putOp({
      id: this.newId(),
      unitId: unit.id,
      baseSeq: unit.headSeq,
      at,
      kind: 'transaction',
      source: 'ownership',
      patch: { ownerId },
      author,
      state: 'applied',
      seq,
      before: { ownerId: unit.ownerId },
      supersededBy: null,
    })
    this.store.putUnit({ ...unit, ownerId, headSeq: seq, updatedAt: at })
  }

  // -------------------------------------------------------------- removing

  /**
   * Delete a pilot, mech or NPC (its holder only), or scrap a crawler (the
   * table runner, the mirror of raising it). Its links and seat go with it,
   * and a mech leaves whoever was aboard on foot.
   */
  remove(actor: string, unitId: string): void {
    this.store.sql.transaction(() => {
      const unit = this.store.unit(unitId)
      if (unit === null) return
      this.assertMayWrite(actor, unit)
      this.drop(unit)
    })
  }

  /** Take a unit out of this Game with everything that points at it. */
  drop(unit: UnitRow): void {
    this.store.deleteUnit(unit.id)
    this.store.deleteLinksTouching(unit.id)
    if (unit.kind === 'pilot') this.store.rows('delete from seats where pilot_id = ?', unit.id)
    if (unit.kind === 'mech') this.standUp(unit.id)
    if (unit.kind === 'crawler') this.crawlerLeft(unit.id)
  }

  /** Every seat boarded in `mechId`, back on foot, its resolve dropped. */
  standUp(mechId: string): void {
    this.store.rows(
      `update seats set mount = '{"kind":"foot"}', resolving = null
       where json_extract(mount, '$.kind') = 'boarded' and json_extract(mount, '$.mechId') = ?`,
      mechId
    )
  }

  // ------------------------------------------------------------------ links

  /**
   * Draw a link (ADR-037). Permission comes from the `from` end: you may
   * link out of a unit you may write. A crew link is the crawler's writer's
   * to draw (ADR-044). Drawing replaces the links it conflicts with; another
   * player's mech flying this pilot is replaced only by that mech's or the
   * pilot's holder. An end that is not here is a link for another place, and
   * draws nothing.
   */
  drawLink(actor: string, link: LinkShape): void {
    if (!endsMatchType(link)) {
      throw new Error(`A ${link.type} link cannot join ${link.from.type} → ${link.to.type}`)
    }
    if (isSlotted(link.type) !== (link.slot !== undefined)) {
      throw new Error(`A ${link.type} link ${isSlotted(link.type) ? 'names' : 'has no'} crew slot`)
    }
    this.store.sql.transaction(() => {
      const from = this.store.unit(link.from.id)
      const to = this.store.unit(link.to.id)
      if (isSlotted(link.type)) {
        if (from === null || to === null) return
        this.assertMayCrew(actor)
        if (link.slot === undefined || !crawlerHasSlot(to.body, link.slot)) {
          throw new RoomRefusal('That crawler has no such crew slot.')
        }
        this.writeLink(link)
        return
      }
      if (from === null) return
      this.assertMayWrite(actor, from)
      if (to === null) throw new RoomRefusal(CROSS_CONTAINER_REFUSAL)
      this.writeLink(link, (conflict) => {
        if (conflict.from.id === link.from.id || to.ownerId === actor) return
        const otherMech = this.store.unit(conflict.from.id)
        if (otherMech === null || otherMech.ownerId === actor) return
        throw new RoomRefusal(PAIRED_ELSEWHERE)
      })
    })
  }

  /** Unwire a link: whoever may draw it. Already gone is not an error. */
  removeLink(actor: string, link: LinkShape): void {
    this.store.sql.transaction(() => {
      if (isSlotted(link.type)) {
        if (this.store.unit(link.to.id) === null) {
          const npc = this.store.unit(link.from.id)
          if (npc !== null) this.assertMayWrite(actor, npc)
        } else {
          this.assertMayCrew(actor)
        }
      } else {
        const from = this.store.unit(link.from.id)
        if (from === null) return
        this.assertMayWrite(actor, from)
      }
      this.store.deleteLink(link)
    })
  }

  private assertMayCrew(actor: string): void {
    const member = this.store.member(actor)
    if (member === null || !this.store.isTableRunner(member)) throw new RoomRefusal(CREW_REFUSAL)
  }

  /** Store `link`, first deleting every link it conflicts with (`mayReplace` may refuse one). */
  writeLink(link: LinkShape, mayReplace?: (conflict: LinkShape) => void): void {
    for (const conflict of conflictingLinks(this.store.links(), link)) {
      mayReplace?.(conflict)
      this.store.deleteLink(conflict)
    }
    this.store.putLink(link)
  }

  // ---------------------------------------------------------- the crawlers

  /** The primary crawler: the stored one while it is here, else the oldest, else none (ADR-037). */
  primaryCrawler(): UnitRow | null {
    const crawlers = this.store.units('crawler')
    const stored = this.store.game()?.primaryCrawlerId
    return crawlers.find((c) => c.id === stored) ?? crawlers[0] ?? null
  }

  /** Name the primary crawler. Table runner only; it moves nobody. */
  setPrimaryCrawler(actor: string, crawlerId: string): void {
    this.store.sql.transaction(() => {
      this.store.requireTableRunner(actor)
      if (this.store.unit(crawlerId)?.kind !== 'crawler') {
        throw new RoomRefusal('That crawler is not in this Game')
      }
      this.store.setPrimaryCrawlerId(crawlerId)
    })
  }

  /** Aboard the primary crawler, in place of any crawler link the unit had. */
  private assignToPrimary(unit: UnitRow): void {
    const primary = this.primaryCrawler()
    if (primary === null) return
    this.linkToCrawler(unit, primary)
  }

  private linkToCrawler(unit: UnitRow, crawler: UnitRow): void {
    const kind = unit.kind === 'pilot' ? 'pilot' : 'mech'
    this.writeLink({
      from: { type: kind, id: unit.id },
      to: { type: 'crawler', id: crawler.id },
      type: kind === 'pilot' ? 'pilot-to-crawler' : 'mech-to-crawler',
    })
  }

  /**
   * A crawler arrived. With no other crawler here it becomes primary and
   * takes aboard every pilot and mech without a crawler; otherwise the
   * current primary is written down, so a later arrival never reshuffles it.
   */
  private crawlerEntered(crawler: UnitRow): void {
    const crawlers = this.store.units('crawler').filter((c) => c.id !== crawler.id)
    const stored = this.store.game()?.primaryCrawlerId
    const current = crawlers.find((c) => c.id === stored) ?? crawlers[0] ?? null
    if (current !== null) {
      if (stored !== current.id) this.store.setPrimaryCrawlerId(current.id)
      return
    }
    this.store.setPrimaryCrawlerId(crawler.id)
    const links = this.store.links()
    for (const unit of [...this.store.units('pilot'), ...this.store.units('mech')]) {
      const type = unit.kind === 'pilot' ? 'pilot-to-crawler' : 'mech-to-crawler'
      if (!links.some((l) => l.type === type && l.from.id === unit.id)) {
        this.linkToCrawler(unit, crawler)
      }
    }
  }

  /** A crawler left: if it was primary, the oldest left takes over. Nobody is reassigned. */
  private crawlerLeft(crawlerId: string): void {
    if (this.store.game()?.primaryCrawlerId !== crawlerId) return
    const next = this.store.units('crawler').find((c) => c.id !== crawlerId)
    this.store.setPrimaryCrawlerId(next?.id ?? null)
  }
}

/** Whether a crawler body has the slot: the bay installed, or a type chosen. */
export function crawlerHasSlot(
  body: Record<string, unknown>,
  slot: NonNullable<LinkShape['slot']>
) {
  if (slot.kind === 'type') return typeof body.type === 'string' && body.type.length > 0
  const bays = body.crawlerBays
  return (
    Array.isArray(bays) && bays.some((bay) => (bay as { bayRef?: unknown })?.bayRef === slot.bayRef)
  )
}
