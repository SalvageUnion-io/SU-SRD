import { gamePath, kindOf, publicPath, sheetPath } from 'game-domain/entityKinds'
import { PRODUCT } from 'game-domain/product'
import type { ItemCondition, RefEnumSchemaName } from 'salvageunion-reference'
import {
  CONDITION_LABELS,
  DISCORD_NEUTRAL_ACCENT,
  DISCORD_ROLL_ACCENT,
  discordAccent,
  findEntityBySlug,
  getAssetUrl,
  getEntitySlug,
  SRD_SITE_URL,
  STAT_LABELS,
  srdEntityUrl,
} from 'salvageunion-reference'
import { crawlerMaxSP, resolveGauge, resolvePool } from 'salvageunion-reference/rules'
import type { BodyKey } from './bodyRead'
import { num, str, strArray } from './bodyRead'
import type { CardField, ContainerData } from './container'
import { entityCard } from './container'
import type {
  DenialReason,
  EntityBody,
  GameSummary,
  MechDerived,
  MeResult,
  PilotDerived,
  SheetResult,
  SheetTable,
} from './play/types'

/**
 * Card builders for the Cantina commands (ADR-030).
 *
 * Pure `data → ContainerData` through `entityCard`, the same render layer
 * `lookupCard.ts` uses: every one of these is unit-testable without a Discord
 * client, a network, or a mock.
 *
 * ## Where the numbers come from
 *
 * A pilot's and a mech's maxima and status are the SERVER's: `/su sheet`
 * carries them as `SheetResult.vitals`, the same derivation `crew.vitals`
 * serves Play's Crew (ADR-038 §4), so the bot never disagrees
 * with the app about a crewmate. A deployment older than that field sends
 * none, and the vitals then show their current values alone. The crawler is
 * not crew and the server derives nothing for it, so its max SP is still
 * worked out here (`crawlerMaxSP`).
 *
 * Every read off a body is defensive. The body is `v.any()` on the server by
 * design, so a missing or wrong-typed field must render as "—" rather than
 * throw inside a slash command.
 */

/**
 * The one sanctioned deviation from rust.
 *
 * Reused rather than invented: `theme.css` states that damaged/destroyed state
 * and the bot's roll outcomes share ONE warm ramp, and `cascade` is its
 * most-destroyed end. A bot-only hue here would fork a palette the design
 * system deliberately unified.
 */
const CRITICAL = DISCORD_ROLL_ACCENT.cascade

/**
 * Where In The Union Now is served, base included: the production origin's
 * `/build` (ADR-048). Cards link back here by appending a route; it only
 * ever builds a URL, never a request. Old intheunionnow.com links 301 here.
 */
export const CANTINA_ORIGIN = `${SRD_SITE_URL}/build`

const FOOTER = PRODUCT.name

/** The stats' full names, from the reference vocabulary (a gauge is Heat, not its capacity). */
const HP = STAT_LABELS.hitPoints.label
const SP = STAT_LABELS.structurePoints.label
const HEAT = STAT_LABELS.heatCapacity.short
const TL = 'Tech Level'

/**
 * How a vital renders: `bars` puts a glyph bar after the number, `text` is the
 * number alone. Text is the form a screen reader reads cleanly — ten block
 * glyphs are ten announcements.
 */
export type GaugeStyle = 'bars' | 'text'

/**
 * A vital as its number, then a proportional bar, e.g. `6/10 ██████░░░░`.
 *
 * The number comes first because it is the answer ("how bad is it") and the bar
 * only a glance; a screen reader reaches it before the glyphs, and the `text`
 * style drops the glyphs altogether.
 *
 * Width tracks the real maximum up to ten segments so small SU values (AP 5,
 * Heat 6) read as exact ticks rather than as a scaled approximation, and only
 * larger ones (a heavily-modified mech's SP) compress. Ten is the ceiling
 * because a gauge shares its line with a label and has to fit a phone.
 *
 * Renders in Discord's PROPORTIONAL font. Within one crewmate's lines the bars
 * are the same glyph count and read as aligned; no code fence is needed, and
 * none is used, because a fence would cost links for an alignment nothing here
 * depends on.
 */
