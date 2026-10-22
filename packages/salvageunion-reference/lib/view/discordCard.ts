/**
 * An entity as DISCORD MARKDOWN — the one renderer for both places an entity
 * reaches Discord: the bot's `/su lookup` card, and the Component Embed the
 * SRD puts in each page's head, which Discord draws when someone pastes a
 * salvageunion.io link. One renderer, so a pasted link and a lookup can never
 * disagree (`docs/ARCHITECTURE.md#discord-bot`).
 *
 * Pure, and fed by the model (`toEntityModel`): no fact is computed here. A
 * colour stays a tone KEY, as everywhere in the view model; each consumer maps
 * it to the `0xRRGGBB` Discord wants.
 *
 * Discord paints one colour per message (the accent stripe) and none inside
 * text, so the book's devices become type and punctuation:
 *
 * - a parent → a `-#` caps kicker (`PATTERN OF MULE`), never the entity's kind;
 * - the head → `## Name` as a link to its page, an ability's tier numeral first;
 * - the chips under it, one head group in E17's order: the action type as the
 *   book prints it, the facts label first and spelled out
 *   (`**Structure Points** 12`, three to a line), the traits as linked tags with their
 *   parameter, then the cost last (`` `1 AP` ``, the book's pointy box);
 *   a class's ability limit, then the classes it advances into as links;
 * - a table → `ROLL THE DIE:` over one banded row per line;
 * - children → a counted stamp over linked names (E6: a link, never a card).
 */

import { srdEntityUrl } from '../assets'
import { replaceChassisPlaceholder } from '../contentBlockHelpers'
import { SalvageUnionReference } from '../index'
import { nameToSlug } from '../nameToSlug'
import { displayTitle } from '../naming'
import type { RefMetaEntity, RefObjectContentBlock } from '../schemas/index'
import { replaceTraitReferences } from '../traitText'
import { chipLines, costChip, factChips } from './discordChips'
import { chassisCardGroups } from './parts/children'
import { rangeStart, stripOwnerSuffix } from './parts/discordText'
import { opensGroup, splitStatLine } from './parts/facts'
import { splitSentences } from './parts/paragraphs'
import { formatActionType } from './parts/traits'
import { toEntityModel } from './toEntityModel'
import type { EntityModel, EntityRef, Fact, TraitMention } from './types'

type ClassPath = NonNullable<EntityModel['classPath']>

/** One block of a Discord container, in render order. */
export type DiscordBlock =
  | {
      kind: 'text'
      content: string
    }
  | { kind: 'separator' }
  | {
      kind: 'section'
      /** 1–3 text blocks, Discord's own limit. */
      text: string[]
      thumbnail?: { url: string; description: string }
    }

/** A rendered card: the tone key for the accent, and its blocks. */
export type DiscordCard = { tone: string; blocks: DiscordBlock[] }

/** A row of a table, ready to print: its range and its line. */
type DiscordTableRow = { key: string; line: string }

/** An action band inside a card, and the table it rolls on, if any. */
type DiscordAction = { name: string; text: string; tableName?: string }

/** A group of nested entities: its stamp, and the names as links. */
type DiscordChildGroup = { label: string; count: number; line: string; items: EntityRef[] }

/** Everything a card can show, rendered; consumers choose and order. */
export type DiscordCardParts = {
  tone: string
  url?: string
  /** The identity band: kicker, title, value cells, traits. */
  head: string[]
  thumbnail?: { url: string; description: string }
  /** Paragraphs and lists, each its own string. */
  prose: string[]
  actions: DiscordAction[]
  table?: { name: string; rows: DiscordTableRow[]; note?: string }
  children: DiscordChildGroup[]
  /** Entries the head links: the classes a class advances into. */
  headLinks: EntityRef[]
  /** The foot citation, as a `-#` line. */
  cite: string
}

/** Escape the characters that would end a markdown link label early. */
function escapeMarkdownLabel(text: string): string {
  return text.replace(/[\\[\]()]/g, '\\$&')
}

/** `[label](url)`, or the escaped label alone when there is nowhere to go. */
function link(label: string, url: string | undefined): string {
  const escaped = escapeMarkdownLabel(label)
  return url ? `[${escaped}](${url})` : escaped
}

