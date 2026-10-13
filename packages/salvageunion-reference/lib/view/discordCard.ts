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
 * - an action's type and cost → a `-#` caps kicker (never the entity's kind);
 * - the head → `## Name` as a link to its page, an ability's tier numeral first;
 * - value cells → `` `12` STRUCTURE PTS. ``, three to a line, in the book's
 *   words and order (`bookStats`);
 * - traits → linked tags with their parameter (E17: no "//" line);
 * - a table → `ROLL THE DIE:` over one banded row per line;
 * - children → a counted stamp over linked names (E6: a link, never a card).
 */

import { srdEntityUrl } from '../assets'
import { replaceChassisPlaceholder } from '../contentBlockHelpers'
import { SalvageUnionReference } from '../index'
import { nameToSlug } from '../nameToSlug'
import { displayTitle } from '../naming'
import type { SURefMetaEntity, SURefObjectContentBlock } from '../schemas/index'
import { replaceTraitReferences } from '../traitText'
import { formatProvenance } from './parts/cite'
import { formatActionType } from './parts/traits'
import { toEntityModel } from './toEntityModel'
import type { EntityModel, EntityRef, Fact, TraitMention } from './types'

/**
 * The accent stripe for each tone, as the `0xRRGGBB` integer Discord takes.
 * A mirror of `--color-<tone>` in `packages/component-lib/src/styles/theme.css`
 * (`discordCard.test.ts` holds them in lockstep), with ONE deliberate change:
 * `ink` and `ink-2` paint the rules blue (`--color-wk-line`), the band the
 * glossary chapters wear, because a near-black stripe vanishes on Discord's
 * dark theme.
 */
export const DISCORD_TONE_ACCENT: Readonly<Record<string, number>> = {
  pilot: 0xef894f,
  mech: 0x7a978a,
  crawler: 0xce5898,
  'crawler-band': 0xb84a86,
  'denizen-band': 0x2f4a66,
  adversary: 0x8c4b38,
  'tier-advanced': 0xa85947,
  'tier-legendary': 0x7852a0,
  'guide-salvage': 0x5a9db5,
  'guide-hazard': 0xb84c4c,
  'tl-1': 0x73c9e6,
  'tl-2': 0x57a9c8,
  'tl-3': 0x5391a9,
  'tl-4': 0x306b80,
  'tl-5': 0x1e5364,
  'tl-6': 0x063441,
  'tl-b': 0x569c68,
  'tl-n': 0x8664a9,
  'wk-line': 0x8fc3d8,
  ink: 0x8fc3d8,
  'ink-2': 0x8fc3d8,
}

/** A tone's accent; an unknown tone takes the rules blue. */
export function discordAccent(tone: string): number {
  return DISCORD_TONE_ACCENT[tone] ?? 0x8fc3d8
}

/** One block of a Discord container, in render order. */
export type DiscordBlock =
  | { kind: 'text'; content: string }
  | { kind: 'separator' }
  | {
      kind: 'section'
      /** 1–3 text blocks, Discord's own limit. */
      text: string[]
      thumbnail?: { url: string; description: string }
      /**
       * An action's index row (`indexActions`): the action's name, for the bot
       * to hang its Read button on. Never set on a Component Embed's card.
       */
      action?: string
    }

/** A rendered card: the tone key for the accent, and its blocks. */
export type DiscordCard = { tone: string; blocks: DiscordBlock[] }

/** A row of a table, ready to print: its range and its line. */
type DiscordTableRow = { key: string; line: string }

/**
 * An action band inside a card, and the table it rolls on, if any. `summary`
 * is the band without its rules: the name, its stat line and its traits.
 */
type DiscordAction = { name: string; text: string; summary: string; tableName?: string }

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
  blocks: SURefObjectContentBlock[] | undefined,
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
          line = body
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

/** Value cells, three to a line: `` `12` STRUCTURE PTS. · `4` ENERGY PTS. ``. */
function factCells(facts: Fact[], perLine = 3): string[] {
  const cells = facts
    .filter((fact) => fact.value !== '')
    .map((fact) => `\`${fact.value}\` ${fact.label.toUpperCase()}`)
  const lines: string[] = []
  for (let i = 0; i < cells.length; i += perLine) {
    lines.push(cells.slice(i, i + perLine).join(' · '))
  }
  return lines
}

