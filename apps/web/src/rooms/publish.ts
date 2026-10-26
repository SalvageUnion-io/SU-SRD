import type { EntityKind } from 'game-domain/entityKinds'
import type { LinkShape } from 'game-domain/links/linkRules'
import type { GameStore, UnitRow } from './game/store'
import { fromJson } from './game/store'

/**
 * What a room publishes to the shared database (ADR-032, ADR-061): one row
 * per thing its owner shared by link, and one per pattern also shared on the
 * Reference. Worked out here, with the room's links and names in reach, so
 * the Worker serves the rows as written (`../worker/shared/publicSheets.ts`)
 * and decides nothing. The rules are Convex's `publicSheet.get`, `.pattern`
 * and `.preview`, and `homebrew.patterns`.
 *
 * - **One container.** A room's units are one Shelf or one Game, so every
 *   link end found in it is in the same container (ADR-037).
 * - **Withheld by kind.** A linked unit that is not shared itself is named by
 *   its kind alone, never its id or name.
 * - **Never a unit on its way out.** A leased unit is the room it is going
 *   to's to publish, so the two never write its row at once.
 */

type PublishedKind = EntityKind | 'pattern'

/** One shared thing's row: its page as a stranger reads it, and its link preview. */
export type PublishedSheet = {
  kind: PublishedKind
  appId: string
  ownerId: string | null
  page: unknown
  preview: {
    kind: PublishedKind
    body: unknown
    ownerName: string | null
    gameName: string | null
    mechChassisRef?: string | null
  }
}

/** One pattern listed on the Reference as Homebrew. */
export type PublishedPattern = {
  appId: string
  ownerId: string
  chassisRef: string | null
  name: string
  body: unknown
  madeBy: string
  sharedAt: number | null
}

/** Everything one room publishes. */
export type Published = { sheets: PublishedSheet[]; homebrew: PublishedPattern[] }

/** Whose room it is, a Game (by name) or a Shelf (by its player), and each person's display name. */
type PublishContext = {
  place: { kind: 'game'; name: string } | { kind: 'shelf'; owner: string }
  nameOf: (discordId: string) => string | null
}

const KIND_NAMES: Record<EntityKind, string> = {
  pilot: 'Pilot',
  mech: 'Mech',
  crawler: 'Crawler',
  npc: 'NPC',
}

/** A pilot by callsign then name, anything else by name: `entityNameOf`'s rule. */
function unitName(kind: EntityKind, body: Record<string, unknown>): string {
  for (const field of kind === 'pilot' ? ['callsign', 'name'] : ['name']) {
    const value = body[field]
    if (typeof value === 'string' && value.trim().length > 0) return value.trim()
  }
  return KIND_NAMES[kind]
}

/** What an account room publishes: its player's shared units and patterns; nothing before it is claimed. */
export function shelfPublished(store: GameStore): Published {
  const account = store.rows('select discord_id, display_name from account where id = 1')[0]
  if (account === undefined) return { sheets: [], homebrew: [] }
  const owner = String(account.discord_id)
  const name = account.display_name === null ? null : String(account.display_name)
  return published(store, {
    place: { kind: 'shelf', owner },
    nameOf: (discordId) => (discordId === owner ? name : null),
  })
}

/** What a Game room publishes: its shared units, named by its roster; nothing once it is wiped. */
export function gamePublished(store: GameStore): Published {
  const game = store.game()
  if (game === null) return { sheets: [], homebrew: [] }
  return published(store, {
    place: { kind: 'game', name: game.name },
    nameOf: (discordId) => store.member(discordId)?.displayName ?? null,
  })
}

/** Every shared unit's row, and, on a Shelf, every shared pattern's and Homebrew listing. */
function published(store: GameStore, context: PublishContext): Published {
  const units = new Map(store.units().map((unit) => [unit.id, unit]))
  const sheets: PublishedSheet[] = []
  for (const unit of units.values()) {
    if (!unit.publicRead || unit.leaseId !== null) continue
    sheets.push(sheetOf(store, units, unit, context))
  }
  const { patterns, homebrew } =
    context.place.kind === 'shelf'
      ? patternsOf(store, context.place.owner, context)
      : { patterns: [], homebrew: [] }
  return { sheets: [...sheets, ...patterns], homebrew }
}

