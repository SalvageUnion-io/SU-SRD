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
 * Otherwise what the bot adds is controls only, all stateless (`customId.ts`): a **Roll
 * button** for the entry's own table and every table its actions roll on, so a
 * chained roll is one tap, a **Buy link** when the book the entry is printed in
 * is for sale from Leyline Press (`buyLink`), and, when the card links other
 * entries (a pattern's systems and modules, a drone's systems, …), one
 * **linked-entries menu** (`linkedMenu`): picking an entry answers privately
 * with that entry's card, so the channel never fills up. A pasted link has no
 * menu, for the same reason it has no Read buttons. Older messages' `su:view`
 * tabs and `su:peek` picker are retired and answer "no longer supported".
 */

import { ButtonStyle } from 'discord-api-types/v10'
import type {
  SURefEntity,
  SURefEnumSchemaName,
  SURefMetaEntity,
  SURefObjectAnyPattern,
} from 'salvageunion-reference'
import {
  discordAccent,
  discordCardParts,
  discordEntryCard,
  discordEntryIndexCard,
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
    // A roll table IS its table: "Roll on this table", as it always read.
    const label =
      hit.schemaName === 'roll-tables' && index === 0 ? 'Roll on this table' : `Roll ${name}`
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
function linkedMenu(hit: LookupHit): ContainerBlock | null {
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
      const value = `${item.schemaName}::${item.slug}${item.pattern ? `::${nameToSlug(item.pattern)}` : ''}`
      if (seen.has(value) || value.length > 100) continue
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

/**
 * The linked-entries menu's answer: the picked entry's own card, with no
 * controls (read-only and terminal), or null when the entry is gone.
 */
export function openCard(key: string): ContainerData | null {
  const hit = entityFromKey(key)
  return hit ? entityCard(hit) : null
}

/** The entry's one card, as the Component Embed draws it, with no controls. */
function entityCard(hit: LookupHit): ContainerData {
  const card = discordEntryCard(hit.entity as SURefMetaEntity, hit.pattern)
  return { accent: discordAccent(card.tone), blocks: card.blocks }
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
function indexCard(hit: LookupHit, full: ContainerData): ContainerData | null {
  if (containerTextLength(full) <= INDEX_MIN_CHARS) return null
  const card = discordEntryIndexCard(hit.entity as SURefMetaEntity, hit.pattern)
  const blocks: ContainerBlock[] = []
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
  return rows >= 2 ? { accent: discordAccent(card.tone), blocks } : null
}

/**
 * The Read button's answer: one action of an entry, whole, under the entry's
 * name and over its citation. Null when the entry or the action is gone.
 */
export function readCard(payload: string): ContainerData | null {
  const cut = payload.lastIndexOf('|')
  if (cut === -1) return null
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
 * The lookup card: the entry's one card (a long one as its index), then its
 * linked-entries menu, Roll buttons and Buy link.
 */
export function lookupCard(hit: LookupHit): ContainerData {
  const full = entityCard(hit)
  const buy = buyLink(hit)
  const buttons: ButtonSpec[] = [
    ...rollButtons(hit),
    ...(buy ? [{ kind: 'link' as const, url: buy, label: 'Buy' }] : []),
  ]
  const menu = linkedMenu(hit)
  const controls: ContainerBlock[] = [
    ...(menu ? [menu] : []),
    ...(buttons.length > 0 ? [{ kind: 'buttons' as const, buttons }] : []),
  ]
  const withControls = (card: ContainerData): ContainerData =>
    controls.length > 0 ? { ...card, blocks: [...card.blocks, ...controls] } : card
  // Each index row costs three components; an index that would pass Discord's
  // ceiling sends the full card instead, which the shared budget already fits.
  const index = indexCard(hit, full)
  const indexed = index ? withControls(index) : null
  return indexed && containerComponentCount(indexed) <= V2_LIMIT.components
    ? indexed
    : withControls(full)
}
