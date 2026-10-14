/**
 * The `/su lookup` card: an entry's one Discord card, plus its Roll buttons.
 *
 * The card is `discordEntryCard` (salvageunion-reference): the same blocks, shed
 * to the same budget, as the Component Embed the SRD puts in the entry's page,
 * so a lookup and a pasted salvageunion.io link are one card and cannot
 * disagree (`lookupCard.test.ts` holds them equal for every entry and pattern).
 * Nothing about an entry is computed or added here. A long table is a link to
 * the whole table; the bot's "See table" shows it whole.
 *
 * A pattern is an entry of its own (`schemaName::slug::pattern`): looked up by
 * name, it is its own page's card. Its host's card never lists it.
 *
 * A **long** entry (over {@link INDEX_MIN_CHARS} characters, with two or more
 * actions) is the one exception: its card is `discordEntryIndexCard`, each
 * action drawn as an index row, its name and stat line, with a **Read** button
 * that answers privately with the whole action (`readCard`). The channel sees a
 * short card; anyone can open any part. A Component Embed cannot carry a
 * button, so a pasted link keeps the full card.
 *
 * The card's nested **systems and modules** (a pattern's, a drone's, …) are
 * index rows too, each with a Read button that answers privately with that
 * entry's card (`childRows`), as many as fit Discord's ceilings. A pasted link
 * lists them as linked names.
 *
 * Otherwise what the bot adds is controls only, all stateless (`customId.ts`): a **Roll
 * button** for the entry's own table and every table its actions roll on, so a
 * chained roll is one tap, a **Full entry** button where the shared card was
 * shed (a pasted link prints it as a text link), a **Buy link** when the book
 * the entry is printed in is for sale from Leyline Press (`buyLink`), and, when
 * the card links other entries that are not rows (an ability's grants, the
 * systems past the ceiling, …), one **linked-entries menu** (`linkedMenu`):
 * picking an entry answers privately with that entry's card, so the channel
 * never fills up. A pasted link has no menu, for the same reason it has no Read
 * buttons. Older messages' `su:view`
 * tabs and `su:peek` picker are retired and answer "no longer supported".
 */

import { ButtonStyle } from 'discord-api-types/v10'
import type {
  DiscordBlock,
  DiscordChildGroup,
  EntityRef,
  SURefEntity,
  SURefEnumSchemaName,
  SURefMetaEntity,
  SURefObjectAnyPattern,
} from 'salvageunion-reference'
import {
  childStamp,
  discordAccent,
  discordCardParts,
  discordChildGroup,
  discordEntryCard,
  discordEntryIndexCard,
  discordRowSummary,
  findEntityBySlug,
  getEntitySlug,
  getPatterns,
  isSchemaName,
  nameToSlug,
  resolveFormerSlug,
  SalvageUnionReference,
  toEntityModel,
} from 'salvageunion-reference'
import type { ButtonSpec, ContainerBlock, ContainerData } from './container'
import { containerComponentCount, containerTextLength, V2_LIMIT } from './container'
import { makeCustomId } from './customId'

/** An entry the lookup resolved, with the schema it came from, or one of its patterns. */
export type LookupHit = {
  schemaName: SURefEnumSchemaName
  entity: SURefEntity & { schemaName: SURefEnumSchemaName }
  /** A pattern of `entity`: the hit is the pattern, its own entry. */
  pattern?: SURefObjectAnyPattern
}

/** Roll buttons on one card: one tap to a chained roll, never a wall of them. */
const MAX_ROLL_BUTTONS = 3

/**
 * The stable key for an entry: `schemaName::slug`, and `::pattern` for one of
 * its patterns. It is the autocomplete choice value and rides in a lookup
 * control's custom id.
 */
export function lookupKey(hit: LookupHit): string {
  const key = `${hit.schemaName}::${getEntitySlug(hit.entity)}`
  return hit.pattern ? `${key}::${nameToSlug(hit.pattern.name)}` : key
}

/**
 * The entry a key names, or null. The key round-trips through the Discord
 * client, so the schema half is validated rather than asserted. A slug retired
 * by ADR-043 (the Hill Worm, once its own Bio-Titan) answers with the pattern
 * that now carries it.
 */
export function entityFromKey(key: string): LookupHit | null {
  const [schemaName, slug, patternSlug, ...rest] = key.split('::')
  if (!schemaName || !slug || rest.length > 0 || !isSchemaName(schemaName)) return null
  const found = findEntityBySlug(schemaName, slug)
  if (!found) {
    const former = patternSlug === undefined ? resolveFormerSlug(schemaName, slug) : null
    if (!former) return null
    return { schemaName, entity: { ...former.host, schemaName }, pattern: former.pattern }
  }
  const entity = { ...found, schemaName }
  if (patternSlug === undefined) return { schemaName, entity }
  const pattern = patternOf(entity, patternSlug)
  return pattern ? { schemaName, entity, pattern } : null
}