export function gauge(
  current: number | null,
  max: number | null,
  filledGlyph = '█',
  style: GaugeStyle = 'bars'
): string {
  if (max === null || max <= 0) {
    return current === null ? '—' : String(current)
  }
  const value = `${current ?? 0}/${max}`
  if (style === 'text') return value
  const safeCurrent = Math.max(0, Math.min(current ?? 0, max))
  const width = Math.min(max, 10)
  const filled = Math.round((safeCurrent / max) * width)
  const bar = filledGlyph.repeat(filled) + '░'.repeat(Math.max(0, width - filled))
  return `${value} ${bar}`
}

/** A finite number from a wire value, or null: the payload is still a network boundary. */
function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/** The server's derived numbers for a pilot sheet, or null when it sent none. */
function pilotDerived(sheet: SheetResult): PilotDerived | null {
  return sheet.vitals?.kind === 'pilot' ? sheet.vitals : null
}

/** The server's derived numbers for a mech sheet, or null when it sent none. */
function mechDerived(sheet: SheetResult): MechDerived | null {
  return sheet.vitals?.kind === 'mech' ? sheet.vitals : null
}

/**
 * A pool's current value against the server's max: absent means FULL
 * (`resolvePool`). Defaulting to 0 instead would render a fresh, undamaged crew
 * as wiped out, which is precisely backwards on the one surface built to show
 * it. With no max to resolve against, the stored value stands alone.
 */
function pool(current: number | null, max: number | null): number | null {
  return max === null ? current : resolvePool(current ?? undefined, max)
}

/** A pilot's vitals: the body's current values, the server's maxima and status. */
function pilotStats(body: EntityBody, derived: PilotDerived | null) {
  const maxHp = finite(derived?.maxHP)
  const maxAp = finite(derived?.maxAP)
  return {
    hp: pool(num(body, 'currentHP'), maxHp),
    maxHp,
    ap: pool(num(body, 'currentAP'), maxAp),
    maxAp,
    dead: derived?.status.dead === true,
  }
}

/** A mech's vitals: the body's current values, the server's maxima and status. */
function mechStats(body: EntityBody, derived: MechDerived | null) {
  const maxSp = finite(derived?.maxSP)
  const maxHeat = finite(derived?.maxHeat)
  return {
    sp: pool(num(body, 'currentSP'), maxSp),
    maxSp,
    // Heat is the exception and reads the other way: absent means COLD, which
    // is 0. A mech starts at no heat and gains it, where SP starts full and is
    // lost — so the same "field not written yet" state means opposite numbers.
    // That inversion is `resolveGauge`, named beside `resolvePool` so the two
    // cannot be confused for each other.
    heat: resolveGauge(num(body, 'currentHeat') ?? undefined, maxHeat ?? undefined),
    maxHeat,
    // The server's status when it sent one; the body's flags otherwise.
    destroyed: derived?.status?.destroyed ?? body.destroyed === true,
    shutdown: derived?.status?.shutdown ?? body.shutdown === true,
  }
}

/**
 * Web URLs. The glance lives in Discord; the surface lives in the app.
 *
 * Both mirror real TanStack routes — `/games/$gameId` and `/sheet/$kind/$id`.
 * A link that 404s is worse than no link: it reads as the app having lost the
 * thing, rather than as the bot having guessed. `/games/$gameId` is the
 * Game's own page in the Cantina.
 */
export function gameUrl(gameId: string): string {
  return `${CANTINA_ORIGIN}${gamePath(gameId)}`
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
  table: SheetTable,
  appId: string | null,
  publicRead: boolean | undefined
): string | null {
  if (publicRead !== true) return null
  if (appId === null || appId.length === 0) return null
  return `${CANTINA_ORIGIN}${publicPath(kindOf(table), appId)}`
}

/**
 * The live sheet for any entity — yours, a crewmate's, the crawler — or null
 * when there is no id to address.
 *
 * Addressed by the Convex row id, which every reader can open: The Cantina's
 * `entities.locate` resolves a row id for anyone allowed to see the row, opens
 * it editable for its owner and read-only for everyone else, and puts the
 * client id back in the address bar. An unclaimed pre-gen has a row id too, so
 * it links like everything else.
 */
export function sheetUrl(table: SheetTable, rowId: string | null | undefined): string | null {
  if (typeof rowId !== 'string' || rowId.length === 0) return null
  return `${CANTINA_ORIGIN}${sheetPath(kindOf(table), rowId)}`
}

/**
 * What to say when a call was denied.
 *
 * Every one of these is rendered **ephemerally**, which is what makes it safe
 * to be specific: an ephemeral reply is visible only to the person who asked,
 * so naming the reason leaks nothing to the channel while still explaining
 * itself. A command that silently does nothing is the worst of the options.
 */
