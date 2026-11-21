import { GAME_MAX_DESCRIPTION } from 'game-domain/schemas/gamePlan'
import type { UnitParcel } from '../handoff'
import { parcelUnit } from '../leases'
import { RoomRefusal } from '../refusal'
import type { GameRow, GameStore, Member, UnitRow } from './store'
import { bit, fromJson } from './store'
import type { GameUnits } from './units'
import { unitName } from './units'

/**
 * A Game's roster, roles and invite URL (ADR-030 §3 and its invite
 * amendment), and the two ways a Game ends: its Organizer ending it, and its
 * last member deleting their account.
 */

/** A Game as its members read it: its name, their role, and what the table holds. */
export type GameRead = {
  gameId: string
  name: string
  description: string | null
  templateOrigin: string | null
  mediator: boolean
  organizer: boolean
  /** The Mediator, or the Organizer while nobody mediates. */
  tableRunner: boolean
  memberCount: number
  pilotCount: number
  mechCount: number
  /** The primary crawler's name, or null before one exists. */
  crawlerName: string | null
  /** The primary crawler's id, or null before one exists. */
  primaryCrawlerId: string | null
  /**
   * The days the table next meets, soonest first, from yesterday on (a
   * member's own clock picks today's): all of the plan a member is told.
   */
  sessionDays: string[]
  /**
   * A Game made from a template: the units it came with that nobody has
   * changed or been handed (`untouched`), of those still here (`came`).
   * Deleting the Game can take the untouched ones with it (MD2-02).
   */
  templateUnits?: { came: number; untouched: number }
}

/** What a profile shows on a roster, as the member's account room last sent it. */
export type Profile = { displayName: string | null; avatarUrl: string | null }

const DAY_MS = 24 * 60 * 60_000

/** Nobody was handed it and nothing was applied to it: as the template left it. */
const untouched = (unit: UnitRow) => unit.ownerId === null && unit.headSeq === 0

/** The longest name a Game takes: every member's list and the bot show it. */
const GAME_NAME_MAX = 80

/**
 * Where a Game's units go when it ends: each to an account room, under a
 * lease named after the Game and the unit, so a retried ending delivers each
 * one once.
 */
export type Delivery = { to: string; parcel: UnitParcel }

/** The Opposition tray, handed to the Organizer's shelf tray when the Game ends. */
export type TrayDelivery = { to: string; npcs: Record<string, unknown>[] }

/**
 * Crockford base32: 0-9 and A-Z minus I, L, O and U. Sixteen characters, 80
 * bits, as on Convex, so a code minted before the cutover reads the same.
 */
const CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

export function randomInviteCode(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('')
}

/** A code as every door that takes one reads it: trimmed and upper-cased. */
function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase()
}

/** A Game's name as it is kept: trimmed, never blank, never too long. */
function gameName(raw: string): string {
  const name = raw.trim()
  if (name.length === 0) throw new RoomRefusal('A Game needs a name')
  if (name.length > GAME_NAME_MAX) {
    throw new RoomRefusal(`A Game’s name is at most ${GAME_NAME_MAX} characters`)
  }
  return name
}

export class GameRoster {
  constructor(
    private readonly store: GameStore,
    private readonly units: GameUnits,
    private readonly mintCode: () => string = randomInviteCode,
    /** The plan's session days from a day on (`GamePlanStore.sessionDays`). */
    private readonly sessionDays: (from: string) => string[] = () => []
  ) {}

  /**
   * Make this room a new Game. Its creator is the Organizer and plays: a
   * Mediator is chosen after the Game exists. Creating it again is a no-op.
   */
  create(
    actor: string,
    args: { gameId: string; name: string; templateOrigin?: string; profile: Profile; at: number }
  ): void {
    const name = gameName(args.name)
    this.store.sql.transaction(() => {
      if (this.store.game() !== null) return
      this.store.rows(
        'insert into game (id, game_id, name, template_origin, created_at) values (1, ?, ?, ?, ?)',
        args.gameId,
        name,
        args.templateOrigin ?? null,
        args.at
      )
      this.store.putMember({
        userId: actor,
        mediator: false,
        organizer: true,
        joinedAt: args.at,
        ...args.profile,
      })
    })
  }