/** One of an entry's patterns, by its slug. */
export function patternOf(host: SURefEntity, patternSlug: string): SURefObjectAnyPattern | null {
  return (getPatterns(host) ?? []).find((p) => nameToSlug(p.name) === patternSlug) ?? null
}

/** The roll buttons: the entry's own table, then each table its actions roll on. */
function rollButtons(hit: LookupHit): ButtonSpec[] {
  const parts = discordCardParts(
    toEntityModel(
      hit.entity as SURefMetaEntity,
      undefined,
      hit.pattern ? { pattern: hit.pattern } : undefined
    )
  )
  const names = [
    ...(parts.table ? [parts.table.name] : []),
    ...parts.actions.flatMap((action) => (action.tableName ? [action.tableName] : [])),
  ]
  const unique = [...new Set(names)].slice(0, MAX_ROLL_BUTTONS)
  return unique.flatMap((name, index) => {
    const customId = makeCustomId('roll', name)
    if (!customId) return []
    // A roll table IS its table: "Roll the Die", as the SRD's table button reads.
    const label = hit.schemaName === 'roll-tables' && index === 0 ? 'Roll the Die' : `Roll ${name}`
    return [{ kind: 'action' as const, customId, label, style: ButtonStyle.Primary }]
  })
}

/**
 * Where to buy the book an entry (or the pattern it names) is printed in, or
 * null. A source's `purchaseLink` is the publisher's storefront: a Leyline
 * Press product page, or its BackerKit store for the Starter Set and its
 * booklets. Anything else — Mech Monday's link is a free community page — is
 * not something to buy.
 */
export function buyLink(hit: LookupHit): string | null {
  const source = hit.pattern?.source ?? hit.entity.source
  const link = SalvageUnionReference.Sources.getByName(source)?.purchaseLink
  if (!link) return null
  const { hostname, pathname } = new URL(link)
  const forSale =
    (hostname === 'leyline.press' && pathname.startsWith('/products/')) ||
    (hostname === 'www.backerkit.com' && pathname.includes('/leyline-press/'))
  return forSale ? link : null
}

/**
 * The linked-entries menu: one option per entry the card links (its children
 * groups, in the card's order), at most Discord's 25. Each value is the entry's
 * key, so a pick needs nothing but itself. Null when the card links nothing, or
 * the menu's id would not fit Discord's cap.
 */
function linkedMenu(hit: LookupHit, drawn: ReadonlySet<string>): ContainerBlock | null {
  const parts = discordCardParts(
    toEntityModel(
      hit.entity as SURefMetaEntity,
      undefined,
      hit.pattern ? { pattern: hit.pattern } : undefined
    )
  )
  const options: Extract<ContainerBlock, { kind: 'select' }>['options'] = []
  const seen = new Set<string>()
  for (const group of parts.children) {
    for (const item of group.items) {
      // Linked on the card, so linked here: never a synthetic record or an action.
      if (item.synthetic || item.schemaName === 'actions' || !isSchemaName(item.schemaName)) {
        continue
      }
      const value = refKey(item)
      if (drawn.has(value) || seen.has(value) || value.length > 100) continue
      seen.add(value)
      options.push({
        label: (item.pattern ?? item.name).slice(0, 100),
        value,
        description: group.label.slice(0, 100),
      })
    }
  }
  const customId = makeCustomId('open', lookupKey(hit))
  if (options.length === 0 || !customId) return null
  return {
    kind: 'select',
    customId,
    placeholder: 'Open a linked entry',
    options: options.slice(0, V2_LIMIT.selectOptions),
  }
}

/** A linked entry's lookup key: `schemaName::slug`, and `::pattern` for a pattern. */
function refKey(item: EntityRef): string {
  return `${item.schemaName}::${item.slug}${item.pattern ? `::${nameToSlug(item.pattern)}` : ''}`
}

/**
 * The linked-entries menu's answer: the picked entry's own card, with no
 * controls (read-only and terminal), or null when the entry is gone.
 */
export function openCard(key: string): ContainerData | null {
  const hit = entityFromKey(key)
  return hit ? withFullEntryButton(entityCard(hit)).card : null
}

/** The entry's one card, as the Component Embed draws it, with no controls. */
function entityCard(hit: LookupHit): CardData {
  const card = discordEntryCard(hit.entity as SURefMetaEntity, hit.pattern)
  return { accent: discordAccent(card.tone), blocks: card.blocks }
}

