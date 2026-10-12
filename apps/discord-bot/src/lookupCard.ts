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
 * What the bot adds is controls only, all stateless (`customId.ts`): a **Roll
 * button** for the entry's own table and every table its actions roll on, so a
 * chained roll is one tap, and a **Buy link** when the book the entry is
 * printed in is for sale from Leyline Press (`buyLink`). Older messages' `su:view` tabs and `su:peek` picker
 * keep answering (buttons are permanent): a tab redraws this card, the picker
 * answers with the pattern's card.
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
  findEntityBySlug,
  getEntitySlug,
  getPatterns,
  isSchemaName,
  nameToSlug,
  resolveFormerSlug,
  SalvageUnionReference,
  toEntityModel,
} from 'salvageunion-reference'
import type { ButtonSpec, ContainerData } from './container'
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

/**
 * The key an older message's `su:view` tab carries (`<key>|<tab>[|<page>[|i]]`),
 * or null when it is not one. Tabs are gone; pressing one redraws the card.
 */
export function viewPayloadKey(payload: string): string | null {
  const [key, tab] = payload.split('|')
  return key && (tab === 'overview' || tab === 'patterns') ? key : null
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

/** The entry's one card, as the Component Embed draws it, with no controls. */
export function entityCard(hit: LookupHit): ContainerData {
  const card = discordEntryCard(hit.entity as SURefMetaEntity, hit.pattern)
  return { accent: discordAccent(card.tone), blocks: card.blocks }
}

/** The lookup card: the entry's one card, then its Roll buttons and Buy link. */
export function lookupCard(hit: LookupHit): ContainerData {
  const card = entityCard(hit)
  const buy = buyLink(hit)
  const controls: ButtonSpec[] = [
    ...rollButtons(hit),
    ...(buy ? [{ kind: 'link' as const, url: buy, label: 'Buy' }] : []),
  ]
  return controls.length > 0
    ? { ...card, blocks: [...card.blocks, { kind: 'buttons', buttons: controls }] }
    : card
}