export function denialMessage(reason: DenialReason, serverMessage?: string): string {
  // `not-found` and `forbidden`: the SERVER knows the specifics, so its message wins when
  // it sends one. `unlinked` keeps its own wording, with a sign-in link the server cannot add.
  if (reason !== 'unlinked') {
    if (serverMessage) return serverMessage
    return reason === 'forbidden'
      ? 'You can’t do that here.'
      : 'That sheet could not be found, or it isn’t yours to read.'
  }
  return [
    `**You don’t have an ${PRODUCT.name} account yet.**`,
    '',
    'Sign in with this same Discord account and the bot will recognise you here',
    'automatically — there’s nothing to copy across and no code to enter.',
    '',
    `${CANTINA_ORIGIN}/account`,
  ].join('\n')
}

function roleLabel(game: { mediator: boolean; organizer: boolean }): string {
  const roles = [game.mediator ? 'Mediator' : 'Player']
  if (game.organizer) roles.push('Organiser')
  return roles.join(' · ')
}

function gameLines(games: GameSummary[]): string {
  if (games.length === 0) return '_No Games yet._'
  return games
    .map((game) => `[${game.name}](${gameUrl(game.gameId)}) — ${roleLabel(game)}`)
    .join('\n')
}

/** `/su me` — who the bot thinks you are, and what you are part of. */
export function meCard(me: MeResult): ContainerData {
  return entityCard({
    title: `${me.user.displayName} — ${PRODUCT.name}`,
    url: `${CANTINA_ORIGIN}/account`,
    accent: DISCORD_NEUTRAL_ACCENT,
    description: 'Linked at sign-in. Discord is the only way in, so this is always current.',
    fields: [
      {
        name: `Your Games (${me.games.length})`,
        value: gameLines(me.games),
      },
    ],
    footer: FOOTER,
  })
}

/** `/su games` — every Game you belong to, linked to the Hangar: The Cantina has no `/games` page. */
export function gamesCard(games: GameSummary[]): ContainerData {
  return entityCard({
    title: `Your Games (${games.length})`,
    url: `${CANTINA_ORIGIN}/`,
    accent: DISCORD_NEUTRAL_ACCENT,
    description: gameLines(games),
    fields: [],
    footer: FOOTER,
  })
}

/** The first non-blank string among `keys`, else 'Unnamed'. */
export function bodyName(body: EntityBody, keys: BodyKey[]): string {
  for (const key of keys) {
    const value = str(body, key)
    if (value !== null) return value
  }
  return 'Unnamed'
}

/** ADR-030: an entity with no owner is a STATE, never a blank. */
const UNCLAIMED = 'Unclaimed'

/** A pilot is critical when dead (the server's status) or on 0 HP, a Critical Injury. */
function pilotCritical(stats: { hp: number | null; dead: boolean }): boolean {
  return stats.dead || stats.hp === 0
}

/** A mech is critical when destroyed, or on 0 SP and taking Critical Damage. */
function mechCritical(stats: { sp: number | null; destroyed: boolean }): boolean {
  return stats.destroyed || stats.sp === 0
}

/**
 * One accent per sheet: its unit's tone, as a reference card's (`discordAccent`).
 *
 * This is a deliberate amendment to "colour carries one meaning only, and that
 * meaning is rust". The strip down a container's left edge is the one thing
 * Discord renders that a sheet also has, and spending it on the sheet's own
 * accent is what makes the card read as *a sheet* rather than as another bot
 * reply. `CRITICAL` still wins wherever both apply — a wrecked mech is a
 * wrecked mech before it is a mech.
 */
const SHEET_ACCENT = {
  pilots: discordAccent('pilot'),
  mechs: discordAccent('mech'),
  crawlers: discordAccent('crawler'),
} as const

