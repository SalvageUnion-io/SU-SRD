import type { SURefEnumSchemaName } from 'salvageunion-reference'
import { findEntityBySlug, getAssetUrl, getEntitySlug, srdEntityUrl } from 'salvageunion-reference'
import { mechMaxHeat, mechMaxSP, pilotMaxAP, pilotMaxHP } from 'salvageunion-reference/rules'
import { EMBED_LIMIT, ROLL_COLORS, truncate } from './format.js'
import type {
  ChannelResult,
  CrewResult,
  DenialReason,
  EntityBody,
  GameSummary,
  MeResult,
  OwnedEntity,
  SheetResult,
  SheetTable,
  ShelfResult,
} from './itun/types.js'

/**
 * Embed builders for the ITUN Game commands (ADR-030 Phase 6).
 *
 * Pure `data → EmbedData`, no discord.js — the same split `lookupEmbed.ts`
 * uses, for the same reason: every one of these is unit-testable without a
 * Discord client, a network, or a mock.
 *
 * ## Where the numbers come from
 *
 * Convex stores entity bodies opaquely and **cannot** compute a maximum: max
 * HP, SP and Heat derive from class and chassis data that lives in
 * `salvageunion-reference`, which the server does not have. The bot does — it
 * preloads the whole dataset at startup — so it derives them here (ADR-006:
 * rules math lives in the package, never re-implemented at a call site).
 *
 * Every read off a body is defensive. The body is `v.any()` on the server by
 * design, so a missing or wrong-typed field must render as "—" rather than
 * throw inside a slash command.
 */

/** Neutral SU rust. Informational embeds are always this. */
const NEUTRAL = 0xb7410e

/**
 * The one sanctioned deviation from rust (see the plan, §7 rule 4).
 *
 * Reused rather than invented: `theme.css` states that damaged/destroyed state
 * and the bot's roll outcomes share ONE warm ramp, and `cascade` is its
 * most-destroyed end. A bot-only hue here would fork a palette the design
 * system deliberately unified.
 */
const CRITICAL = ROLL_COLORS.cascade

/**
 * Shared with `lookupEmbed.ts` via `format.ts`. This module used to declare its
 * own, omitting `footer` and `total` — so nothing here enforced the 6000-char
 * ceiling, and an oversized embed would have been rejected by Discord with a
 * 400 rather than trimmed. Harmless while these embeds were three fields long;
 * not harmless now that a sheet renders its whole collection list.
 */
const LIMIT = EMBED_LIMIT

export type EmbedData = {
  title: string
  url?: string
  color: number
  description?: string
  fields: { name: string; value: string; inline: boolean }[]
  footer: string
  /**
   * Absolute URL of a small image shown top-right.
   *
   * Always a remote `https://` URL — the artwork CDN — never an attachment, so
   * no bytes pass through the worker. Undefined when the entity has no artwork,
   * which is the common case; an entity without art omits the field rather than
   * rendering a broken image.
   */
  thumbnail?: string
}

const FOOTER = 'In The Union Now'

/**
 * Read a number off an opaque body, trying each name in order.
 *
 * Several names rather than one, because the field names below are a **cross-
 * workspace contract that nothing checks at build time**: the Zod schemas in
 * `apps/itun/src/lib/schemas/` are the source of truth, Convex stores the body
 * as `v.any()`, and the bot cannot import those schemas. A misspelling here
 * therefore compiles, passes any test written from the same misspelling, and
 * renders a confidently wrong number.
 *
 * That is not hypothetical. `crew.vitals` shipped reading `currentHp` while the
 * schema defines `currentHP`, so **every vital on the Mediator's crew strip was
 * null** and rendered as an em-dash indistinguishable from an undamaged crew
 * (found and fixed in #656). This code was written from that same wrong
 * spelling.
 *
 * So reads are salvage-tolerant, exactly as ITUN's own data layer is: the
 * canonical name is tried first and the historical variant second. Being
 * tolerant costs one array lookup; being wrong costs a table a session.
 */