  /** The Game for one member, or null for anyone else: a non-member cannot tell it exists. */
  read(actor: string, at: number = Date.now()): GameRead | null {
    const game = this.store.game()
    const member = this.store.member(actor)
    if (game === null || member === null) return null
    const primary = this.units.primaryCrawler()
    return {
      gameId: game.gameId,
      name: game.name,
      description: game.description,
      templateOrigin: game.templateOrigin,
      mediator: member.mediator,
      organizer: member.organizer,
      tableRunner: this.store.isTableRunner(member),
      memberCount: this.store.members().length,
      pilotCount: this.store.units('pilot').length,
      mechCount: this.store.units('mech').length,
      crawlerName: primary === null ? null : unitName(primary),
      primaryCrawlerId: primary?.id ?? null,
      sessionDays: this.sessionDays(new Date(at - DAY_MS).toISOString().slice(0, 10)),
      ...(game.templateOrigin === null ? {} : { templateUnits: this.templateUnits(game) }),
    }
  }

  /**
   * The units a template Game came with are those made in its first moment
   * (`seedTemplate` stamps the Game and each unit with one time). One is
   * untouched while it is unassigned and no op has been applied to it: an
   * assignment or an edit each move its head on.
   */
  private templateUnits(game: GameRow): { came: number; untouched: number } {
    const came = this.store.units().filter((unit) => unit.createdAt === game.createdAt)
    return { came: came.length, untouched: came.filter(untouched).length }
  }

  /** The roster, for any member. */
  /**
   * The Game's settings (ADR-067 §3), the Organiser's to change: its name,
   * and the description its invite shows (blank clears it).
   */
  updateSettings(actor: string, patch: { name?: string; description?: string }): void {
    this.store.sql.transaction(() => {
      this.store.requireOrganizer(actor)
      if (patch.name !== undefined) {
        this.store.rows('update game set name = ? where id = 1', gameName(patch.name))
      }
      if (patch.description !== undefined) {
        const description = patch.description.trim()
        if (description.length > GAME_MAX_DESCRIPTION) {
          throw new RoomRefusal(
            `A Game’s description is at most ${GAME_MAX_DESCRIPTION} characters`
          )
        }
        this.store.rows(
          'update game set description = ? where id = 1',
          description === '' ? null : description
        )
      }
    })
  }

  /**
   * Who may take `userId` out of the Game, and what leaves with them: a
   * member leaves on their own word, the Organiser removes anyone else, and
   * the Organiser stays (the Game is theirs to delete). Answers the ids of the
   * member's own pilots and mechs, which go back to their Training Bay before
   * they are forgotten (`forgetMember`); never deleted (ADR-007).
   */
  leaving(actor: string, userId: string): string[] {
    this.store.requireGame()
    if (this.store.member(actor) === null) throw new RoomRefusal('Not a member of this Game')
    const target = this.store.member(userId)
    if (target === null) throw new RoomRefusal('That user is not a member of this Game')
    if (actor !== userId) this.store.requireOrganizer(actor)
    if (target.organizer) {
      throw new RoomRefusal('The Organiser cannot leave their own Game: delete it instead')
    }
    return this.store
      .units()
      .filter((unit) => unit.ownerId === userId && unit.kind !== 'crawler')
      .map((unit) => unit.id)
  }

  members(actor: string): Member[] {
    if (this.store.member(actor) === null) return []
    return this.store.members()
  }

  /** Appoint or stand down a Mediator. Organizer only. */
  setMediator(actor: string, userId: string, mediator: boolean): void {
    this.store.sql.transaction(() => {
      this.store.requireOrganizer(actor)
      const target = this.store.member(userId)
      if (target === null) throw new RoomRefusal('That user is not a member of this Game')
      this.store.rows('update members set mediator = ? where user_id = ?', bit(mediator), userId)
    })
  }

  /** A member's name or avatar changed in their account room. */
  updateProfile(userId: string, profile: Profile): void {
    this.store.rows(
      'update members set display_name = ?, avatar_url = ? where user_id = ?',
      profile.displayName,
      profile.avatarUrl,
      userId
    )
  }

  // --------------------------------------------------------------- invites

  /**
   * The Game's invite code, minted on the first ask. Organizer only. The
   * Worker files each code it hands out against this Game, so `/invite/<code>`
   * finds the room.
   */
  inviteCode(actor: string, at: number): string {
    return this.store.sql.transaction(() => {
      const organizer = this.store.requireOrganizer(actor)
      return this.currentCode() ?? this.mint(organizer.userId, at)
    })
  }

  /** Replace the invite URL: every code stops working, nobody seated is removed. */
  resetInvite(actor: string, at: number): { code: string; revoked: string[] } {
    return this.store.sql.transaction(() => {
      const organizer = this.store.requireOrganizer(actor)
      const revoked = this.store
        .rows('select code from invites where revoked_at is null')
        .map((row) => String(row.code))
      this.store.rows('update invites set revoked_at = ? where revoked_at is null', at)
      return { code: this.mint(organizer.userId, at), revoked }
    })
  }