/** What a sheet renderer produces, before the shared shell is wrapped round it. */
type RenderedSheet = {
  name: string
  /** Italic identity line — class/chassis/tech level — or '' for none. */
  subtitle: string
  fields: CardField[]
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
 * would make the card disagree with the app about what they own.
 */
function refLink(schemaName: RefEnumSchemaName, slug: string): string {
  const entity = findEntityBySlug(schemaName, slug)
  if (entity === null) return slug
  return `[${entity.name}](${srdEntityUrl(schemaName, getEntitySlug(entity))})`
}

/** A resolved display name, or the slug when the dataset does not know it. */
function refName(schemaName: RefEnumSchemaName, slug: string | null): string {
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
function refArtwork(schemaName: RefEnumSchemaName, slug: string | null): string | undefined {
  if (slug === null) return undefined
  const entity = findEntityBySlug(schemaName, slug)
  return entity === null ? undefined : getAssetUrl(entity)
}

/** Item condition as stored per-slug on a mech body. */
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
  schemaName: RefEnumSchemaName,
  body?: EntityBody,
  conditionKey?: string
): string {
  if (slugs.length === 0) return '_None._'
  return slugs
    .map((slug) => {
      const link = refLink(schemaName, slug)
      if (body === undefined || conditionKey === undefined) return link
      const condition = conditionOf(body, conditionKey, slug)
      const word = CONDITION_LABELS[condition]
      if (condition === 'damaged') return `${link} · ${word}`
      if (condition === 'destroyed') return `~~${link}~~ · ${word}`
      return link
    })
    .join('\n')
}

/**
 * Pilot abilities, grouped by ability tree exactly as the live sheet groups
 * them under its dashed sub-slabs.
 *
 * Faithfulness is the reason: a Salvager may take twelve abilities, and one
 * slab per tree reads the way the sheet does rather than as one long list.
 */
function abilityFields(slugs: string[]): CardField[] {
  if (slugs.length === 0) {
    return [{ name: 'Abilities', value: '_None yet._' }]
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
    }))
}

/** A `·`-joined run of chips, or null when there are none to show. */
function chipRun(values: string[]): string | null {
  const kept = values.filter((v) => v.trim().length > 0)
  return kept.length > 0 ? kept.join(' · ') : null
}

