/**
 * Rich /su lookup embed builder — a full, layered representation of any
 * Salvage Union entity, not a summary.
 *
 * The data model has layers: an entity (system, module, equipment, ability,
 * chassis…) references its mechanical ACTIONS by name; each action carries
 * range / damage / cost / content and references TRAITS, roll TABLES, and
 * DRONES. We resolve exactly one hop — entity → its actions, rendered inline
 * as the entity's own text — and then LINK everything those actions point at
 * (traits, tables, drones) to their own pages rather than inlining them.
 * That is "keep the same layers of data, link out to nested entities", and
 * it is also what keeps big entities inside Discord's embed budget.
 *
 * Pure and data-shape-driven: one engine covers all ~27 schemas, with a
 * couple of genuinely structural special cases (chassis stat grid + patterns,
 * roll-table summaries). No discord.js here — returns plain EmbedData that
 * commands/lookup.ts maps onto an EmbedBuilder. Everything degrades to bare
 * text on an unresolved reference; nothing throws.
 */

import {
  SchemaToDisplayName,
  extractVisibleActions,
  findEntityBySlug,
  getChassisAbilities,
  getEntitySlug,
  getPageReference,
  getSalvageValue,
  getSlotsRequired,
  getTechLevel,
  nameToSlug,
  replaceChassisPlaceholder,
  visiblePatterns,
} from 'salvageunion-reference'
import type {
  SURefChassis,
  SURefEntity,
  SURefEnumSchemaName,
  SURefMetaAction,
  SURefObjectContent,
  SURefObjectDataValue,
  SURefObjectTable,
  SURefObjectTableContent,
  SURefObjectTrait,
} from 'salvageunion-reference'

import { truncate } from './format.js'

const BASE = 'https://salvageunion.io'
const NEUTRAL = 0xb7410e

// Discord embed limits (per the API): a single embed's total rendered text
// across title/description/fields/footer must not exceed 6000 chars.
const LIMIT = {
  title: 256,
  description: 4096,
  fieldName: 256,
  fieldValue: 1024,
  fields: 25,
  footer: 2048,
  total: 6000,
} as const

export type LookupEmbed = {
  title: string
  url?: string
  color: number
  description?: string
  fields: { name: string; value: string; inline?: boolean }[]
  footer: string
}

/**
 * Escape the chars that would break a markdown link label.
 *
 * The backslash itself is in the class: escaping only the metacharacters lets
 * a literal `\` in the name pair with the backslash we add, so `\]` would emit
 * `\\]` — an escaped backslash followed by an *unescaped* `]` that closes the
 * label early. Both are escaped in the same single pass; a second pass over
 * `\` would double-escape the ones this pass introduced.
 */
function escapeLabel(text: string): string {
  return text.replace(/[\\[\]()]/g, '\\$&')
}

/**
 * Link `name` to its page in `schema` when it resolves there; otherwise emit
 * the bare (escaped) name. findEntityBySlug is null-safe on a missing schema.
 */
function entityLink(schema: SURefEnumSchemaName, name: string): string {
  const slug = nameToSlug(name)
  const resolved = slug ? findEntityBySlug(schema, slug) : null
  const label = escapeLabel(name)
  return resolved ? `[${label}](${BASE}/schema/${schema}/item/${slug})` : label
}

/**
 * Inline trait references in body text, in the two bracket forms the data uses
 * (mirrors component-lib's parseTraitReferences):
 *   [[Trait Name]]              → link to the trait's page
 *   [[[Trait Name] (param)]]    → link + the parameter (e.g. "[[[Melee] (2)]]")
 * Every ref resolves against the `traits` schema, exactly as the web does; an
 * unresolved name degrades to its bare text (matching TraitKeywordDisplayView,
 * which renders plain text on a miss rather than falling back to keywords).
 */
const TRAIT_REF = /\[\[\[([^\]]+)\]\s*\(([^)]+)\)\]\]|\[\[([^\]]+)\]\]/g
function linkifyTraitRefs(text: string): string {
  return text.replace(TRAIT_REF, (_match, paramName, paramValue, simpleName) => {
    if (paramName !== undefined) {
      const link = entityLink('traits', String(paramName).trim())
      const value = String(paramValue).trim()
      return value ? `${link} ${value}` : link
    }
    return entityLink('traits', String(simpleName).trim())
  })
}

function renderDataValues(values: SURefObjectDataValue[]): string {
  return values
    .map((dv) =>
      dv.value !== undefined && dv.value !== ''
        ? `**${dv.label}:** ${dv.value}${dv.unit ? ` ${dv.unit}` : ''}`
        : `**${dv.label}**`
    )
    .join(' · ')
}

