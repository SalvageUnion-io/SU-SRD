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
} from 'salvageunion-reference'
import type { SURefEntity, SURefEnumSchemaName, SURefMetaAction } from 'salvageunion-reference'

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

type AnyRecord = Record<string, unknown>

/** Escape the chars that would break a markdown link label. */
function escapeLabel(text: string): string {
  return text.replace(/[[\]()]/g, '\\$&')
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

type ContentBlock = {
  type?: string
  value?: unknown
  label?: string
  items?: { type?: string; value?: unknown; label?: string }[]
}

type DataValue = { label: string | number; value?: string | number; unit?: string }

function renderDataValues(values: DataValue[]): string {
  return values
    .map((dv) =>
      dv.value !== undefined && dv.value !== ''
        ? `**${dv.label}:** ${dv.value}${dv.unit ? ` ${dv.unit}` : ''}`
        : `**${dv.label}**`
    )
    .join(' · ')
}

/** Flatten structured content blocks into Discord-flavored markdown. */
function flattenContent(blocks: ContentBlock[] | undefined): string {
  if (!Array.isArray(blocks)) return ''
  const sections: string[] = []
  for (const block of blocks) {
    const type = block.type ?? 'paragraph'
    if (Array.isArray(block.value)) {
      const dv = renderDataValues(block.value as DataValue[])
      if (dv) sections.push(dv)
      continue
    }
    const text = typeof block.value === 'string' ? block.value.trim() : ''
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
          .map((it) => (typeof it.value === 'string' ? it.value.trim() : ''))
          .filter(Boolean)
          .map((v) => `• ${v}`)
      : []
    const combined = [line, ...items].filter(Boolean).join('\n')
    if (combined) sections.push(combined)
  }
  return sections.join('\n\n')
}

type Trait = { type?: string; amount?: number }
type Damage = { amount?: number; damageType?: string }

/** Traits an action carries, each linked to its glossary page. */
function renderTraits(traits: unknown): string {
  if (!Array.isArray(traits)) return ''
  const parts = (traits as Trait[])
    .filter((t) => typeof t.type === 'string')
    .map((t) => {
      const link = entityLink('traits', t.type as string)
      return typeof t.amount === 'number' ? `${link} ${t.amount}` : link
    })
  return parts.join(', ')
}

/** One-line stat summary for an action (range / damage / cost / type). */
function actionStatLine(action: AnyRecord): string {
  const parts: string[] = []
  if (Array.isArray(action['range']) && action['range'].length) {
    parts.push(`**Range:** ${(action['range'] as string[]).join('/')}`)
  }
  const dmg = action['damage'] as Damage | undefined
  if (dmg && typeof dmg.amount === 'number') {
    parts.push(`**Damage:** ${dmg.amount}${dmg.damageType ? ` ${dmg.damageType}` : ''}`)
  }
  if (typeof action['activationCost'] === 'number') {
    const cur =
      typeof action['activationCurrency'] === 'string' ? ` ${action['activationCurrency']}` : ''
    parts.push(`**Cost:** ${action['activationCost']}${cur}`)
  }
  if (typeof action['actionType'] === 'string' && action['actionType'] !== 'Passive') {
    parts.push(`**${action['actionType']}**`)
  }
  return parts.join(' • ')
}

/** Render one resolved action to a markdown chunk. `ownName` suppresses a
 *  redundant title when the action shares the entity's name. */
function renderAction(action: SURefMetaAction, ownName: string): string {
  const a = action as unknown as AnyRecord
  const title = (a['displayName'] as string) || (a['name'] as string) || ''
  const lines: string[] = []
  if (title && title !== ownName) lines.push(`__${escapeLabel(title)}__`)

  const stat = actionStatLine(a)
  if (stat) lines.push(stat)

  const body = flattenContent(a['content'] as ContentBlock[] | undefined)
  if (body) lines.push(body)

  const traits = renderTraits(a['traits'])
  if (traits) lines.push(`**Traits:** ${traits}`)

  if (typeof a['tableName'] === 'string' && a['tableName']) {
    lines.push(`**Rolls on:** ${entityLink('roll-tables', a['tableName'] as string)}`)
  }
  if (typeof a['drone'] === 'string' && a['drone']) {
    lines.push(`**Deploys:** ${entityLink('drones', a['drone'] as string)}`)
  }
  const choices = a['choices']
  if (Array.isArray(choices)) {
    for (const c of choices as AnyRecord[]) {
      const cname = typeof c['name'] === 'string' ? c['name'] : 'Choice'
      const cbody = flattenContent(c['content'] as ContentBlock[] | undefined)
      const table =
        typeof c['rollTable'] === 'string' && c['rollTable']
          ? ` (${entityLink('roll-tables', c['rollTable'] as string)})`
          : ''
      lines.push(`**Choice — ${escapeLabel(cname)}:**${table}${cbody ? ` ${cbody}` : ''}`)
    }
  }
  return lines.join('\n')
}

function statFields(entity: AnyRecord): LookupEmbed['fields'] {
  const fields: LookupEmbed['fields'] = []
  const push = (name: string, value: unknown) => {
    if (value !== undefined && value !== null && value !== '') {
      fields.push({ name, value: String(value), inline: true })
    }
  }
  const tl = getTechLevel(entity as unknown as SURefEntity)
  push('Tech Level', tl)
  push('Salvage Value', getSalvageValue(entity as unknown as SURefEntity))
  push('Slots', getSlotsRequired(entity as unknown as SURefEntity))
  return fields
}

/** Chassis-specific stat grid + patterns (a genuine structural special case). */
function chassisSections(entity: AnyRecord): { fields: LookupEmbed['fields']; patterns: string } {
  const fields: LookupEmbed['fields'] = []
  const push = (name: string, value: unknown) => {
    if (typeof value === 'number') fields.push({ name, value: String(value), inline: true })
  }
  push('Structure', entity['structurePoints'])
  push('Energy', entity['energyPoints'])
  push('Heat Cap', entity['heatCapacity'])
  push('Cargo Cap', entity['cargoCapacity'])
  push('System Slots', entity['systemSlots'])
  push('Module Slots', entity['moduleSlots'])

  let patterns = ''
  if (Array.isArray(entity['patterns']) && entity['patterns'].length) {
    const rows = (entity['patterns'] as AnyRecord[]).map((p) => {
      const name = typeof p['name'] === 'string' ? escapeLabel(p['name']) : 'Pattern'
      const systems = Array.isArray(p['systems']) ? (p['systems'] as AnyRecord[]).length : 0
      const modules = Array.isArray(p['modules']) ? (p['modules'] as AnyRecord[]).length : 0
      const legal = p['legalStarting'] ? ' ✅' : ''
      return `• **${name}**${legal} — ${systems} systems, ${modules} modules`
    })
    patterns = `**Patterns**\n${rows.join('\n')}`
  }
  return { fields, patterns }
}

function footerFor(entity: AnyRecord): string {
  const parts: string[] = []
  if (typeof entity['source'] === 'string') parts.push(entity['source'])
  const page = getPageReference(entity as unknown as SURefEntity)
  if (typeof page === 'number') parts.push(`p.${page}`)
  parts.push('Salvage Union Reference')
  return truncate(parts.join(' · '), LIMIT.footer)
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
    embed.description = truncate(embed.description, Math.max(0, budget)) + linkNote
  }
  return embed
}

