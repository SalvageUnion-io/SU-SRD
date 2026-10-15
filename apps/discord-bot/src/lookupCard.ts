/**
 * The `/su lookup` card: an entry's one Discord card, plus its controls.
 *
 * The card is `discordEntryCard` (salvageunion-reference), drawn verbatim: the
 * same blocks, shed to the same budget, as the Component Embed the SRD puts in
 * the entry's page, so a lookup and a pasted salvageunion.io link look the same
 * and cannot disagree (`lookupCard.test.ts` holds them equal for every entry and
 * pattern). Nothing about an entry is computed, added or redrawn here; a shed
 * card keeps its closing text link, as the pasted link does.
 *
 * A pattern is an entry of its own (`schemaName::slug::pattern`): looked up by
 * name, it is its own page's card. A chassis's card links it by name only.
 *
 * Under the card the bot adds controls only, all stateless (`customId.ts`): a
 * **Roll button** for the entry's own table and every table its actions roll
 * on, so a chained roll is one tap, and, when the card links other entries (an
 * ability's grants, a pattern's systems, …), one **linked-entries menu**
 * (`linkedMenu`): picking an entry answers privately with that entry's card, so
 * the channel never fills up. Older messages keep their buttons: `su:read` rows
 * still answer (`readCard`), and the `su:view` tabs and `su:peek` picker are
 * retired and answer "no longer supported".
 */

import { ButtonStyle } from 'discord-api-types/v10'
import type {
  DiscordBlock,
  EntityRef,
  RefEntity,
  RefEnumSchemaName,
  RefMetaEntity,
  RefObjectAnyPattern,
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
  toEntityModel,
} from 'salvageunion-reference'
import type { ButtonSpec, ContainerBlock, ContainerData } from './container'
import { V2_LIMIT } from './container'
import { makeCustomId } from './customId'

/** An entry the lookup resolved, with the schema it came from, or one of its patterns. */
export type LookupHit = {
  schemaName: RefEnumSchemaName
  entity: RefEntity & { schemaName: RefEnumSchemaName }
  /** A pattern of `entity`: the hit is the pattern, its own entry. */
  pattern?: RefObjectAnyPattern
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
export function patternOf(host: RefEntity, patternSlug: string): RefObjectAnyPattern | null {
  return (getPatterns(host) ?? []).find((p) => nameToSlug(p.name) === patternSlug) ?? null
}

/** The roll buttons: the entry's own table, then each table its actions roll on. */
function rollButtons(hit: LookupHit): ButtonSpec[] {
  const parts = partsOf(hit)
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
 * The linked-entries menu: one option per entry the card links (its children
 * groups, in the card's order), at most Discord's 25. Each value is the entry's
 * key, so a pick needs nothing but itself. Null when the card links nothing, or
 * the menu's id would not fit Discord's cap.
 */
function linkedMenu(hit: LookupHit): ContainerBlock | null {
  const parts = partsOf(hit)
  const options: Extract<ContainerBlock, { kind: 'select' }>['options'] = []
  const seen = new Set<string>()
  for (const group of parts.children) {
    for (const item of group.items) {
      // Linked on the card, so linked here: never a synthetic record or an action.
      if (item.synthetic || item.schemaName === 'actions' || !isSchemaName(item.schemaName)) {
        continue
      }
      const value = refKey(item)
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

/** A linked entry's lookup key: `schemaName::slug`, and `::pattern` for a pattern. */
function refKey(item: EntityRef): string {
  return `${item.schemaName}::${item.slug}${item.pattern ? `::${nameToSlug(item.pattern)}` : ''}`
}

/**
 * The linked-entries menu's answer: the picked entry's own card, as its pasted
 * link draws it, with no controls (read-only and terminal), or null when the
 * entry is gone.
 */
export function openCard(key: string): ContainerData | null {
  const hit = entityFromKey(key)
  return hit ? entityCard(hit) : null
}

/** The entry's one card, as the Component Embed draws it, with no controls. */
function entityCard(hit: LookupHit): ContainerData {
  const card = discordEntryCard(hit.entity as RefMetaEntity, hit.pattern)
  return { accent: discordAccent(card.tone), blocks: card.blocks.map(plain) }
}

/** A block as the container draws it, its renderer's marks dropped. */
function plain(block: DiscordBlock): ContainerBlock {
  return block.kind === 'text' ? { kind: 'text', content: block.content } : block
}

/** The entry's rendered parts, everything its card can show. */
function partsOf(hit: LookupHit): ReturnType<typeof discordCardParts> {
  return discordCardParts(
    toEntityModel(
      hit.entity as RefMetaEntity,
      undefined,
      hit.pattern ? { pattern: hit.pattern } : undefined
    )
  )
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
  const parts = partsOf(hit)
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
 * The lookup card: the entry's one card, exactly as its pasted link draws it,
 * then the linked-entries menu and the Roll buttons.
 */
export function lookupCard(hit: LookupHit): ContainerData {
  const card = entityCard(hit)
  const menu = linkedMenu(hit)
  const buttons = rollButtons(hit)
  const controls: ContainerBlock[] = [
    ...(menu ? [menu] : []),
    ...(buttons.length > 0 ? [{ kind: 'buttons' as const, buttons }] : []),
  ]
  return { ...card, blocks: [...card.blocks, ...controls] }
}