function sheetOf(
  store: GameStore,
  units: Map<string, UnitRow>,
  unit: UnitRow,
  context: PublishContext
): PublishedSheet {
  const links: LinkShape[] = []
  const linked = new Map<string, { kind: EntityKind; id: string; name: string; body: unknown }>()
  const withheld = new Map<string, { kind: EntityKind }>()
  for (const link of store.linksTouching(unit.id)) {
    const far = link.from.id === unit.id ? link.to : link.from
    // An NPC's crew link is its own page's, not the crawler's (ADR-044).
    if (far.type === 'npc') continue
    const target = units.get(far.id)
    if (target === undefined || target.kind !== far.type) continue
    const key = `${far.type}:${far.id}`
    if (target.publicRead) {
      links.push({ type: link.type, from: link.from, to: link.to })
      linked.set(key, {
        kind: target.kind,
        id: target.id,
        name: unitName(target.kind, target.body),
        body: target.body,
      })
    } else {
      withheld.set(key, { kind: target.kind })
    }
  }
  const ownerName = unit.ownerId === null ? null : context.nameOf(unit.ownerId)
  return {
    kind: unit.kind,
    appId: unit.id,
    ownerId: unit.ownerId,
    page: {
      kind: unit.kind,
      appId: unit.id,
      body: unit.body,
      ...(unit.kind === 'mech'
        ? { pilotAbilities: pilotAbilities(store, units, unit, context.place.kind === 'game') }
        : {}),
      ...(unit.kind === 'npc' ? { madeBy: ownerName ?? 'a player' } : {}),
      links,
      linked: [...linked.values()],
      withheld: [...withheld.values()],
    },
    preview: {
      kind: unit.kind,
      body: unit.body,
      ownerName,
      gameName: context.place.kind === 'game' ? context.place.name : null,
      ...(unit.kind === 'pilot' ? { mechChassisRef: sharedMechOf(store, units, unit) } : {}),
    },
  }
}

/**
 * The abilities of the pilot flying this mech, for its maxima (ADR-029):
 * passed on when the pilot is the mech owner's own, unassigned in the same
 * Game, or shared itself, so a link drawn to a stranger's pilot reads none.
 */
function pilotAbilities(
  store: GameStore,
  units: Map<string, UnitRow>,
  mech: UnitRow,
  inGame: boolean
): string[] {
  const link = store
    .linksTouching(mech.id)
    .find((l) => l.type === 'mech-to-pilot' && l.from.id === mech.id)
  const pilot = link === undefined ? undefined : units.get(link.to.id)
  if (pilot === undefined || pilot.kind !== 'pilot') return []
  const sameOwner = pilot.ownerId !== null && pilot.ownerId === mech.ownerId
  const unassignedInGame = pilot.ownerId === null && inGame
  if (!sameOwner && !unassignedInGame && !pilot.publicRead) return []
  const abilities = pilot.body.abilities
  return Array.isArray(abilities) ? abilities.filter((a): a is string => typeof a === 'string') : []
}

/** A pilot's mech, as its chassis slug, only when that mech is shared itself. */
function sharedMechOf(
  store: GameStore,
  units: Map<string, UnitRow>,
  pilot: UnitRow
): string | null {
  for (const link of store.linksTouching(pilot.id)) {
    if (link.type !== 'mech-to-pilot') continue
    const far = link.from.id === pilot.id ? link.to : link.from
    const mech = units.get(far.id)
    if (mech === undefined || mech.kind !== 'mech' || !mech.publicRead) continue
    const chassisRef = mech.body.chassisRef
    if (typeof chassisRef === 'string' && chassisRef.length > 0) return chassisRef
  }
  return null
}

type PatternExtra = {
  publicRead?: boolean
  sharedAt?: number
  builtCount?: number
  homebrew?: boolean
}

/**
 * A Shelf's shared patterns: by link, a page and a preview; on the Reference
 * too, a Homebrew listing (held only while shared by link). A Game room
 * keeps no patterns.
 */
function patternsOf(
  store: GameStore,
  ownerId: string,
  context: PublishContext
): { patterns: PublishedSheet[]; homebrew: PublishedPattern[] } {
  const madeBy = context.nameOf(ownerId) ?? 'a player'
  const patterns: PublishedSheet[] = []
  const homebrew: PublishedPattern[] = []
  const rows = store.rows(
    "select app_id, body, extra from records where tbl = 'patterns' order by app_id"
  )
  for (const row of rows) {
    const extra = fromJson<PatternExtra>(row.extra)
    if (extra.publicRead !== true) continue
    const appId = String(row.app_id)
    const body = fromJson<Record<string, unknown>>(row.body)
    const sharedAt = extra.sharedAt ?? null
    patterns.push({
      kind: 'pattern',
      appId,
      ownerId,
      page: {
        appId,
        body,
        madeBy,
        sharedAt,
        builtCount: extra.builtCount ?? 0,
        mine: false,
        visibility: null,
      },
      preview: { kind: 'pattern', body, ownerName: madeBy, gameName: null },
    })
    if (extra.homebrew !== true) continue
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    homebrew.push({
      appId,
      ownerId,
      chassisRef: typeof body.chassisRef === 'string' ? body.chassisRef : null,
      name: name.length > 0 ? name : 'Unnamed',
      body,
      madeBy,
      sharedAt,
    })
  }
  return { patterns, homebrew }
}