/**
 * Where a ref links: its SRD page, a pattern's own page under its chassis, and
 * nothing for a synthetic record or an action (actions have no page).
 */
function discordRefUrl(ref: EntityRef): string | undefined {
  if (ref.synthetic || ref.schemaName === 'actions') return undefined
  const base = srdEntityUrl(ref.schemaName, ref.slug)
  return ref.pattern ? `${base}/pattern/${nameToSlug(ref.pattern)}` : base
}

/** A glossary entry's page, by the name the prose prints. */
function glossaryUrl(schemaName: 'traits' | 'keywords', name: string): string | undefined {
  if (!SalvageUnionReference.isLoaded(schemaName)) return undefined
  const entry =
    SalvageUnionReference.getByNameIn(schemaName, name) ??
    SalvageUnionReference.getByNameIn(schemaName, name.toLowerCase())
  if (!entry || !('id' in entry)) return undefined
  const slug = nameToSlug(entry.name)
  return slug ? srdEntityUrl(schemaName, slug) : undefined
}

/**
 * Body text with its `[[Trait]]` and `[[[Trait] (2)]]` references as links. The
 * grammar is `replaceTraitReferences`'s; an unknown name stays plain text.
 */
export function linkTraitReferences(text: string): string {
  return replaceTraitReferences(text, (ref) => {
    const name = ref.traitName.trim()
    const label = link(name, glossaryUrl('traits', name))
    const parameter = ref.parameter?.trim()
    return parameter ? `${label} ${parameter}` : label
  })
}

/** A range as the book sets it: "11-19" → "11–19". */
export function rangeLabel(key: string): string {
  return key.replace('-', '–')
}

/** Content blocks as markdown paragraphs, one string per block. */
function contentMarkdown(
  blocks: RefObjectContentBlock[] | undefined,
  chassisName?: string
): string[] {
  if (!Array.isArray(blocks)) return []
  const text = (value: unknown): string =>
    linkTraitReferences(
      replaceChassisPlaceholder(typeof value === 'string' ? value : '', chassisName).trim()
    )
  const out: string[] = []
  for (const block of blocks) {
    if (Array.isArray(block.value)) {
      const values = block.value
        .map((dv) =>
          dv.value !== undefined && dv.value !== ''
            ? `**${dv.label}:** ${dv.value}${dv.unit ? ` ${dv.unit}` : ''}`
            : `**${dv.label}**`
        )
        .join(' · ')
      if (values) out.push(values)
      continue
    }
    const body = text(block.value)
    let line = ''
    if (body) {
      switch (block.type ?? 'paragraph') {
        case 'heading':
          line = `**${body}**`
          break
        case 'label':
          line = block.label ? `**${block.label}:** ${body}` : `**${body}**`
          break
        case 'list-item':
          line = `- ${body}`
          break
        case 'hint':
          line = `> ${body}`
          break
        case 'flavor':
          line = `*${body}*`
          break
        default:
          // One sentence to a line reads easily in Discord's narrow column.
          line = splitSentences(body).join('\n')
      }
    } else if (block.label) {
      line = `**${block.label}**`
    }
    const items = Array.isArray(block.items)
      ? block.items.map((item) => text(item.value)).filter((item) => item.length > 0)
      : []
    const combined = [line, ...items.map((item) => `- ${item}`)].filter(Boolean).join('\n')
    if (combined) out.push(combined)
  }
  return out
}

/**
 * The head group's lines (E17), in the stat order: a line for each group of
 * stats (TL and SV, then SP, EP and Heat, then the slots), a line for the
 * action (its type, then its facets), a line for the traits (their links run
 * long), the cost closing whichever line is last. A group longer than
 * `perLine` chips breaks across lines of its own.
 */