/** Flatten structured content blocks into Discord-flavored markdown. */
function flattenContent(blocks: SURefObjectContent | undefined, chassisName?: string): string {
  if (!Array.isArray(blocks)) return ''
  const sections: string[] = []
  for (const block of blocks) {
    const type = block.type ?? 'paragraph'
    if (Array.isArray(block.value)) {
      const dv = renderDataValues(block.value)
      if (dv) sections.push(dv)
      continue
    }
    const text = linkifyTraitRefs(
      replaceChassisPlaceholder(
        typeof block.value === 'string' ? block.value : '',
        chassisName
      ).trim()
    )
    let line = ''
    if (text) {
      switch (type) {
        case 'heading':
          line = `**${text}**`
          break
        case 'label':
          line = block.label ? `**${block.label}:** ${text}` : `**${text}**`
          break
        case 'list-item':
          line = `• ${text}`
          break
        case 'hint':
          line = `> ${text}`
          break
        case 'flavor':
          line = `*${text}*`
          break
        default:
          line = text
      }
    } else if (block.label) {
      line = `**${block.label}**`
    }
    const items = Array.isArray(block.items)
      ? block.items
          .map((it) =>
            replaceChassisPlaceholder(
              typeof it.value === 'string' ? it.value : '',
              chassisName
            ).trim()
          )
          .filter(Boolean)
          .map((v) => `• ${linkifyTraitRefs(v)}`)
      : []
    const combined = [line, ...items].filter(Boolean).join('\n')
    if (combined) sections.push(combined)
  }
  return sections.join('\n\n')
}

/** Traits an action carries, each linked to its glossary page. */
function renderTraits(traits: SURefObjectTrait[] | undefined): string {
  if (!Array.isArray(traits)) return ''
  const parts = traits.map((t) => {
    const link = entityLink('traits', t.type)
    return typeof t.amount === 'number' ? `${link} ${t.amount}` : link
  })
  return parts.join(', ')
}

/** One-line stat summary for an action (range / damage / cost / type). */
function actionStatLine(action: SURefMetaAction): string {
  const parts: string[] = []
  if (action.range?.length) {
    parts.push(`**Range:** ${action.range.join('/')}`)
  }
  const dmg = action.damage
  if (dmg && typeof dmg.amount === 'number') {
    parts.push(`**Damage:** ${dmg.amount}${dmg.damageType ? ` ${dmg.damageType}` : ''}`)
  }
  if (typeof action.activationCost === 'number') {
    const cur = action.activationCurrency ? ` ${action.activationCurrency}` : ''
    parts.push(`**Cost:** ${action.activationCost}${cur}`)
  }
  if (action.actionType && action.actionType !== 'Passive') {
    parts.push(`**${action.actionType}**`)
  }
  return parts.join(' • ')
}

/** Strip a trailing ` (Owner)` disambiguation suffix when it names the entity
 *  we are already rendering inside — the bot's equivalent of the web's
 *  stripHostParenthetical. Action names carry an owner suffix in the data for
 *  uniqueness (e.g. "Chassis Repair (Fabrication Arm)"); inside the owner's own
 *  lookup the parent is already established, so the echo is redundant. A suffix
 *  that does NOT match the owner (a generic "(NPC)"/"(Vehicle)" label, or a
 *  different entity) is left alone here — those are stripped/overridden via the
 *  action's own displayName instead. */
function stripOwnerSuffix(name: string, ownName: string): string {
  const match = name.match(/^(.*\S)\s*\(([^()]+)\)\s*$/)
  if (!match) return name
  const [, base, paren] = match
  if (!base || !paren) return name
  return paren.trim().toLowerCase() === ownName.trim().toLowerCase() ? base : name
}

/** Render one resolved action to a markdown chunk. `ownName` suppresses a
 *  redundant title when the action shares the entity's name, and strips a
 *  ` (ownName)` disambiguation suffix that is redundant in this context. */