/** The book's stat column where the entity has one, then any facet it lacks. */
function cellFacts(model: EntityModel): Fact[] {
  if (model.bookStats.length === 0) return model.facts
  const shown = new Set(model.bookStats.map((fact) => fact.short))
  return [...model.bookStats, ...model.facts.filter((fact) => !shown.has(fact.short))]
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
 * The kicker: `-# REACTION · \`1 AP\``, a pattern's `-# PATTERN OF MULE`. It never
 * names the entity's kind (E9), so it is absent when nothing else is said.
 */
function kicker(model: EntityModel): string | undefined {
  const parts: string[] = []
  if (model.parent) parts.push(`${model.parent.label} ${model.parent.ref.name}`.toUpperCase())
  const actionType = actionTypeLine(model)
  if (actionType) parts.push(actionType.toUpperCase())
  if (model.cost) parts.push(`\`${model.cost}\``)
  return parts.length > 0 ? `-# ${parts.join(' · ')}` : undefined
}

/** The head line: `## [Mule](…)`, or `## 2 · [Counter-Hacking](…)`. */
function heading(model: EntityModel, url: string | undefined): string {
  const tier = model.tier ? `${model.tier} · ` : ''
  return `## ${tier}${link(displayTitle(model.title), url)}`
}

/** `Workshop Manual p.100 · also in … (PC) p.12`. */
export function discordCiteLine(model: EntityModel): string {
  const { source, booklet, page, citation } = model.cite
  const book = formatProvenance(source, booklet, undefined)
  const head = [book, page !== undefined ? `p.${page}` : undefined].filter(Boolean).join(' ')
  const reprints =
    book && citation?.startsWith(book) ? citation.slice(book.length).replace(/ · p\./g, ' p.') : ''
  return `${head}${reprints}` || 'Salvage Union'
}

/** An action as a band: name, kicker facts, traits, then its rules. */
function actionBand(ref: EntityRef, ownName: string, chassisName?: string): DiscordAction | null {
  const record = SalvageUnionReference.get('actions', ref.id)
  if (!record) return null
  const model = toEntityModel(record as SURefMetaEntity)
  const meta = [
    actionTypeLine(model),
    model.cost ? `\`${model.cost}\`` : undefined,
    ...factCells(model.facts, 99),
  ].filter(Boolean)
  const name = stripOwnerSuffix(model.title, ownName)
  const stats: string[] = []
  if (meta.length > 0) stats.push(`-# ${meta.join(' · ')}`)
  if (model.traits.length > 0) stats.push(traitTags(model.traits))
  const label = escapeMarkdownLabel(name)
  const text = [`### ${label}`, ...stats, ...contentMarkdown(model.prose, chassisName)].join('\n')
  const summary = [`**${label}**`, ...stats].join('\n')
  const tableName = model.table?.name
  return { name, text, summary, ...(tableName ? { tableName } : {}) }
}

/** "Chassis Repair (Fabrication Arm)" inside Fabrication Arm → "Chassis Repair". */
function stripOwnerSuffix(name: string, ownName: string): string {
  const match = name.match(/^(.*\S)\s*\(([^()]+)\)\s*$/)
  if (!match?.[1] || !match[2]) return name
  return match[2].trim().toLowerCase() === ownName.trim().toLowerCase() ? match[1] : name
}

/** The first number of a range key: "11-19" → 11. */
function rangeStart(key: string): number {
  const n = Number.parseInt(key, 10)
  return Number.isNaN(n) ? 0 : n
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
  const head = [...(lead ? [lead] : []), heading(model, url), ...factCells(cellFacts(model))]
  if (model.traits.length > 0) head.push(traitTags(model.traits))

  // The entity's own prose, then its folded self-action's: a system's rules
  // live in the action that IS it. An ability's description is its lead.
  const folded = model.folded ? SalvageUnionReference.get('actions', model.folded.id) : undefined
  const foldedProse = folded ? toEntityModel(folded as SURefMetaEntity).prose : []
  const own = contentMarkdown(model.prose, chassisName)
  const prose = [
    ...(model.kind.domain === 'pilot' && model.lead && own.length === 0 ? [model.lead] : []),
    ...own,
    ...contentMarkdown(foldedProse, chassisName),
  ]

  // A chassis ability shows only on the chassis and pattern PAGES; a card in
  // Discord is a card, so it carries the other actions alone.
  const actions = model.actions.flatMap((ref) => {
    const band = actionBand(ref, model.title, chassisName)
    return band ? [band] : []
  })

  const table = model.table ? tableParts(model.table) : undefined

  const children = model.children.map((group) => ({
    label: group.label,
    count: group.items.length,
    line: group.items.map((item) => link(item.name, discordRefUrl(item))).join(' · '),
    items: group.items,
  }))

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
  /**
   * Draw each action as an index row (its name and stat line, no rules), for
   * the bot's long cards, whose Read button answers with the whole action.
   */
  indexActions?: boolean
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
function shedLink(content: CardContent, url: string): string {
  return content.tableShed && !content.otherShed
    ? `[See the whole table on salvageunion.io](${url})`
    : `[The full entry on salvageunion.io](${url})`
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

  const index = options.indexActions === true
  const body = [...content.prose, ...(index ? [] : content.actions.map((action) => action.text))]
  if (body.length > 0) {
    blocks.push({ kind: 'separator' })
    blocks.push({ kind: 'text', content: body.join('\n\n') })
  }
  if (index && content.actions.length > 0) {
    blocks.push({ kind: 'separator' })
    for (const action of content.actions) {
      blocks.push({ kind: 'section', text: [action.summary], action: action.name })
    }
  }

  if (parts.table && content.rows.length > 0) {
    const lines = tableLines(content.rows, options.markedRow, options.markedNote)
    const heading = parts.table.note ? `-# ROLL THE DIE: ${parts.table.note}` : '-# ROLL THE DIE:'
    blocks.push({ kind: 'text', content: [heading, ...lines].join('\n') })
  }

  if (content.children.length > 0) {
    blocks.push({
      kind: 'text',
      content: content.children
        .map((group) => `-# ${group.label.toUpperCase()} (${group.count})\n${group.line}`)
        .join('\n'),
    })
  }

  if ((content.tableShed || content.otherShed) && parts.url) {
    blocks.push({ kind: 'text', content: shedLink(content, parts.url) })
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
