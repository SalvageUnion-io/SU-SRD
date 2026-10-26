import type { EntityKind } from 'game-domain/entityKinds'
import { EncounterSchema } from 'game-domain/schemas/encounter'
import { EncounterNpcSchema } from 'game-domain/schemas/encounterNpc'
import { MechPatternSchema } from 'game-domain/schemas/pattern'
import type { z } from 'salvageunion-reference/zod'
import { fromJson } from '../game/store'
import { parseUnitBody } from '../game/units'
import { RoomRefusal } from '../refusal'
import type { AccountShelf, ShelfRecord } from './shelf'

/**
 * What a player writes on their Shelf that is not an op: the saved patterns,
 * encounters and NPC tray (`records`), who may read each pattern, its
 * Homebrew opt-in (ADR-061), and which of their units anyone with the link
 * may read (ADR-032). Convex's `shelf.*`, `homebrew.setShared` and
 * `publicSheet.setPublic`, by the same names, with the same refusals.
 *
 * The rows the shared database serves follow from these through the room's
 * publisher (`../publish.ts`); nothing here writes them.
 */

/** Who may read a saved pattern: only its maker, anyone with the link, or one Game's crew. */
export type PatternVisibility = 'private' | 'link' | 'game'

/** One pattern's sharing, as the Shelves page's chips and the share dialog read it. */
export type PatternSharing = {
  visibility: PatternVisibility
  gameId: string | null
  gameName: string | null
  builtCount: number
  homebrew: boolean
}

/** What a pattern's `extra` column holds: Convex's columns, as the cutover copies them. */
type PatternExtra = {
  publicRead?: boolean
  sharedAt?: number
  builtCount?: number
  homebrew?: boolean
  gameId?: string | null
  gameName?: string | null
}

/** A tray NPC may be partial (built up over time), but always named. */
const TrayNpcSchema = EncounterNpcSchema.partial().extend({ name: EncounterNpcSchema.shape.name })

const RECORD_SCHEMAS: Record<ShelfRecord, z.ZodType> = {
  patterns: MechPatternSchema,
  encounters: EncounterSchema,
  npcTray: TrayNpcSchema,
}

const GONE = 'That pattern no longer exists'

export class AccountSharing {
  constructor(private readonly shelf: AccountShelf) {}

  private get store() {
    return this.shelf.store
  }

  /**
   * Write one record, addressed by the id in its body: the same write twice
   * is a patch, not a duplicate. A pattern keeps its sharing.
   */
  putRecord(actor: string, table: ShelfRecord, body: unknown, at: number): void {
    this.shelf.requireOwner(actor)
    const id = (body as { id?: unknown } | null)?.id
    if (typeof id !== 'string' || id.length === 0) {
      throw new Error(`[app] a ${table} record must carry a string id in its body`)
    }
    const parsed = RECORD_SCHEMAS[table].safeParse(body)
    if (!parsed.success) {
      throw new Error(`Invalid ${table} payload: ${parsed.error.issues[0]?.message ?? 'unknown'}`)
    }
    this.store.rows(
      `insert into records (tbl, app_id, body, extra, updated_at) values (?, ?, ?, '{}', ?)
       on conflict(tbl, app_id) do update set body = excluded.body, updated_at = excluded.updated_at`,
      table,
      id,
      JSON.stringify(parsed.data),
      at
    )
  }

  /** Delete one record. Absent is success: a delete that races a delete must not fail. */
  removeRecord(actor: string, table: ShelfRecord, id: string): void {
    this.shelf.requireOwner(actor)
    this.store.rows('delete from records where tbl = ? and app_id = ?', table, id)
  }

  /**
   * Who may read one of the player's patterns. Sharing parses the body first,
   * so a pattern its page cannot draw fails here, where its maker is standing;
   * withdrawing the link takes it off the Reference too. `game` is a Game the
   * Worker has found the player in.
   */
  setPatternVisibility(
    actor: string,
    patternId: string,
    visibility: PatternVisibility,
    game: { id: string; name: string } | null,
    at: number
  ): { visibility: PatternVisibility } {
    this.shelf.requireOwner(actor)
    const row = this.pattern(patternId)
    if (visibility === 'game' && game === null) {
      throw new RoomRefusal('Choose which Game to share it with')
    }
    if (visibility !== 'private' && !MechPatternSchema.safeParse(row.body).success) {
      throw new RoomRefusal('This pattern cannot be shared: it is not a whole pattern')
    }
    const { homebrew, ...rest } = row.extra
    const extra: PatternExtra = {
      ...rest,
      publicRead: visibility === 'link',
      ...(visibility === 'link' && homebrew === true ? { homebrew } : {}),
      gameId: visibility === 'game' ? (game?.id ?? null) : null,
      gameName: visibility === 'game' ? (game?.name ?? null) : null,
    }
    if (visibility === 'private') delete extra.sharedAt
    else extra.sharedAt = at
    this.writeExtra(patternId, extra, at)
    return { visibility }
  }

  /** Share a pattern with everyone on the Reference, or stop: only while it is shared by link. */
  setHomebrew(actor: string, patternId: string, shared: boolean, at: number): { shared: boolean } {
    this.shelf.requireOwner(actor)
    const { extra } = this.pattern(patternId)
    if (shared && extra.publicRead !== true) {
      throw new RoomRefusal('Share it with anyone with the link first')
    }
    const { homebrew: _, ...rest } = extra
    this.writeExtra(patternId, shared ? { ...rest, homebrew: true } : rest, at)
    return { shared }
  }

  /**
   * Share one of the player's units by link, or stop. Sharing parses its
   * body first, as a pattern's is.
   */
  setPublic(actor: string, kind: EntityKind, appId: string, isPublic: boolean): boolean {
    const unit = this.shelf.writable(actor, appId)
    if (unit.kind !== kind) throw new RoomRefusal('That entity no longer exists')
    if (isPublic) {
      try {
        parseUnitBody(kind, appId, unit.body)
      } catch {
        throw new RoomRefusal(`This ${kind} cannot be shared publicly: it is not a whole ${kind}`)
      }
    }
    this.store.putUnit({ ...unit, publicRead: isPublic })
    return isPublic
  }

  /** Every pattern's sharing, by its id, for its maker; anyone else reads none. */
  patternSharing(actor: string): { appId: string; sharing: PatternSharing }[] {
    if (this.shelf.owner() !== actor) return []
    return this.store
      .rows("select app_id, extra from records where tbl = 'patterns' order by app_id")
      .map((row) => {
        const extra = fromJson<PatternExtra>(row.extra)
        const gameId = extra.gameId ?? null
        return {
          appId: String(row.app_id),
          sharing: {
            visibility: extra.publicRead === true ? 'link' : gameId !== null ? 'game' : 'private',
            gameId,
            gameName: extra.gameName ?? null,
            builtCount: extra.builtCount ?? 0,
            homebrew: extra.homebrew === true && extra.publicRead === true,
          },
        }
      })
  }

  private pattern(patternId: string): { body: unknown; extra: PatternExtra } {
    const row = this.store.rows(
      "select body, extra from records where tbl = 'patterns' and app_id = ?",
      patternId
    )[0]
    if (row === undefined) throw new RoomRefusal(GONE)
    return { body: fromJson(row.body), extra: fromJson<PatternExtra>(row.extra) }
  }

  private writeExtra(patternId: string, extra: PatternExtra, at: number): void {
    this.store.rows(
      "update records set extra = ?, updated_at = ? where tbl = 'patterns' and app_id = ?",
      JSON.stringify(extra),
      at,
      patternId
    )
  }
}