function num(body: EntityBody, ...keys: string[]): number | null {
  for (const key of keys) {
    const value = body[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
  }
  return null
}

/** Read a string off an opaque body, or null when absent/blank/not a string. */
function str(body: EntityBody, key: string): string | null {
  const value = body[key]
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

function strArray(body: EntityBody, key: string): string[] {
  const value = body[key]
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
}

/**
 * A proportional gauge, e.g. `██████░░░░ 6/10`.
 *
 * Width tracks the real maximum up to ten segments so small SU values (AP 5,
 * Heat 6) read as exact ticks rather than as a scaled approximation, and only
 * larger ones (a heavily-modified mech's SP) compress. Ten is the ceiling
 * because these sit in a Discord inline field, which is roughly a third of the
 * embed width on desktop and much less on a phone.
 *
 * Renders in Discord's PROPORTIONAL font, so these do not align across columns.
 * That is why the crew board gives every crewmate their own inline field —
 * within one field the bars are the same glyph count and read as aligned; no
 * code fence is needed, and none is used, because a fence would cost links and
 * colour for an alignment nothing here depends on.
 */
export function gauge(current: number | null, max: number | null, filledGlyph = '█'): string {
  if (max === null || max <= 0) {
    return current === null ? '—' : String(current)
  }
  const safeCurrent = Math.max(0, Math.min(current ?? 0, max))
  const width = Math.min(max, 10)
  const filled = Math.round((safeCurrent / max) * width)
  const bar = filledGlyph.repeat(filled) + '░'.repeat(Math.max(0, width - filled))
  return `${bar} ${current ?? 0}/${max}`
}

/** The narrow view of a pilot body the derivation functions need. */
function pilotStats(body: EntityBody): {
  hp: number | null
  maxHp: number
  ap: number | null
  maxAp: number
} {
  const input = {
    abilities: strArray(body, 'abilities'),
    injuries: Array.isArray(body.injuries) ? (body.injuries as never) : [],
    maxHpModifier: num(body, 'maxHpModifier') ?? undefined,
    maxApModifier: num(body, 'maxApModifier') ?? undefined,
    maxHpOverride: num(body, 'maxHpOverride') ?? undefined,
    maxApOverride: num(body, 'maxApOverride') ?? undefined,
  }
  const maxHp = pilotMaxHP(input)
  const maxAp = pilotMaxAP(input)
  return {
    // Canonical spellings come from apps/itun/src/lib/schemas/{pilot,mech}.ts.
    // ABSENT MEANS FULL, not zero — the field is only written once something
    // has changed it, and all 35 call sites in the app read it as `?? max`.
    // Defaulting to 0 instead would render a fresh, undamaged crew as wiped
    // out, which is precisely backwards on the one surface built to show it.
    hp: num(body, 'currentHP', 'currentHp') ?? maxHp,
    maxHp,
    ap: num(body, 'currentAP', 'currentAp') ?? maxAp,
    maxAp,
  }
}

/** The narrow view of a mech body the derivation functions need. */
function mechStats(body: EntityBody): {
  sp: number | null
  maxSp: number
  heat: number | null
  maxHeat: number
} {
  const input = {
    chassisRef: str(body, 'chassisRef') ?? '',
    systems: strArray(body, 'systems'),
    modules: strArray(body, 'modules'),
    maxSpModifier: num(body, 'maxSpModifier') ?? undefined,
    maxHeatModifier: num(body, 'maxHeatModifier') ?? undefined,
    maxSpOverride: num(body, 'maxSpOverride') ?? undefined,
    maxHeatOverride: num(body, 'maxHeatOverride') ?? undefined,
  }
  const maxSp = mechMaxSP(input)
  return {
    // Absent SP means full, as above.
    sp: num(body, 'currentSP', 'currentSp') ?? maxSp,
    maxSp,
    // Heat is the exception and reads the other way: absent means COLD, which
    // is 0. A mech starts at no heat and gains it, where SP starts full and is
    // lost — so the same "field not written yet" state means opposite numbers.
    heat: num(body, 'currentHeat') ?? 0,
    maxHeat: mechMaxHeat(input),
  }
}

/** ADR-030: an entity with no owner is a STATE, never a blank. */
const UNCLAIMED = 'Unclaimed'

export function ownerLabel(entity: OwnedEntity): string {
  if (entity.ownerId === null) return UNCLAIMED
  return entity.ownerName ?? 'Crewmate'
}

/**
 * Web URLs. The glance lives in Discord; the surface lives in the app.
 *
 * Both mirror real TanStack routes — `/games/$gameId` and `/sheet/$kind/$id`.
 * A link that 404s is worse than no link: it reads as the app having lost the
 * thing, rather than as the bot having guessed.
 */
export function gameUrl(webUrl: string, gameId: string): string {
  return `${webUrl.replace(/\/+$/, '')}/games/${encodeURIComponent(gameId)}`
}

/** `pilots` → `pilot`. The web routes speak singular; the tables speak plural. */
function kindOf(table: SheetTable): string {
  if (table === 'pilots') return 'pilot'
  return table === 'mechs' ? 'mech' : 'crawler'
}

/**
 * The public, account-free URL for a sheet — or null when it has none.
 *
 * Null is the common case and the safe default. `publicRead` is opt-in per
 * entity (ADR-032), so a sheet nobody has published has no public page at all
 * and this must not invent one: `/p/…` for an unpublished entity renders "this
 * sheet isn't available", so linking it would advertise a dead page.
 *
 * Addressed by `appId` rather than the Convex row id, which is what the route
 * takes and what this payload already carries.
 */
export function publicSheetUrl(
  webUrl: string,
  table: SheetTable,
  appId: string | null,
  publicRead: boolean | undefined
): string | null {
  if (publicRead !== true) return null
  if (appId === null || appId.length === 0) return null
  return `${webUrl.replace(/\/+$/, '')}/p/${kindOf(table)}/${encodeURIComponent(appId)}`
}

/**
 * A link to **your own** entity, or null when there is nothing to open.
 *
 * Takes the **app-level** id, never the Convex `_id`: `/sheet/$kind/$id`
 * resolves out of IndexedDB by app id, so a URL built from `_id` opens nothing.
 * Null in, null out — a server-created entity nobody has claimed has no local
 * counterpart, and renders as a bare name.
 *
 * Correct **only** for the shelf, where the reader and the owner are the same
 * person and the entity is therefore in the reader's own browser. For anything
 * belonging to a crewmate use {@link gameSheetUrl}.
 */
export function shelfSheetUrl(
  webUrl: string,
  table: SheetTable,
  appId: string | null
): string | null {
  if (appId === null || appId.length === 0) return null
  return `${webUrl.replace(/\/+$/, '')}/sheet/${kindOf(table)}/${encodeURIComponent(appId)}`
}

/**
 * A link to a **crewmate's** entity: the read-only Game view.
 *
 * This route is addressed by the Convex row id precisely because the viewer has
 * no local copy of somebody else's build, and it is the only one that resolves
 * for them. The crew board and `/su sheet` both previously linked
 * `/sheet/$kind/$appId` instead, which reads the clicker's own IndexedDB — so
 * every link the bot handed a crewmate opened an entity they do not have.
 * Nothing errored; the page simply had nothing to show.
 */
export function gameSheetUrl(
  webUrl: string,
  gameId: string | null | undefined,
  table: SheetTable,
  entityId: string | null | undefined
): string | null {
  // Tolerant of an absent id rather than typed-and-trusted: this is a network
  // payload, and `itun/types.ts` states the rule for exactly this reason — a
  // field the server stops sending must degrade to "no link", never throw
  // inside a slash command. A deployment running an older `botClient` sends no
  // `gameId` at all.
  if (typeof gameId !== 'string' || gameId.length === 0) return null
  if (typeof entityId !== 'string' || entityId.length === 0) return null
  const base = webUrl.replace(/\/+$/, '')
  return `${base}/games/${encodeURIComponent(gameId)}/view/${kindOf(table)}/${encodeURIComponent(entityId)}`
}

/** `name` as a markdown link when there is somewhere to go, else bare. */
function maybeLink(name: string, url: string | null): string {
  return url === null ? name : `[${name}](${url})`
}

/**
 * What to say when a call was denied.
 *
 * Every one of these is rendered **ephemerally**, which is what makes it safe
 * to be specific: an ephemeral reply is visible only to the person who asked,
 * so naming the reason leaks nothing to the channel while still explaining
 * itself. A command that silently does nothing is the worst of the options.
 */
export function denialMessage(
  reason: DenialReason,
  webUrl: string,
  serverMessage?: string
): string {
  // For `forbidden` and `not-found` the SERVER knows the specifics and this
  // module does not: "that channel is already bound to another game" is a very
  // different thing to be told than "binding is the Organizer's job", and a
  // generic line here would actively mislead. The reasons below are the ones
  // where the bot adds something the server cannot — a sign-in link, the name
  // of the command that fixes it — so those keep their own wording.
  if ((reason === 'forbidden' || reason === 'not-found') && serverMessage) {
    return serverMessage
  }

  switch (reason) {
    case 'unlinked':
      return [
        '**You don’t have an In The Union Now account yet.**',
        '',
        'Sign in with this same Discord account and the bot will recognise you here',
        'automatically — there’s nothing to copy across and no code to enter.',
        '',
        `${webUrl.replace(/\/+$/, '')}/account`,
      ].join('\n')
    case 'unbound':
      return [
        '**This channel isn’t bound to a game.**',
        '',
        'An Organizer can bind it with `/su game bind`.',
      ].join('\n')
    case 'not-a-member':
      return 'You’re not a member of the game bound to this channel.'
    case 'forbidden':
      return 'You don’t have permission to do that. Binding a channel is the Organizer’s job.'
    case 'not-found':
      return 'That could not be found in this channel’s game.'
  }
}

function roleLabel(game: { mediator: boolean; organizer: boolean }): string {
  const roles = [game.mediator ? 'Mediator' : 'Player']
  if (game.organizer) roles.push('Organizer')
  return roles.join(' · ')
}

function gameLines(games: GameSummary[], webUrl: string, currentGameId?: string): string {
  if (games.length === 0) return '_No games yet._'
  return games
    .map((game) => {
      const here = game.gameId === currentGameId ? '  ← this channel' : ''
      return `[${game.name}](${gameUrl(webUrl, game.gameId)}) — ${roleLabel(game)}${here}`
    })
    .join('\n')
}

/** `/su me` — who the bot thinks you are, and what you are part of. */
export function buildMeEmbed(me: MeResult, webUrl: string, currentGameId?: string): EmbedData {
  return {
    title: truncate(`${me.user.displayName} — In The Union Now`, LIMIT.title),
    url: `${webUrl.replace(/\/+$/, '')}/account`,
    color: NEUTRAL,
    description: 'Linked at sign-in. Discord is the only way in, so this is always current.',
    fields: [
      {
        name: `Your games (${me.games.length})`,
        value: truncate(gameLines(me.games, webUrl, currentGameId), LIMIT.fieldValue),
        inline: false,
      },
    ],
    footer: FOOTER,
  }
}

/** `/su games` — every Game you belong to. */
export function buildGamesEmbed(games: GameSummary[], webUrl: string): EmbedData {
  return {
    title: `Your games (${games.length})`,
    url: `${webUrl.replace(/\/+$/, '')}/games`,
    color: NEUTRAL,
    description: truncate(gameLines(games, webUrl), LIMIT.description),
    fields: [],
    footer: FOOTER,
  }
}

/** `/su shelf` — what you own that is not in play. */
export function buildShelfEmbed(shelf: ShelfResult, webUrl: string): EmbedData {
  const name = (body: EntityBody, keys: string[]): string => {
    for (const key of keys) {
      const value = str(body, key)
      if (value !== null) return value
    }
    return 'Unnamed'
  }

  const fields: EmbedData['fields'] = []
  if (shelf.pilots.length > 0) {
    fields.push({
      name: `Pilots (${shelf.pilots.length})`,
      value: truncate(
        shelf.pilots
          .map((p) =>
            maybeLink(name(p.body, ['callsign', 'name']), shelfSheetUrl(webUrl, 'pilots', p.appId))
          )
          .join('\n'),
        LIMIT.fieldValue
      ),
      inline: true,
    })
  }
  if (shelf.mechs.length > 0) {
    fields.push({
      name: `Mechs (${shelf.mechs.length})`,
      value: truncate(
        shelf.mechs
          .map((m) => maybeLink(name(m.body, ['name']), shelfSheetUrl(webUrl, 'mechs', m.appId)))
          .join('\n'),
        LIMIT.fieldValue
      ),
      inline: true,
    })
  }

  return {
    title: 'On your shelf',
    url: `${webUrl.replace(/\/+$/, '')}/`,
    color: NEUTRAL,
    description:
      fields.length === 0
        ? 'Nothing on your shelf — everything you own is in a game.'
        : 'Entities you own that are in no game.',
    fields,
    footer: FOOTER,
  }
}

/** One crewmate's block on the crew board: their pilots, then their mechs. */
function crewFieldValue(
  pilots: OwnedEntity[],
  mechs: OwnedEntity[],
  webUrl: string,
  gameId: string
): string {
  const lines: string[] = []
  for (const pilot of pilots) {
    const stats = pilotStats(pilot.body)
    const dead = stats.maxHp <= 0 || stats.hp === 0
    const pilotName = maybeLink(
      str(pilot.body, 'callsign') ?? 'Pilot',
      gameSheetUrl(webUrl, gameId, 'pilots', pilot.id)
    )
    lines.push(`**${pilotName}**${dead ? ' ✖' : ''}`)
    lines.push(`HP ${gauge(stats.hp, stats.maxHp)}`)
    lines.push(`AP ${gauge(stats.ap, stats.maxAp)}`)
  }
  for (const mech of mechs) {
    const stats = mechStats(mech.body)
    const destroyed = stats.sp === 0
    const overheated = stats.heat !== null && stats.maxHeat > 0 && stats.heat >= stats.maxHeat
    const mechName = maybeLink(
      str(mech.body, 'name') ?? 'Mech',
      gameSheetUrl(webUrl, gameId, 'mechs', mech.id)
    )
    lines.push(`${mechName}${destroyed ? ' ✖' : ''}`)
    lines.push(`SP ${gauge(stats.sp, stats.maxSp)}`)
    lines.push(`HT ${gauge(stats.heat, stats.maxHeat, '▲')}${overheated ? ' ⚠' : ''}`)
  }
  return lines.length > 0 ? lines.join('\n') : '_Nothing yet._'
}

/**
 * `/su crew` — the reason to build any of this.
 *
 * Grouped by owner, one inline field each, so Discord lays them out in columns
 * of three and each crewmate reads as a unit. The unclaimed bucket is rendered
 * last and labelled, never omitted.
 */
export function buildCrewEmbed(crew: CrewResult, webUrl: string): EmbedData {
  type Bucket = { label: string; pilots: OwnedEntity[]; mechs: OwnedEntity[] }

  // Owners in a map, unclaimed in its own variable — rather than one map with a
  // sentinel key. A sentinel has to both sort last and never collide with a
  // user id, and those are two assumptions somebody has to keep true; holding
  // it separately makes "unclaimed renders last, and always renders"
  // structural instead of conventional.
  const owned = new Map<string, Bucket>()
  let unclaimed: Bucket | null = null

  const bucketFor = (entity: OwnedEntity): Bucket => {
    if (entity.ownerId === null) {
      unclaimed ??= { label: UNCLAIMED, pilots: [], mechs: [] }
      return unclaimed
    }
    const existing = owned.get(entity.ownerId)
    if (existing !== undefined) return existing
    const created: Bucket = {
      label: ownerLabel(entity),
      pilots: [],
      mechs: [],
    }
    owned.set(entity.ownerId, created)
    return created
  }

  for (const pilot of crew.pilots) bucketFor(pilot).pilots.push(pilot)
  for (const mech of crew.mechs) bucketFor(mech).mechs.push(mech)

  const ordered = [...owned.values()].sort((a, b) => a.label.localeCompare(b.label))
  // Appended, so it is last without depending on how anything sorts.
  if (unclaimed !== null) ordered.push(unclaimed)

  const fields = ordered.slice(0, LIMIT.fields).map((bucket) => ({
    name: truncate(bucket.label, LIMIT.fieldName),
    value: truncate(
      crewFieldValue(bucket.pilots, bucket.mechs, webUrl, crew.game.gameId),
      LIMIT.fieldValue
    ),
    inline: true,
  }))

  const anyCritical = crew.pilots.some((p) => {
    const stats = pilotStats(p.body)
    return stats.maxHp <= 0 || stats.hp === 0
  })
  const anyWrecked = crew.mechs.some((m) => mechStats(m.body).sp === 0)

  const aboard = owned.size

  return {
    title: truncate(`${crew.game.name} — Crew`, LIMIT.title),
    url: gameUrl(webUrl, crew.game.gameId),
    color: anyCritical || anyWrecked ? CRITICAL : NEUTRAL,
    description: fields.length === 0 ? 'Nothing in play yet.' : `${aboard} aboard`,
    fields,
    footer: FOOTER,
  }
}

/** `/su game info` — what this channel's table is. */
export function buildChannelEmbed(channel: ChannelResult, webUrl: string): EmbedData {
  const crew = channel.members
    .map((m) => {
      const roles = [m.mediator ? 'Mediator' : 'Player']
      if (m.organizer) roles.push('Organizer')
      return `${m.displayName} — ${roles.join(' · ')}`
    })
    .join('\n')

  const fields: EmbedData['fields'] = [
    {
      name: `Crew (${channel.members.length})`,
      value: truncate(crew.length > 0 ? crew : '_Nobody yet._', LIMIT.fieldValue),
      inline: false,
    },
  ]

  if (channel.downtime.running) {
    fields.push({
      name: 'Downtime',
      value: truncate(
        [
          `Step ${(channel.downtime.stepIndex ?? 0) + 1}`,
          `${channel.downtime.completed} of ${channel.members.length} done`,
          channel.downtime.upkeepSpent ? 'upkeep spent' : 'upkeep outstanding',
        ].join(' · '),
        LIMIT.fieldValue
      ),
      inline: false,
    })
  }

  return {
    title: truncate(channel.game.name, LIMIT.title),
    url: gameUrl(webUrl, channel.game.gameId),
    color: NEUTRAL,
    description: 'This channel is bound to this game.',
    fields,
    footer: FOOTER,
  }
}

/**
 * One accent per sheet, mirroring `.sheet--{pilot,mech,crawler}` in
 * `component-lib`'s `theme.css` (`--color-sheet-*`).
 *
 * This is a deliberate amendment to "colour carries one meaning only, and that
 * meaning is rust". The strip down an embed's left edge is the one thing
 * Discord renders that a sheet also has, and spending it on the sheet's own
 * accent is what makes the card read as *a sheet* rather than as another bot
 * reply. `CRITICAL` still wins wherever both apply — a wrecked mech is a
 * wrecked mech before it is a mech.
 */
const SHEET_ACCENT = {
  pilots: 0xef894f,
  mechs: 0x7a978a,
  crawlers: 0xce5898,
} as const

/** What a sheet renderer produces, before the shared shell is wrapped round it. */
type RenderedSheet = {
  name: string
  /** Italic identity line — class/chassis/tech level — or '' for none. */
  subtitle: string
  fields: EmbedData['fields']
  thumbnail?: string
  critical: boolean
}

/**
 * Resolve one SRD slug to a linked name.
 *
 * Entity bodies store slugs (`classRef: 'salvager'`, `systems: ['armour-
 * plating']`) and never copies of game data, so a sheet that prints them raw
 * shows `armour-plating` where the book says *Armour Plating*. The bot already
 * has the whole dataset in memory — it preloads at startup — so resolving is a
 * map lookup, not a fetch.
 *
 * Falls back to the bare slug rather than dropping the row: a slug the dataset
 * does not know is still something the player put on their sheet, and hiding it
 * would make the embed disagree with the app about what they own.
 */
function refLink(schemaName: SURefEnumSchemaName, slug: string): string {
  const entity = findEntityBySlug(schemaName, slug)
  if (entity === null) return slug
  return `[${entity.name}](${srdEntityUrl(schemaName, getEntitySlug(entity))})`
}

/** A resolved display name, or the slug when the dataset does not know it. */
function refName(schemaName: SURefEnumSchemaName, slug: string | null): string {
  if (slug === null) return '—'
  return findEntityBySlug(schemaName, slug)?.name ?? slug
}

/**
 * Artwork URL for a slug, or undefined.
 *
 * `getAssetUrl` derives it from schema name + slug and returns undefined unless
 * the entity is flagged `hasArtwork`, so an entity without art omits the
 * thumbnail rather than pointing Discord at a 404.
 */
function refArtwork(schemaName: SURefEnumSchemaName, slug: string | null): string | undefined {
  if (slug === null) return undefined
  const entity = findEntityBySlug(schemaName, slug)
  return entity === null ? undefined : getAssetUrl(entity)
}

/** Item condition as stored per-slug on a mech body. */
type ItemCondition = 'intact' | 'damaged' | 'destroyed'

function conditionOf(body: EntityBody, key: string, slug: string): ItemCondition {
  const map = body[key]
  if (map === null || typeof map !== 'object') return 'intact'
  const value = (map as Record<string, unknown>)[slug]
  return value === 'damaged' || value === 'destroyed' ? value : 'intact'
}

/**
 * One collection rendered as lines, condition markers included.
 *
 * Damaged and destroyed gear is the difference between a sheet and a roster —
 * it is what a table actually asks about mid-session — so it rides on the line
 * rather than being dropped. Destroyed is struck through, which is the closest
 * Discord gets to the card treatment ADR-009 defines.
 */
function collectionLines(
  slugs: string[],
  schemaName: SURefEnumSchemaName,
  body?: EntityBody,
  conditionKey?: string
): string {
  if (slugs.length === 0) return '_None._'
  return slugs
    .map((slug) => {
      const link = refLink(schemaName, slug)
      if (body === undefined || conditionKey === undefined) return link
      const condition = conditionOf(body, conditionKey, slug)
      if (condition === 'damaged') return `${link} · damaged`
      if (condition === 'destroyed') return `~~${link}~~ · destroyed`
      return link
    })
    .join('\n')
}

/**
 * Pilot abilities, grouped by ability tree exactly as the live sheet groups
 * them under its dashed sub-slabs.
 *
 * Faithfulness is the reason, and the field cap is the dividend: a Salvager may
 * take twelve abilities, and twelve worst-case linked names run past Discord's
 * 1024-character-per-field limit. One field per tree keeps each comfortably
 * under it without inventing a pagination scheme the sheet does not have.
 */
function abilityFields(slugs: string[]): EmbedData['fields'] {
  if (slugs.length === 0) {
    return [{ name: 'Abilities', value: '_None yet._', inline: false }]
  }
  const byTree = new Map<string, string[]>()
  for (const slug of slugs) {
    const entity = findEntityBySlug('abilities', slug)
    const tree =
      entity !== null && typeof (entity as { tree?: unknown }).tree === 'string'
        ? (entity as { tree: string }).tree
        : 'Other'
    const bucket = byTree.get(tree)
    if (bucket === undefined) byTree.set(tree, [slug])
    else bucket.push(slug)
  }
  return [...byTree.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([tree, treeSlugs]) => ({
      name: `${tree} — ${treeSlugs.length} known`,
      value: collectionLines(treeSlugs, 'abilities'),
      inline: false,
    }))
}

/** A `·`-joined run of chips, or null when there are none to show. */
function chipRun(values: string[]): string | null {
  const kept = values.filter((v) => v.trim().length > 0)
  return kept.length > 0 ? kept.join(' · ') : null
}

/** Identity band + vitals rail + Abilities + Inventory. */
function pilotSheet(body: EntityBody): RenderedSheet {
  const stats = pilotStats(body)
  const classRef = str(body, 'classRef')
  const fields: EmbedData['fields'] = [
    { name: 'HP', value: gauge(stats.hp, stats.maxHp), inline: true },
    { name: 'AP', value: gauge(stats.ap, stats.maxAp), inline: true },
    { name: 'Class', value: refName('classes', classRef), inline: true },
  ]

  fields.push(...abilityFields(strArray(body, 'abilities')))

  const equipment = strArray(body, 'equipment')
  fields.push({
    name: `Inventory — ${equipment.length}`,
    value: collectionLines(equipment, 'equipment'),
    inline: false,
  })

  const conditions = chipRun(strArray(body, 'conditions'))
  if (conditions !== null) {
    fields.push({ name: 'Conditions', value: conditions, inline: true })
  }

  const level = num(body, 'crawlerLevel')
  const subtitleParts = [refName('classes', classRef)]
  if (level !== null) subtitleParts.push(`Crawler Level ${level}`)
  const motto = str(body, 'motto')

  return {
    name: str(body, 'callsign') ?? str(body, 'name') ?? 'Pilot',
    subtitle: `*${subtitleParts.join(' · ')}*${motto === null ? '' : `\n> ${motto}`}`,
    fields,
    thumbnail: refArtwork('classes', classRef),
    // Max HP of zero is the app's own "killed in action" condition.
    critical: stats.maxHp <= 0 || stats.hp === 0,
  }
}

/** Identity band + vitals rail + Systems + Modules + The Hold. */
function mechSheet(body: EntityBody): RenderedSheet {
  const stats = mechStats(body)
  const chassisRef = str(body, 'chassisRef')
  const fields: EmbedData['fields'] = [
    { name: 'SP', value: gauge(stats.sp, stats.maxSp), inline: true },
    { name: 'Heat', value: gauge(stats.heat, stats.maxHeat, '▲'), inline: true },
    { name: 'Chassis', value: refName('chassis', chassisRef), inline: true },
  ]

  const systems = strArray(body, 'systems')
  fields.push({
    name: `Systems — ${systems.length}`,
    value: collectionLines(systems, 'systems', body, 'systemConditions'),
    inline: false,
  })

  const modules = strArray(body, 'modules')
  fields.push({
    name: `Modules — ${modules.length}`,
    value: collectionLines(modules, 'modules', body, 'moduleConditions'),
    inline: false,
  })

  const status = chipRun([
    body.shutdown === true ? 'Shutdown' : '',
    body.vulnerable === true ? 'Vulnerable' : '',
    body.destroyed === true ? 'Destroyed' : '',
    ...strArray(body, 'conditions'),
  ])
  if (status !== null) fields.push({ name: 'Status', value: status, inline: true })

  const quirk = str(body, 'quirk')
  return {
    name: str(body, 'name') ?? 'Mech',
    subtitle: `*${refName('chassis', chassisRef)}*${quirk === null ? '' : `\n> ${quirk}`}`,
    fields,
    thumbnail: refArtwork('chassis', chassisRef),
    critical: body.destroyed === true || stats.sp === 0,
  }
}

/**
 * Identity band + Bays + Scrap Pool.
 *
 * Bays are `{ bayRef }` objects rather than bare slugs, which is why this reads
 * them structurally instead of through `strArray`.
 */
function crawlerSheet(body: EntityBody): RenderedSheet {
  const typeRef = str(body, 'typeRef') ?? str(body, 'type')
  const techLevel = str(body, 'techLevel')
  const fields: EmbedData['fields'] = []

  const sp = num(body, 'currentSP', 'currentSp')
  const maxSp = num(body, 'maxSpOverride')
  fields.push({
    name: 'SP',
    value: maxSp === null ? (sp === null ? '—' : String(sp)) : gauge(sp, maxSp),
    inline: true,
  })
  fields.push({ name: 'Tech Level', value: techLevel ?? '—', inline: true })

  const bayRefs = Array.isArray(body.crawlerBays)
    ? (body.crawlerBays as unknown[]).flatMap((bay) => {
        if (bay === null || typeof bay !== 'object') return []
        const ref = (bay as { bayRef?: unknown }).bayRef
        return typeof ref === 'string' ? [ref] : []
      })
    : []
  fields.push({
    name: `Bays — ${bayRefs.length}`,
    value: collectionLines(bayRefs, 'crawler-bays'),
    inline: false,
  })

  const systems = strArray(body, 'systems')
  if (systems.length > 0) {
    fields.push({
      name: `Armament — ${systems.length}`,
      value: collectionLines(systems, 'systems'),
      inline: false,
    })
  }

  const pool = body.scrapPool
  if (pool !== null && typeof pool === 'object') {
    const entries = Object.entries(pool as Record<string, unknown>)
      .filter(([, v]) => typeof v === 'number' && v > 0)
      .map(([tier, v]) => `${tier.toUpperCase()} ×${String(v)}`)
    const run = chipRun(entries)
    if (run !== null) fields.push({ name: 'Scrap Pool', value: run, inline: false })
  }

  const subtitleParts = [refName('crawlers', typeRef)]
  if (techLevel !== null) subtitleParts.push(`Tech Level ${techLevel}`)

  return {
    name: str(body, 'name') ?? 'Crawler',
    subtitle: `*${subtitleParts.join(' · ')}*`,
    fields,
    thumbnail: refArtwork('crawlers', typeRef),
    critical: sp === 0,
  }
}

/**
 * `/su sheet` — a crewmate's sheet, folded into an embed.
 *
 * The live sheet is an identity band (fields beside a vitals rail) followed by
 * a stack of section slabs, each led by a stamp title and a count. An embed is
 * a title, a description, and fields that sit three-across or full width. Those
 * are the same structure, so the mapping is deliberate and one-to-one:
 *
 * - identity band fields   → description
 * - vitals rail            → inline fields, one gauge each
 * - section slab + count   → one full-width field, count in the field NAME
 * - a `ReferenceEntityCard` → one line, linked to the reference site
 * - sheet accent           → embed colour strip
 * - reserved image seat    → thumbnail
 *
 * The one concession to the medium is the vitals rail, which is a vertical
 * stack on the sheet and a three-across row here. The crew board already reads
 * that way, so it is consistent rather than novel.
 */
export function buildSheetEmbed(sheet: SheetResult, webUrl: string): EmbedData {
  const body = sheet.body
  const owner = sheet.ownerName ?? UNCLAIMED

  const rendered =
    sheet.table === 'pilots'
      ? pilotSheet(body)
      : sheet.table === 'mechs'
        ? mechSheet(body)
        : crawlerSheet(body)

  const fields = rendered.fields
  const name = rendered.name

  // Only when the owner has actually published it. A sheet with no public URL
  // gets no Share field at all — not a disabled one, and not a link that 404s.
  const publicUrl = publicSheetUrl(webUrl, sheet.table, sheet.appId, sheet.publicRead)
  if (publicUrl !== null) {
    // Inserted after the vitals rail rather than appended, because
    // `enforceEmbedLimits` sheds from the END. Appended, this would be the
    // FIRST thing dropped on a large sheet — a Salvager with many ability
    // trees, a fully-fitted crawler — and it would be counted in the "N
    // sections omitted" notice as though it were a section of the sheet. The
    // one link that works without an account should not be the one that goes.
    const afterVitals = fields.findIndex((f) => !f.inline)
    fields.splice(afterVitals === -1 ? fields.length : afterVitals, 0, {
      name: 'Share',
      value: `[Public sheet](${publicUrl}) — always current, no account needed`,
      inline: false,
    })
  }

  const url = gameSheetUrl(webUrl, sheet.gameId, sheet.table, sheet.id)
  // The crawler is communal — it has no owner to name, and saying "Unclaimed"
  // would report a missing owner rather than an absent concept (ADR-030 §5).
  const provenance =
    sheet.table === 'crawlers' ? 'Communal · read-only' : `Owned by **${owner}** · read-only`
  const description = [rendered.subtitle, provenance].filter((line) => line.length > 0).join('\n')

  return {
    title: truncate(name, LIMIT.title),
    // Omitted rather than dead: an unclaimed entity has nothing to open.
    ...(url === null ? {} : { url }),
    color: rendered.critical ? CRITICAL : SHEET_ACCENT[sheet.table],
    description,
    fields,
    footer: FOOTER,
    ...(rendered.thumbnail === undefined ? {} : { thumbnail: rendered.thumbnail }),
  }
}