function renderAction(action: SURefMetaAction, ownName: string, chassisName?: string): string {
  const title = stripOwnerSuffix(action.displayName || action.name, ownName)
  const lines: string[] = []
  if (title && title !== ownName) lines.push(`__${escapeLabel(title)}__`)

  const stat = actionStatLine(action)
  if (stat) lines.push(stat)

  const body = flattenContent(action.content, chassisName)
  if (body) lines.push(body)

  const traits = renderTraits(action.traits)
  if (traits) lines.push(`**Traits:** ${traits}`)

  if (action.tableName) {
    lines.push(`**Rolls on:** ${entityLink('roll-tables', action.tableName)}`)
  }
  if (action.drone) {
    lines.push(`**Deploys:** ${entityLink('drones', action.drone)}`)
  }
  for (const c of action.choices ?? []) {
    const cbody = flattenContent(c.content, chassisName)
    const table = c.rollTable ? ` (${entityLink('roll-tables', c.rollTable)})` : ''
    lines.push(`**Choice — ${escapeLabel(c.name)}:**${table}${cbody ? ` ${cbody}` : ''}`)
  }
  return lines.join('\n')
}

function statFields(entity: SURefEntity): LookupEmbed['fields'] {
  const fields: LookupEmbed['fields'] = []
  const push = (name: string, value: unknown) => {
    if (value !== undefined && value !== null && value !== '') {
      fields.push({ name, value: String(value), inline: true })
    }
  }
  push('Tech Level', getTechLevel(entity))
  push('Salvage Value', getSalvageValue(entity))
  push('Slots', getSlotsRequired(entity))
  return fields
}

/** Chassis-specific stat grid + patterns (a genuine structural special case). */
function chassisSections(entity: SURefChassis): {
  fields: LookupEmbed['fields']
  patterns: string
} {
  const fields: LookupEmbed['fields'] = []
  const push = (name: string, value: unknown) => {
    if (typeof value === 'number') fields.push({ name, value: String(value), inline: true })
  }
  push('Structure', entity.structurePoints)
  push('Energy', entity.energyPoints)
  push('Heat Cap', entity.heatCapacity)
  push('Cargo Cap', entity.cargoCapacity)
  push('System Slots', entity.systemSlots)
  push('Module Slots', entity.moduleSlots)

  let patterns = ''
  const shownPatterns = visiblePatterns(entity.patterns)
  if (shownPatterns.length) {
    const rows = shownPatterns.map((p) => {
      const name = escapeLabel(p.name)
      const legal = p.legalStarting ? ' ✅' : ''
      return `• **${name}**${legal} — ${p.systems.length} systems, ${p.modules.length} modules`
    })
    patterns = `**Patterns**\n${rows.join('\n')}`
  }
  return { fields, patterns }
}

function footerFor(entity: SURefEntity): string {
  const parts: string[] = []
  if (typeof entity.source === 'string') parts.push(entity.source)
  const page = getPageReference(entity)
  if (typeof page === 'number') parts.push(`p.${page}`)
  parts.push('Salvage Union Reference')
  return truncate(parts.join(' · '), LIMIT.footer)
}

/**
 * A truncation cut can land mid-`[label](url)`, which Discord renders as
 * broken markdown. If the tail holds an unterminated link (a trailing `[`
 * with no complete `](url)` after it), drop it back to before that `[`.
 */
function stripDanglingLink(text: string): string {
  const lastOpen = text.lastIndexOf('[')
  if (lastOpen === -1) return text
  const tail = text.slice(lastOpen)
  // A complete link at the tail is fine; anything else is a dangling cut.
  if (/^\[[^\]]*\]\([^)]*\)/.test(tail)) return text
  return text.slice(0, lastOpen).trimEnd()
}

/**
 * Trim an assembled embed to Discord's limits: field caps first (title,
 * field names/values, field count, description), then the 6000-char total —
 * shed trailing description with a link-out note rather than emit an invalid
 * embed. Measures rendered markdown (URLs included).
 */
function enforce(embed: LookupEmbed): LookupEmbed {
  embed.title = truncate(embed.title, LIMIT.title)
  embed.fields = embed.fields.slice(0, LIMIT.fields).map((f) => ({
    name: truncate(f.name, LIMIT.fieldName),
    value: truncate(f.value, LIMIT.fieldValue),
    inline: f.inline,
  }))
  if (embed.description) embed.description = truncate(embed.description, LIMIT.description)

  const fieldsLen = embed.fields.reduce((n, f) => n + f.name.length + f.value.length, 0)
  const fixed = embed.title.length + embed.footer.length + fieldsLen
  const linkNote = embed.url ? `\n\n[Full entry on salvageunion.io](${embed.url})` : ''
  const budget = LIMIT.total - fixed - linkNote.length
  if (embed.description && embed.description.length > budget) {
    embed.description =
      stripDanglingLink(truncate(embed.description, Math.max(0, budget))) + linkNote
  }
  return embed
}

/** The first number in a roll key ("11-19" → 11, "20" → 20). */
function rollKeyStart(key: string): number {
  const n = Number.parseInt(key.split('-')[0]?.trim() ?? '', 10)
  return Number.isNaN(n) ? 0 : n
}