/**
 * Build the full lookup embed for any entity. `entity` must carry its
 * `schemaName` (the lookup command attaches it).
 */
export function buildLookupEmbed(
  entity: SURefEntity & { schemaName?: SURefEnumSchemaName },
  schemaName: SURefEnumSchemaName
): LookupEmbed {
  const e = entity as unknown as AnyRecord
  const name = typeof e['name'] === 'string' ? (e['name'] as string) : entity.id
  const displayType = (SchemaToDisplayName as Record<string, string>)[schemaName] ?? schemaName

  const fields: LookupEmbed['fields'] = [{ name: 'Type', value: displayType, inline: true }]
  const sections: string[] = []

  // Lead description: an entity's own `description`, then its content blocks.
  if (typeof e['description'] === 'string' && e['description']) {
    sections.push(e['description'] as string)
  }
  const ownContent = flattenContent(e['content'] as ContentBlock[] | undefined)
  if (ownContent) sections.push(ownContent)

  if (schemaName === 'chassis') {
    const { fields: chassisFields, patterns } = chassisSections(e)
    const tl = getTechLevel(entity)
    if (tl !== undefined) fields.push({ name: 'Tech Level', value: String(tl), inline: true })
    const sv = getSalvageValue(entity)
    if (sv !== undefined) fields.push({ name: 'Salvage Value', value: String(sv), inline: true })
    fields.push(...chassisFields)
    for (const ability of getChassisAbilities(entity) ?? []) {
      sections.push(renderAction(ability, name))
    }
    if (patterns) sections.push(patterns)
  } else if (schemaName === 'roll-tables') {
    // Don't inline table rows — that duplicates /su roll and blows budget.
    sections.push(`Roll on this table with \`/su roll table: ${name}\`.`)
  } else {
    fields.push(...statFields(e))
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
    footer: footerFor(e),
  })
}
