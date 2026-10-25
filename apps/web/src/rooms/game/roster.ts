import type { UnitParcel } from '../handoff'
import { RoomRefusal } from '../refusal'
import type { GameStore, Member } from './store'
import { bit } from './store'
import type { GameUnits } from './units'
import { unitName } from './units'

/**
 * A Game's roster, roles and invite URL (ADR-030 §3 and its invite
 * amendment), and the two ways a Game ends: its Organizer ending it, and its
 * last member deleting their account. The rules are `convex/games.ts`,
 * `invites.ts` and `account.deleteAccount`'s, unchanged.
 */

/** A Game as its members read it: its name, their role, and what the table holds. */
export type GameRead = {
  gameId: string
  name: string
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
}

/** What a profile shows on a roster, as the member's account room last sent it. */
export type Profile = { displayName: string | null; avatarUrl: string | null }

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

export class GameRoster {
  constructor(
    private readonly store: GameStore,
    private readonly units: GameUnits,
    private readonly mintCode: () => string = randomInviteCode
  ) {}

  /**
   * Make this room a new Game. Its creator is the Organizer and plays: a
   * Mediator is chosen after the Game exists. Creating it again is a no-op.
   */
  create(
    actor: string,
    args: { gameId: string; name: string; templateOrigin?: string; profile: Profile; at: number }
  ): void {
    const name = args.name.trim()
    if (name.length === 0) throw new RoomRefusal('A Game needs a name')
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
  read(actor: string): GameRead | null {
    const game = this.store.game()
    const member = this.store.member(actor)
    if (game === null || member === null) return null
    const primary = this.units.primaryCrawler()
    return {
      gameId: game.gameId,
      name: game.name,
      templateOrigin: game.templateOrigin,
      mediator: member.mediator,
      organizer: member.organizer,
      tableRunner: this.store.isTableRunner(member),
      memberCount: this.store.members().length,
      pilotCount: this.store.units('pilot').length,
      mechCount: this.store.units('mech').length,
      crawlerName: primary === null ? null : unitName(primary),
    }
  }

  /** The roster, for any member. */
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

  /** What a code is for, without spending it, or null for one that opens nothing. */
  invitePreview(code: string): { gameName: string; invitedBy: string } | null {
    const game = this.store.game()
    if (game === null || game.disbandingAt !== null) return null
    const invite = this.store.rows('select * from invites where code = ?', normalizeCode(code))[0]
    if (invite === undefined || this.currentCode() !== invite.code) return null
    const inviter = this.store.member(String(invite.created_by))
    return { gameName: game.name, invitedBy: inviter?.displayName ?? 'the Organiser' }
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
   */
  disband(actor: string, at: number): { deliveries: Delivery[]; tray: TrayDelivery } {
    return this.store.sql.transaction(() => {
      const game = this.store.requireGame()
      const organizer = this.store.member(actor)
      if (organizer === null) throw new RoomRefusal('Not a member of this Game')
      if (!organizer.organizer) throw new RoomRefusal('Only the Organiser can do that')
      if (game.disbandingAt === null) {
        this.store.rows('update game set disbanding_at = ? where id = 1', at)
      }
      const deliveries = this.store.units().map((unit) => {
        const to = unit.kind === 'crawler' ? actor : (unit.ownerId ?? actor)
        const parcel: UnitParcel = {
          leaseId: `disband:${game.gameId}:${unit.id}`,
          from: { kind: 'game', gameId: game.gameId },
          unit: {
            id: unit.id,
            kind: unit.kind,
            ownerId: to,
            body: unit.body,
            headSeq: unit.headSeq,
            fieldSeqs: unit.fieldSeqs,
            publicRead: unit.publicRead,
          },
          ops: this.store.opsOf(unit.id),
          links: [],
          seat: null,
        }
        return { to, parcel }
      })
      const npcs = this.store
        .rows('select body from tray order by added_at, id')
        .map((row) => JSON.parse(String(row.body)) as Record<string, unknown>)
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