/** A card as the shared renderer draws it, its blocks still marked. */
type CardData = { accent: number; blocks: (DiscordBlock | ContainerBlock)[] }

/** The card's nested-entity block, which lists the groups it draws. */
function isChildBlock(
  block: DiscordBlock | ContainerBlock
): block is Extract<DiscordBlock, { kind: 'text' }> & { children: DiscordChildGroup[] } {
  return block.kind === 'text' && 'children' in block && Array.isArray(block.children)
}

/** A block as the container draws it, its renderer's marks dropped. */
function plain(block: DiscordBlock | ContainerBlock): ContainerBlock {
  return block.kind === 'text' ? { kind: 'text', content: block.content } : block
}

/**
 * A shed card's closing link as a footer button: the Component Embed prints it
 * as text, which a message can do better. The button, if any, and the card
 * without the link.
 */
function withFullEntryButton(card: CardData): { card: ContainerData; button?: ButtonSpec } {
  let button: ButtonSpec | undefined
  const blocks: ContainerBlock[] = []
  for (const block of card.blocks) {
    if (block.kind === 'text' && 'more' in block && block.more) {
      button = { kind: 'link', url: block.more.url, label: block.more.label }
    } else blocks.push(plain(block))
  }
  const fixed: ContainerData = { accent: card.accent, blocks }
  return button ? { card: fixed, button } : { card: fixed }
}

/** The entry's rendered parts, everything its card can show. */
function partsOf(hit: LookupHit): ReturnType<typeof discordCardParts> {
  return discordCardParts(
    toEntityModel(
      hit.entity as SURefMetaEntity,
      undefined,
      hit.pattern ? { pattern: hit.pattern } : undefined
    )
  )
}

/** The nested entries a card draws as rows, each with its own Read button. */
const ROW_SCHEMAS: ReadonlySet<string> = new Set(['systems', 'modules'])

/**
 * A card's nested systems and modules as index rows, the shape a long entry's
 * actions take: name and stat line, with a **Read** button that answers
 * privately with that entry's card. Other groups keep their linked names.
 *
 * As many rows as the message can carry within Discord's ceilings (`reserved`
 * components are the controls still to come), in the card's order; the rest
 * stay linked names under the rows, and in the menu.
 */
function childRows(
  card: ContainerData,
  groups: DiscordChildGroup[],
  reserved: number
): { blocks: ContainerBlock[]; drawn: Set<string> } {
  const layout = (limit: number): { blocks: ContainerBlock[]; drawn: Set<string> } => {
    const drawn = new Set<string>()
    const blocks: ContainerBlock[] = []
    const other: DiscordChildGroup[] = []
    for (const group of groups) {
      const rows: ContainerBlock[] = []
      const left: EntityRef[] = []
      const seen = new Set<string>()
      const rowable = group.items.every((item) => ROW_SCHEMAS.has(item.schemaName))
      for (const item of group.items) {
        const key = refKey(item)
        // One row per entry: a message cannot carry the same button id twice.
        if (seen.has(key)) continue
        seen.add(key)
        const summary = rowable && drawn.size < limit ? discordRowSummary(item) : null
        const customId = summary ? makeCustomId('read', key) : null
        if (summary && customId && !drawn.has(key)) {
          rows.push({
            kind: 'section',
            text: [summary],
            button: { kind: 'action', customId, label: 'Read' },
          })
          drawn.add(key)
        } else if (!drawn.has(key)) left.push(item)
      }
      if (rows.length === 0) {
        other.push(group)
        continue
      }
      blocks.push({ kind: 'text', content: `-# ${group.label.toUpperCase()} (${group.count})` })
      blocks.push(...rows)
      if (left.length > 0) other.push(discordChildGroup('More', left))
    }
    if (other.length > 0) blocks.push({ kind: 'text', content: other.map(childStamp).join('\n') })
    return { blocks, drawn }
  }
  const fits = (blocks: ContainerBlock[]): boolean => {
    const whole: ContainerData = { ...card, blocks: [...card.blocks, ...blocks] }
    return (
      containerComponentCount(whole) + reserved <= V2_LIMIT.components &&
      containerTextLength(whole) <= V2_LIMIT.totalText
    )
  }
  const rowCount = groups.reduce((n, group) => n + group.items.length, 0)
  for (let limit = rowCount; limit > 0; limit--) {
    const laid = layout(limit)
    if (fits(laid.blocks)) return laid
  }
  return layout(0)
}

/**
 * A card longer than this, in characters, draws its actions as an index with
 * Read buttons, when it has two or more. Below it the whole card reads easily.
 */
export const INDEX_MIN_CHARS = 1500

/** The Read button's id for one action of an entry: `<key>|<action slug>`. */
function readId(hit: LookupHit, actionName: string): string | null {
  return makeCustomId('read', `${lookupKey(hit)}|${nameToSlug(actionName)}`)
}