  /**
   * Join as a player through the invite URL. A member redeeming any code the
   * Game ever had is already in; anyone else needs the current one.
   */
  redeem(actor: string, code: string, profile: Profile, at: number): 'joined' | 'already' {
    return this.store.sql.transaction(() => {
      const game = this.store.requireGame()
      const normalized = normalizeCode(code)
      if (this.store.rows('select 1 from invites where code = ?', normalized).length === 0) {
        throw new RoomRefusal('That invite link is not valid')
      }
      if (this.store.member(actor) !== null) return 'already'
      if (game.disbandingAt !== null || this.currentCode() !== normalized) {
        throw new RoomRefusal('That invite link no longer works')
      }
      this.store.putMember({
        userId: actor,
        mediator: false,
        organizer: false,
        joinedAt: at,
        ...profile,
      })
      return 'joined'
    })
  }

  private currentCode(): string | null {
    const row = this.store.rows(
      'select code from invites where revoked_at is null order by created_at desc, rowid desc limit 1'
    )[0]
    return row === undefined ? null : String(row.code)
  }

  private mint(createdBy: string, at: number): string {
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = this.mintCode()
      if (this.store.rows('select 1 from invites where code = ?', code).length > 0) continue
      this.store.rows(
        'insert into invites (code, created_by, created_at) values (?, ?, ?)',
        code,
        createdBy,
        at
      )
      return code
    }
    throw new Error('No unique invite code after the most attempts allowed')
  }

  // ------------------------------------------------------------ the ending

  /**
   * End the Game. Organizer only, whether or not it has a Mediator (ADR-030
   * §3: it is about the table's existence). Nothing anybody built is
   * destroyed: a held pilot, mech or NPC goes to its holder's Training Bay;
   * an unassigned one, every crawler and the Opposition tray go to the
   * Organizer's. Links, invites, seats, Downtime and the running encounter go
   * with the Game.
   *
   * From the first call the Game refuses every other act, so what it hands
   * back cannot change under the delivery; calling it again answers the same
   * deliveries. The Worker hands each to its account room (an accept per
   * lease, so a retry delivers once), files the tray, then wipes this room.
   *
   * `dropTemplateUnits` (MD2-02): a template Game's untouched units are not
   * delivered, so they end with the room. One somebody was handed or changed
   * is theirs and is always delivered.
   */
  disband(
    actor: string,
    at: number,
    opts: { dropTemplateUnits?: boolean } = {}
  ): { deliveries: Delivery[]; tray: TrayDelivery } {
    return this.store.sql.transaction(() => {
      const game = this.store.requireGame()
      const organizer = this.store.member(actor)
      if (organizer === null) throw new RoomRefusal('Not a member of this Game')
      if (!organizer.organizer) throw new RoomRefusal('Only the Organiser can do that')
      if (game.disbandingAt === null) {
        this.store.rows('update game set disbanding_at = ? where id = 1', at)
      }
      const dropped = (unit: UnitRow) =>
        opts.dropTemplateUnits === true &&
        game.templateOrigin !== null &&
        unit.createdAt === game.createdAt &&
        untouched(unit)
      const kept = this.store.units().filter((unit) => !dropped(unit))
      const deliveries = kept.map((unit) => {
        const to = unit.kind === 'crawler' ? actor : (unit.ownerId ?? actor)
        const parcel: UnitParcel = {
          leaseId: `disband:${game.gameId}:${unit.id}`,
          from: { kind: 'game', gameId: game.gameId },
          unit: { ...parcelUnit(unit), ownerId: to },
          ops: this.store.opsOf(unit.id),
          links: [],
          seat: null,
        }
        return { to, parcel }
      })
      const npcs = this.store
        .rows('select body from tray order by added_at, id')
        .map((row) => fromJson<Record<string, unknown>>(row.body))
      return { deliveries, tray: { to: actor, npcs } }
    })
  }

  /**
   * A member deleted their account: their pilots, mechs and NPCs go with
   * them, as a deletion asks. An Organizer's flag passes to the longest-
   * standing member left. Answers whether the Game is now empty, in which
   * case the Worker wipes the room: nobody is left to return to it.
   */
  forgetMember(userId: string): { empty: boolean } {
    return this.store.sql.transaction(() => {
      const member = this.store.member(userId)
      if (member === null) return { empty: this.store.members().length === 0 }
      for (const unit of this.store.units()) {
        if (unit.ownerId === userId && unit.kind !== 'crawler') this.units.drop(unit)
      }
      this.store.deleteMember(userId)
      const left = this.store.members()
      if (member.organizer && left[0] !== undefined) {
        this.store.putMember({ ...left[0], organizer: true })
      }
      return { empty: left.length === 0 }
    })
  }
}