/** Identity band + vitals rail + Abilities + Inventory. */
function pilotSheet(body: EntityBody, derived: PilotDerived | null): RenderedSheet {
  const stats = pilotStats(body, derived)
  const classRef = str(body, 'classRef')
  const fields: CardField[] = [
    { name: HP, value: gauge(stats.hp, stats.maxHp), inline: true },
    { name: 'Ability Points', value: gauge(stats.ap, stats.maxAp), inline: true },
    { name: 'Class', value: refName('classes', classRef), inline: true },
  ]

  fields.push(...abilityFields(strArray(body, 'abilities')))

  const equipment = strArray(body, 'equipment')
  fields.push({
    name: `Inventory — ${equipment.length}`,
    value: collectionLines(equipment, 'equipment'),
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
    critical: pilotCritical(stats),
  }
}

/** Identity band + vitals rail + Systems + Modules + The Hold. */
function mechSheet(body: EntityBody, derived: MechDerived | null): RenderedSheet {
  const stats = mechStats(body, derived)
  const chassisRef = str(body, 'chassisRef')
  const fields: CardField[] = [
    { name: SP, value: gauge(stats.sp, stats.maxSp), inline: true },
    { name: HEAT, value: gauge(stats.heat, stats.maxHeat, '▲'), inline: true },
    { name: 'Chassis', value: refName('chassis', chassisRef), inline: true },
  ]

  const systems = strArray(body, 'systems')
  fields.push({
    name: `Systems — ${systems.length}`,
    value: collectionLines(systems, 'systems', body, 'systemConditions'),
  })

  const modules = strArray(body, 'modules')
  fields.push({
    name: `Modules — ${modules.length}`,
    value: collectionLines(modules, 'modules', body, 'moduleConditions'),
  })

  const status = chipRun([
    stats.shutdown ? 'Shutdown' : '',
    body.vulnerable === true ? 'Vulnerable' : '',
    stats.destroyed ? CONDITION_LABELS.destroyed : '',
    ...strArray(body, 'conditions'),
  ])
  if (status !== null) fields.push({ name: 'Status', value: status, inline: true })

  const quirk = str(body, 'quirk')
  return {
    name: str(body, 'name') ?? 'Mech',
    subtitle: `*${refName('chassis', chassisRef)}*${quirk === null ? '' : `\n> ${quirk}`}`,
    fields,
    thumbnail: refArtwork('chassis', chassisRef),
    critical: mechCritical(stats),
  }
}

/**
 * Identity band + Bays + Scrap Pool.
 *
 * Bays are `{ bayRef }` objects rather than bare slugs, which is why this reads
 * them structurally instead of through `strArray`.
 */
function crawlerSheet(body: EntityBody): RenderedSheet {
  const typeRef = str(body, 'type')
  const techLevel = str(body, 'techLevel')
  const fields: CardField[] = []

  // The max is derived here (the server derives nothing for a crawler): the tech level’s SP, the type’s bonus,
  // the modifier, or the override when one is set. An unresolvable tech level
  // derives 0, which has no gauge to draw, so the current value stands alone.
  const maxSp = crawlerMaxSP({
    techLevel: techLevel ?? '',
    type: typeRef ?? undefined,
    maxSpModifier: num(body, 'maxSpModifier') ?? undefined,
    maxSpOverride: num(body, 'maxSpOverride') ?? undefined,
  })
  const sp =
    maxSp > 0 ? resolvePool(num(body, 'currentSP') ?? undefined, maxSp) : num(body, 'currentSP')
  fields.push({ name: TL, value: techLevel ?? '—', inline: true })
  fields.push({
    name: SP,
    value: maxSp > 0 ? gauge(sp, maxSp) : sp === null ? '—' : String(sp),
    inline: true,
  })

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
  })

  const systems = strArray(body, 'systems')
  if (systems.length > 0) {
    fields.push({
      name: `Armament — ${systems.length}`,
      value: collectionLines(systems, 'systems'),
    })
  }

  const pool = body.scrapPool
  if (pool !== null && typeof pool === 'object') {
    const entries = Object.entries(pool as Record<string, unknown>)
      .filter(([, v]) => typeof v === 'number' && v > 0)
      // Label first, as every chip reads: `**T1** 3`.
      .map(([tier, v]) => `**${tier.replace(/^tl/i, 'T')}** ${String(v)}`)
    const run = chipRun(entries)
    if (run !== null) fields.push({ name: 'Scrap Pool', value: run })
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
 * `/su sheet` — a crewmate's sheet, folded into a card.
 *
 * The live sheet is an identity band (fields beside a vitals rail) followed by
 * a stack of section slabs, each led by a stamp title and a count. A card is a
 * heading, prose, inline fields that run together and full-width slabs. Those
 * are the same structure, so the mapping is deliberate and one-to-one:
 *
 * - identity band fields   → description
 * - vitals rail            → inline fields, one gauge per line
 * - section slab + count   → one full-width field, count in the field NAME
 * - a `ReferenceEntityCard` → one line, linked to the reference site
 * - sheet accent           → accent strip
 * - reserved image seat    → thumbnail beside the identity band
 */
export function sheetCard(sheet: SheetResult): ContainerData {
  const body = sheet.body
  const owner = sheet.ownerName ?? UNCLAIMED

  const rendered =
    sheet.table === 'pilots'
      ? pilotSheet(body, pilotDerived(sheet))
      : sheet.table === 'mechs'
        ? mechSheet(body, mechDerived(sheet))
        : crawlerSheet(body)

  const fields = rendered.fields
  const name = rendered.name

  // Only when the owner has actually published it. A sheet with no public URL
  // gets no Share field at all — not a disabled one, and not a link that 404s.
  const publicUrl = publicSheetUrl(sheet.table, sheet.appId, sheet.publicRead)
  if (publicUrl !== null) {
    // Inserted after the vitals rail rather than appended, because
    // `enforceContainerLimits` sheds from the END. Appended, this would be the
    // FIRST thing dropped on a large sheet — a Salvager with many ability
    // trees, a fully-fitted crawler. The one link that works without an
    // account should not be the one that goes.
    const afterVitals = fields.findIndex((f) => f.inline !== true)
    fields.splice(afterVitals === -1 ? fields.length : afterVitals, 0, {
      name: 'Share',
      value: `[Public sheet](${publicUrl}) — always current, no account needed`,
    })
  }

  const url = sheetUrl(sheet.table, sheet.id)
  // The crawler is communal — it has no owner to name, and saying "Unclaimed"
  // would report a missing owner rather than an absent concept (ADR-030 §5).
  const provenance =
    sheet.table === 'crawlers' ? 'Communal · read-only' : `Owned by **${owner}** · read-only`
  const description = [rendered.subtitle, provenance].filter((line) => line.length > 0).join('\n')

  return entityCard({
    title: name,
    // Omitted rather than dead when the payload names no row.
    ...(url === null ? {} : { url }),
    accent: rendered.critical ? CRITICAL : SHEET_ACCENT[sheet.table],
    description,
    fields,
    footer: FOOTER,
    ...(rendered.thumbnail === undefined ? {} : { thumbnail: rendered.thumbnail }),
  })
}