function chipGroup(model: EntityModel, facts: Fact[], perLine = 3): string[] {
  const { stats, action } = splitStatLine(facts)
  const groups: Fact[][] = []
  stats.forEach((fact, index) => {
    const last = groups[groups.length - 1]
    if (last && !opensGroup(stats, index)) last.push(fact)
    else groups.push([fact])
  })
  const lines = groups.flatMap((group) => chipLines(factChips(group), perLine))
  const actionType = actionTypeLine(model)
  lines.push(
    ...chipLines([...(actionType ? [`**${actionType}**`] : []), ...factChips(action)], perLine)
  )
  if (model.traits.length > 0) lines.push(traitTags(model.traits))
  const cost = costChip(model)
  if (cost) {
    const last = lines.length - 1
    if (last >= 0) lines[last] = `${lines[last]} · ${cost}`
    else lines.push(cost)
  }
  return lines
}

/** Traits as linked tags: `[Hacking](…) · [Burn](…) 2`. */
function traitTags(traits: TraitMention[]): string {
  return traits
    .map((trait) => {
      const label = link(
        trait.name,
        trait.ref ? discordRefUrl(trait.ref) : glossaryUrl(trait.schemaName, trait.name)
      )
      return trait.param ? `${label} ${trait.param}` : label
    })
    .join(' · ')
}

/** An action's type as the book prints it, a split one Mech first. */
function actionTypeLine(model: EntityModel): string | undefined {
  if (!model.actionType) return undefined
  const own = formatActionType(model.actionType)
  return model.mechActionType
    ? `${formatActionType(model.mechActionType)} (Mech) · ${own} (Pilot)`
    : own
}

/**
 * The kicker: a pattern's `-# PATTERN OF MULE`. It never names the entity's
 * kind (E9), and the chips never ride above the title (E17), so it is absent
 * when the entity has no parent.
 */
function kicker(model: EntityModel): string | undefined {
  return model.parent
    ? `-# ${`${model.parent.label} ${model.parent.ref.name}`.toUpperCase()}`
    : undefined
}

/**
 * A class's path under its name: `**Abilities** Up to 10`, then the classes it
 * advances into as links, label first (`**Advances into** [Fabricator](…)`).
 */
function classPathLines({ maxAbilities, advancesInto }: ClassPath): string[] {
  const into = advancesInto.map((ref) => link(ref.name, discordRefUrl(ref))).join(' · ')
  return [`**Abilities** Up to ${maxAbilities}`, ...(into ? [`**Advances into** ${into}`] : [])]
}

/** The head line: `## [Mule](…)`, or `## 2 · [Counter-Hacking](…)`. */
function heading(model: EntityModel, url: string | undefined): string {
  const tier = model.tier ? `${model.tier} · ` : ''
  return `## ${tier}${link(displayTitle(model.title), url)}`
}

/** `Workshop Manual · p.100 // … (PC) · p.12`: every printing on one line (`citeLine`). */
export function discordCiteLine(model: EntityModel): string {
  return model.cite.citation ?? 'Salvage Union'
}

/** An action as a band: name, its chips (E17, cost last), then its rules. */
function actionBand(ref: EntityRef, ownName: string, chassisName?: string): DiscordAction | null {
  const record = SalvageUnionReference.get('actions', ref.id)
  if (!record) return null
  const model = toEntityModel(record as RefMetaEntity)
  const name = stripOwnerSuffix(model.title, ownName)
  // A band's chips run on one line, the cost closing it.
  const chips = chipGroup(model, model.facts, 99).join(' · ')
  const stats = chips ? [`-# ${chips}`] : []
  const label = escapeMarkdownLabel(name)
  const text = [`### ${label}`, ...stats, ...contentMarkdown(model.prose, chassisName)].join('\n')
  const tableName = model.table?.name
  return { name, text, ...(tableName ? { tableName } : {}) }
}

/**
 * A table's rows. A banded table prints one row per band, highest first, as the
 * book does. A two-roll (columns) table prints one row per column, its entries
 * in order, under a note that says how it is rolled.
 */