/** One row of a d20 table: `` `key` **label** — value ``, trait refs linked. */
function renderTableRow(key: string, entry: SURefObjectTableContent): string {
  const label = entry.label ? `**${escapeLabel(entry.label)}** — ` : ''
  return `\`${key}\` ${label}${linkifyTraitRefs(entry.value ?? '')}`.trimEnd()
}

/**
 * Render a roll-table's full contents into the embed. Flat-family tables go
 * into the description (which enforce() sheds to fit the 6000-char budget,
 * appending a link-out on the largest tables). A `columns` table is
 * two-dimensional — roll a column, then a 1-20 entry within it — so each column
 * bucket becomes its own field.
 */
function rollTableSections(
  table: SURefObjectTable,
  name: string,
  sections: string[],
  fields: LookupEmbed['fields']
): void {
  const hint = `Roll it with \`/su roll table: ${name}\`.`
  if (table.type === 'columns') {
    sections.push(`${hint} Two rolls: first the column, then the entry (1-20).`)
    for (const [columnKey, column] of Object.entries(table)) {
      // `typeof column === 'string'` skips the `type` discriminant, leaving
      // only the column buckets (each a 1-20 map of table entries).
      if (typeof column === 'string') continue
      const entries = Object.entries(column)
        .sort(([a], [b]) => rollKeyStart(a) - rollKeyStart(b))
        .map(([entryKey, entry]) => `${entryKey}. ${linkifyTraitRefs(entry.value ?? '')}`)
      fields.push({ name: `Roll ${columnKey}`, value: entries.join('\n') || '—', inline: true })
    }
    return
  }
  // Lead with the roll hint so it survives description-shedding on huge tables.
  sections.push(hint)
  const rows = Object.entries(table)
    // High roll first, to match the web's RollTable ordering. The `type`
    // discriminant is the only string value; the rest are table entries.
    .sort(([a], [b]) => rollKeyStart(b) - rollKeyStart(a))
    .flatMap(([key, entry]) => (typeof entry === 'string' ? [] : [renderTableRow(key, entry)]))
  if (rows.length) sections.push(rows.join('\n'))
}

/**
 * Build the full lookup embed for any entity. `entity` must carry its
 * `schemaName` (the lookup command attaches it).
 */
export function buildLookupEmbed(
  entity: SURefEntity & { schemaName?: SURefEnumSchemaName },
  schemaName: SURefEnumSchemaName
): LookupEmbed {
  const name = entity.name
  const displayType = SchemaToDisplayName[schemaName] ?? schemaName

  const fields: LookupEmbed['fields'] = [{ name: 'Type', value: displayType, inline: true }]
  const sections: string[] = []

  // Lead description: an entity's own `description`, then its content blocks.
  if ('description' in entity && entity.description) {
    sections.push(linkifyTraitRefs(entity.description))
  }
  // Chassis ability/flavor text carries [(CHASSIS)] placeholders — replace
  // with the chassis name, as the web does. Non-chassis entities have no
  // chassis context, so the token is left as-is (also matching the web).
  const chassisName = schemaName === 'chassis' ? name : undefined
  const ownContent = flattenContent(entity.content, chassisName)
  if (ownContent) sections.push(ownContent)

  if (schemaName === 'chassis' && 'chassisAbilities' in entity) {
    const { fields: chassisFields, patterns } = chassisSections(entity)
    const tl = getTechLevel(entity)
    if (tl !== undefined) fields.push({ name: 'Tech Level', value: String(tl), inline: true })
    const sv = getSalvageValue(entity)
    if (sv !== undefined) fields.push({ name: 'Salvage Value', value: String(sv), inline: true })
    fields.push(...chassisFields)
    for (const ability of getChassisAbilities(entity) ?? []) {
      sections.push(renderAction(ability, name, chassisName))
    }
    if (patterns) sections.push(patterns)
  } else if (schemaName === 'roll-tables' && 'table' in entity) {
    rollTableSections(entity.table, name, sections, fields)
  } else {
    fields.push(...statFields(entity))
    for (const action of extractVisibleActions(entity) ?? []) {
      sections.push(renderAction(action, name))
    }
  }

  return enforce({
    title: name,
    url: `${BASE}/schema/${schemaName}/item/${getEntitySlug(entity)}`,
    color: NEUTRAL,
    description: sections.filter(Boolean).join('\n\n') || undefined,
    fields,
    footer: footerFor(entity),
  })
}
