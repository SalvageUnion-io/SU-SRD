import { mechMaxHeat, mechMaxSP, pilotMaxAP, pilotMaxHP } from 'salvageunion-reference/rules'

import { ROLL_COLORS, truncate } from './format.js'
import type {
  ChannelResult,
  CrewResult,
  DenialReason,
  EntityBody,
  GameSummary,
  MeResult,
  OwnedEntity,
  SheetResult,
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

const LIMIT = {
  title: 256,
  description: 4096,
  fieldName: 256,
  fieldValue: 1024,
  fields: 25,
} as const

export type EmbedData = {
  title: string
  url?: string
  color: number
  description?: string
  fields: { name: string; value: string; inline: boolean }[]
  footer: string
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

/**
 * A sheet URL, or null when the entity cannot be opened from a browser.
 *
 * Takes the **app-level** id, never the Convex `_id`: `/sheet/$kind/$id`
 * resolves out of IndexedDB by app id, so a URL built from `_id` opens nothing.
 * Null in, null out — a server-created entity nobody has claimed has no local
 * counterpart, and renders as a bare name.
 */
export function sheetUrl(
  webUrl: string,
  table: 'pilots' | 'mechs',
  appId: string | null
): string | null {
  if (appId === null || appId.length === 0) return null
  const kind = table === 'pilots' ? 'pilot' : 'mech'
  return `${webUrl.replace(/\/+$/, '')}/sheet/${kind}/${encodeURIComponent(appId)}`
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
            maybeLink(name(p.body, ['callsign', 'name']), sheetUrl(webUrl, 'pilots', p.appId))
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
          .map((m) => maybeLink(name(m.body, ['name']), sheetUrl(webUrl, 'mechs', m.appId)))
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
function crewFieldValue(pilots: OwnedEntity[], mechs: OwnedEntity[], webUrl: string): string {
  const lines: string[] = []
  for (const pilot of pilots) {
    const stats = pilotStats(pilot.body)
    const dead = stats.maxHp <= 0 || stats.hp === 0
    const pilotName = maybeLink(
      str(pilot.body, 'callsign') ?? 'Pilot',
      sheetUrl(webUrl, 'pilots', pilot.appId)
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
      sheetUrl(webUrl, 'mechs', mech.appId)
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
  type Bucket = { label: string; present: boolean; pilots: OwnedEntity[]; mechs: OwnedEntity[] }

  // Owners in a map, unclaimed in its own variable — rather than one map with a
  // sentinel key. A sentinel has to both sort last and never collide with a
  // user id, and those are two assumptions somebody has to keep true; holding
  // it separately makes "unclaimed renders last, and always renders"
  // structural instead of conventional.
  const owned = new Map<string, Bucket>()
  let unclaimed: Bucket | null = null

  const bucketFor = (entity: OwnedEntity): Bucket => {
    if (entity.ownerId === null) {
      unclaimed ??= { label: UNCLAIMED, present: false, pilots: [], mechs: [] }
      return unclaimed
    }
    const existing = owned.get(entity.ownerId)
    if (existing !== undefined) return existing
    const created: Bucket = {
      label: ownerLabel(entity),
      present: entity.present,
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
    name: truncate(`${bucket.present ? '● ' : ''}${bucket.label}`, LIMIT.fieldName),
    value: truncate(crewFieldValue(bucket.pilots, bucket.mechs, webUrl), LIMIT.fieldValue),
    inline: true,
  }))

  const anyCritical = crew.pilots.some((p) => {
    const stats = pilotStats(p.body)
    return stats.maxHp <= 0 || stats.hp === 0
  })
  const anyWrecked = crew.mechs.some((m) => mechStats(m.body).sp === 0)

  const aboard = owned.size
  const present = [...owned.values()].filter((b) => b.present).length

  return {
    title: truncate(`${crew.game.name} — Crew`, LIMIT.title),
    url: gameUrl(webUrl, crew.game.gameId),
    color: anyCritical || anyWrecked ? CRITICAL : NEUTRAL,
    description:
      fields.length === 0 ? 'Nothing in play yet.' : `${aboard} aboard · ${present} at the table`,
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
      return `${m.present ? '● ' : ''}${m.displayName} — ${roles.join(' · ')}`
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

/** `/su sheet` — a crewmate's sheet, read-only, at a glance. */
export function buildSheetEmbed(sheet: SheetResult, webUrl: string): EmbedData {
  const body = sheet.body
  const owner = sheet.ownerName ?? UNCLAIMED

  const fields: EmbedData['fields'] =
    sheet.table === 'pilots'
      ? (() => {
          const stats = pilotStats(body)
          return [
            { name: 'HP', value: gauge(stats.hp, stats.maxHp), inline: true },
            { name: 'AP', value: gauge(stats.ap, stats.maxAp), inline: true },
            { name: 'Class', value: str(body, 'classRef') ?? '—', inline: true },
          ]
        })()
      : (() => {
          const stats = mechStats(body)
          return [
            { name: 'SP', value: gauge(stats.sp, stats.maxSp), inline: true },
            { name: 'Heat', value: gauge(stats.heat, stats.maxHeat, '▲'), inline: true },
            { name: 'Chassis', value: str(body, 'chassisRef') ?? '—', inline: true },
          ]
        })()

  const name =
    sheet.table === 'pilots' ? (str(body, 'callsign') ?? 'Pilot') : (str(body, 'name') ?? 'Mech')

  const url = sheetUrl(webUrl, sheet.table, sheet.appId)
  return {
    title: truncate(name, LIMIT.title),
    // Omitted rather than dead: an unclaimed entity has nothing to open.
    ...(url === null ? {} : { url }),
    color: NEUTRAL,
    description: `Owned by **${owner}** · read-only`,
    fields,
    footer: FOOTER,
  }
}