/**
 * A long entry's index card, or null when the entry is short, has fewer than
 * two actions, or an action's Read id would not fit Discord's cap (the full
 * card is then the one sent, so nothing becomes unreachable).
 */
function indexCard(hit: LookupHit, full: CardData): CardData | null {
  if (containerTextLength(full) <= INDEX_MIN_CHARS) return null
  const card = discordEntryIndexCard(hit.entity as SURefMetaEntity, hit.pattern)
  const blocks: CardData['blocks'] = []
  let rows = 0
  for (const block of card.blocks) {
    if (block.kind === 'section' && block.action !== undefined) {
      const customId = readId(hit, block.action)
      if (!customId) return null
      blocks.push({
        kind: 'section',
        text: block.text,
        button: { kind: 'action', customId, label: 'Read' },
      })
      rows++
    } else {
      blocks.push(block)
    }
  }
  // The full card's shed link rides along, so the index keeps its Full entry
  // button whenever the pasted link's card would have lost something.
  const more = full.blocks.find((block) => block.kind === 'text' && 'more' in block && block.more)
  if (more) blocks.push(more)
  return rows >= 2 ? { accent: discordAccent(card.tone), blocks } : null
}

/**
 * The Read button's answer: one action of an entry, whole, under the entry's
 * name and over its citation; or, for a nested system's or module's row (a key
 * with no action), that entry's own card. Null when the entry or the action is
 * gone.
 */
export function readCard(payload: string): ContainerData | null {
  const cut = payload.lastIndexOf('|')
  // A nested system's or module's row: its whole card.
  if (cut === -1) return openCard(payload)
  const hit = entityFromKey(payload.slice(0, cut))
  if (!hit) return null
  const slug = payload.slice(cut + 1)
  const parts = discordCardParts(
    toEntityModel(
      hit.entity as SURefMetaEntity,
      undefined,
      hit.pattern ? { pattern: hit.pattern } : undefined
    )
  )
  const action = parts.actions.find((one) => nameToSlug(one.name) === slug)
  if (!action) return null
  const title = hit.pattern?.name ?? hit.entity.name
  return {
    accent: discordAccent(parts.tone),
    blocks: [
      { kind: 'text', content: `-# ${parts.url ? `[${title}](${parts.url})` : title}` },
      { kind: 'text', content: action.text },
      { kind: 'separator' },
      { kind: 'text', content: parts.cite },
    ],
  }
}

/**
 * A card with the bot's controls: its nested systems and modules as Read rows,
 * then the linked-entries menu for the rest, then the Roll buttons, the Full
 * entry button when the card was shed, and the Buy link.
 */
function withControls(hit: LookupHit, card: CardData): ContainerData {
  const marked = card.blocks.findIndex(isChildBlock)
  const { card: base, button: fullEntry } = withFullEntryButton({
    ...card,
    blocks: card.blocks.filter((_, index) => index !== marked),
  })
  // Every group the entry has, even one the shared card shed for the pasted
  // link's budget: rows answer to Discord's ceilings, not that budget. They
  // stand where the card listed the groups, else over the citation's rule.
  const groups = partsOf(hit).children
  const at = marked === -1 ? base.blocks.length - 2 : marked
  const buy = buyLink(hit)
  const buttons: ButtonSpec[] = [
    ...rollButtons(hit),
    ...(fullEntry ? [fullEntry] : []),
    ...(buy ? [{ kind: 'link' as const, url: buy, label: 'Buy' }] : []),
  ]
  const buttonRow = buttons.length > 0 ? 1 + buttons.length : 0
  // Two for the menu's row, which may yet come: rows never crowd out a control.
  const { blocks: rows, drawn } = childRows(base, groups, buttonRow + 2)
  base.blocks.splice(at, 0, ...rows)
  const menu = linkedMenu(hit, drawn)
  const controls: ContainerBlock[] = [
    ...(menu ? [menu] : []),
    ...(buttons.length > 0 ? [{ kind: 'buttons' as const, buttons }] : []),
  ]
  return { ...base, blocks: [...base.blocks, ...controls] }
}

/**
 * The lookup card: the entry's one card (a long one as its index), then its
 * controls.
 */
export function lookupCard(hit: LookupHit): ContainerData {
  const full = entityCard(hit)
  // Each index row costs three components; an index that would pass Discord's
  // ceiling sends the full card instead, which the shared budget already fits.
  const index = indexCard(hit, full)
  const indexed = index ? withControls(hit, index) : null
  return indexed && containerComponentCount(indexed) <= V2_LIMIT.components
    ? indexed
    : withControls(hit, full)
}