function tableParts(table: NonNullable<EntityModel['table']>): DiscordCardParts['table'] {
  if (table.kind === 'bands') {
    return {
      name: table.name,
      rows: table.rows.map((row) => ({
        key: row.key,
        line: `\`${rangeLabel(row.key)}\` ${row.label ? `**${escapeMarkdownLabel(row.label)}**: ` : ''}${linkTraitReferences(row.value)}`,
      })),
    }
  }
  const columns = Object.entries(table.table)
    .flatMap(([key, column]) =>
      column !== null && typeof column === 'object' ? [{ key, column }] : []
    )
    .sort((a, b) => rangeStart(a.key) - rangeStart(b.key))
  return {
    name: table.name,
    note: 'Two rolls: the column, then the entry.',
    rows: columns.map(({ key, column }) => ({
      key,
      line: `**${rangeLabel(key)}**: ${Object.entries(column as Record<string, { value?: string }>)
        .sort(([a], [b]) => rangeStart(a) - rangeStart(b))
        .map(([entry, { value }]) => `\`${entry}\` ${linkTraitReferences(value ?? '')}`)
        .join(' · ')}`,
    })),
  }
}

/**
 * Render every part of a model. `entity` is the record the model came from:
 * a chassis's prose names itself through a `[(CHASSIS)]` placeholder.
 */
export function discordCardParts(model: EntityModel): DiscordCardParts {
  const url = discordRefUrl(model.ref)
  const chassisName =
    model.ref.schemaName === 'chassis' ? (model.parent?.ref.name ?? model.title) : undefined

  const lead = kicker(model)
  const head = [
    ...(lead ? [lead] : []),
    heading(model, url),
    ...chipGroup(model, model.facts),
    ...(model.classPath ? classPathLines(model.classPath) : []),
  ]

  // The entity's own prose, then its folded self-action's: a system's rules
  // live in the action that IS it. An ability's description is its lead.
  const folded = model.folded ? SalvageUnionReference.get('actions', model.folded.id) : undefined
  const foldedProse = folded ? toEntityModel(folded as RefMetaEntity).prose : []
  // Where the entry and its self-action carry the same paragraph (pilot
  // equipment, some NPCs and squads), the card prints it once.
  const own = contentMarkdown(model.prose, chassisName)
  const ownSet = new Set(own)
  const prose = [
    ...(model.kind.domain === 'pilot' && model.lead && own.length === 0 ? [model.lead] : []),
    ...own,
    ...contentMarkdown(foldedProse, chassisName).filter((paragraph) => !ownSet.has(paragraph)),
  ]

  // A chassis's card carries its abilities, ahead of any other action, and
  // links its patterns. A pattern's card is its own entry and never repeats them.
  const isHost = model.ref.schemaName === 'chassis' && !model.parent
  const abilities = isHost ? model.abilities : []
  const actions = [...abilities, ...model.actions].flatMap((ref) => {
    const band = actionBand(ref, model.title, chassisName)
    return band ? [band] : []
  })

  const table = model.table ? tableParts(model.table) : undefined

  // A class's Core trees: bare links.
  const children = [
    ...model.children,
    ...(model.links ?? []),
    ...(isHost ? chassisCardGroups(model.ref) : []),
  ].map((group) => discordChildGroup(group.label, group.items))

  return {
    tone: model.tone,
    ...(url ? { url } : {}),
    head,
    ...(model.art.kind === 'image'
      ? { thumbnail: { url: model.art.url, description: displayTitle(model.title) } }
      : {}),
    prose,
    actions,
    ...(table ? { table } : {}),
    children,
    headLinks: model.classPath?.advancesInto ?? [],
    cite: `-# ${discordCiteLine(model)}`,
  }
}

/** Which parts to draw, and the test a rendered card must pass. */
export type DiscordCardOptions = {
  /** Mark this row of the table as the one rolled (`11-19`). */
  markedRow?: string
  /** A line printed under the marked row ("ROLLED 14 · Alex"). */
  markedNote?: string
  /** Fits the budget? Parts are shed from the end until it does. */
  fits?: (card: DiscordCard) => boolean
}

/** The table's rows, the marked one quoted with its note. */
function tableLines(
  rows: DiscordTableRow[],
  markedRow: string | undefined,
  markedNote: string | undefined
): string[] {
  return rows.map((row) =>
    row.key === markedRow
      ? `> **▶** ${row.line}${markedNote ? `\n> -# ${markedNote}` : ''}`
      : row.line
  )
}

/** What a card still holds while it sheds, and what it has shed. */
type CardContent = {
  prose: string[]
  actions: DiscordAction[]
  rows: DiscordTableRow[]
  children: DiscordChildGroup[]
  /** The whole table went, so the card links to it. */
  tableShed: boolean
  /** Anything other than the table went, so the card links the full entry. */
  otherShed: boolean
}

/** The link a shed card closes on: the whole table when that is all it lost. */
function shedLink(content: CardContent, url: string): DiscordBlock {
  const tableOnly = content.tableShed && !content.otherShed
  const text = tableOnly
    ? 'See the whole table on salvageunion.io'
    : 'The full entry on salvageunion.io'
  return { kind: 'text', content: `[${text}](${url})` }
}

/** A group of nested entries: its label, its count, and the names as links. */
function discordChildGroup(label: string, items: EntityRef[]): DiscordChildGroup {
  return {
    label,
    count: items.length,
    line: items.map((item) => link(item.name, discordRefUrl(item))).join(' · '),
    items,
  }
}

/** A group as its counted stamp over its linked names: `-# SYSTEMS (2)` then the line. */
function childStamp(group: DiscordChildGroup): string {
  return `-# ${group.label.toUpperCase()} (${group.count})\n${group.line}`
}

function build(
  parts: DiscordCardParts,
  options: DiscordCardOptions,
  content: CardContent
): DiscordCard {
  const blocks: DiscordBlock[] = []
  const head = parts.head.join('\n')
  blocks.push(
    parts.thumbnail
      ? { kind: 'section', text: [head], thumbnail: parts.thumbnail }
      : { kind: 'text', content: head }
  )

  const body = [...content.prose, ...content.actions.map((action) => action.text)]
  if (body.length > 0) {
    blocks.push({ kind: 'separator' })
    blocks.push({ kind: 'text', content: body.join('\n\n') })
  }

  if (parts.table && content.rows.length > 0) {
    const lines = tableLines(content.rows, options.markedRow, options.markedNote)
    const heading = parts.table.note ? `-# ROLL THE DIE: ${parts.table.note}` : '-# ROLL THE DIE:'
    blocks.push({ kind: 'text', content: [heading, ...lines].join('\n') })
  }

  if (content.children.length > 0) {
    blocks.push({ kind: 'text', content: content.children.map(childStamp).join('\n') })
  }

  if ((content.tableShed || content.otherShed) && parts.url) {
    blocks.push(shedLink(content, parts.url))
  }
  blocks.push({ kind: 'separator' })
  blocks.push({ kind: 'text', content: parts.cite })
  return { tone: parts.tone, blocks }
}

/**
 * Assemble a card from its parts and shed it to fit: children first, then
 * actions from the end, then the table, then prose from the end. A shed card
 * says so and links the page, so nothing is lost, only moved. Whole parts go,
 * never half a sentence; the head and the cite always stay.
 *
 * A table goes WHOLE: a long one is read on its page ("See the whole table"),
 * never cut to its top rows. The one exception is a table with a rolled row
 * (`markedRow`), which keeps that row and sheds the others from the end.
 */
export function discordCard(
  parts: DiscordCardParts,
  options: DiscordCardOptions = {}
): DiscordCard {
  const content: CardContent = {
    prose: [...parts.prose],
    actions: [...parts.actions],
    rows: [...(parts.table?.rows ?? [])],
    children: [...parts.children],
    tableShed: false,
    otherShed: false,
  }
  const fits = options.fits ?? (() => true)
  let card = build(parts, options, content)
  while (!fits(card)) {
    if (content.children.length > 0) {
      content.children.pop()
      content.otherShed = true
    } else if (content.actions.length > 0) {
      content.actions.pop()
      content.otherShed = true
    } else if (options.markedRow === undefined && content.rows.length > 0) {
      content.rows = []
      content.tableShed = true
    } else if (content.rows.length > 1) {
      const marked = content.rows.findIndex((row) => row.key === options.markedRow)
      // Keep the rolled row: drop the furthest other row from the end.
      const drop =
        content.rows.length - 1 === marked ? content.rows.length - 2 : content.rows.length - 1
      content.rows.splice(drop, 1)
      content.otherShed = true
    } else if (content.prose.length > 0) {
      content.prose.pop()
      content.otherShed = true
    } else break
    card = build(parts, options, content)
  }
  return card
}
