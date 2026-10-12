/**
 * The `/su lookup` card — the shared Discord card plus the controls only the
 * bot can add.
 *
 * The card itself is `discordCardParts` (salvageunion-reference, fed by the
 * entity model): the same renderer the SRD puts in each page's head as a
 * Component Embed, so a lookup and a pasted salvageunion.io link read as one
 * product and cannot disagree. Nothing about an entity is computed here. The
 * design is `docs/architecture/discord-bot-refresh.md`.
 *
 * What the bot adds, all stateless (`customId.ts`):
 *
 * - **Tabs.** An entity with patterns gets Overview and Patterns tabs that
 *   redraw the same message (`su:view`), and the Patterns tab pages through
 *   them two at a time. Nothing is dropped to fit: it moves to a tab or a page.
 * - **The pattern picker.** A select (`su:peek`) answers privately with the
 *   picked pattern's card: a Peek, read-only and terminal (EDL E16).
 * - **Roll buttons** for the entity's own table and every table its actions
 *   roll on, so a chained roll is one tap.
 */

import { ButtonStyle } from 'discord-api-types/v10'
import type {
  DiscordCard,
  SURefEntity,
  SURefEnumSchemaName,
  SURefObjectAnyPattern,
} from 'salvageunion-reference'
import {
  discordAccent,
  discordCard,
  discordCardParts,
  escapeMarkdownLabel,
  extractPatternActions,
  findEntityBySlug,
  getEntitySlug,
  getPatterns,
  isBioTitanPattern,
  isSchemaName,
  nameToSlug,
  resolveFormerSlug,
  toEntityModel,
} from 'salvageunion-reference'
import type { ButtonSpec, ContainerBlock, ContainerData } from './container.js'
import { containerTextLength, V2_LIMIT } from './container.js'
import { makeCustomId } from './customId.js'

/** An entity the lookup resolved, with the schema it came from. */
export type LookupHit = {
  schemaName: SURefEnumSchemaName
  entity: SURefEntity & { schemaName: SURefEnumSchemaName }
}

/** Which view of the card: a tab, and a page within it. */
export type LookupView = { tab: 'overview' | 'patterns'; page: number }

const OVERVIEW: LookupView = { tab: 'overview', page: 0 }

/** Patterns on one page of the Patterns tab. */
const PATTERNS_PER_PAGE = 2

/** Roll buttons beside the two tabs: one row holds five. */
const MAX_ROLL_BUTTONS = 3

/**
 * The stable key for an entity: `schemaName::slug`. It is the autocomplete
 * choice value and rides in every lookup control's custom id (the longest
 * slug is 44 characters, so the id stays under Discord's 100).
 */
export function lookupKey(hit: LookupHit): string {
  return `${hit.schemaName}::${getEntitySlug(hit.entity)}`
}

/**
 * The entity a key names, or null. The key round-trips through the Discord
 * client, so the schema half is validated rather than asserted. A slug
 * retired by ADR-043 (the Hill Worm, once its own Bio-Titan) answers with the
 * host that now carries it.
 */
export function entityFromKey(key: string): LookupHit | null {
  const separator = key.indexOf('::')
  if (separator === -1) return null
  const schemaName = key.slice(0, separator)
  if (!isSchemaName(schemaName)) return null
  const slug = key.slice(separator + 2)
  const entity = findEntityBySlug(schemaName, slug) ?? resolveFormerSlug(schemaName, slug)?.host
  if (!entity) return null
  return { schemaName, entity: { ...entity, schemaName } }
}

/** `su:view:<key>|<tab>` for a tab, `…|<tab>|<page>` for a page, `…|i` for the page readout. */
function viewId(
  key: string,
  tab: LookupView['tab'],
  page?: number,
  readout = false
): string | null {
  const suffix = page === undefined ? '' : `|${page}${readout ? '|i' : ''}`
  return makeCustomId('view', `${key}|${tab}${suffix}`)
}

/** The inverse of a `su:view` payload, or null when it is not one. */
export function parseViewPayload(payload: string): { key: string; view: LookupView } | null {
  const [key, tab, page] = payload.split('|')
  if (!key || (tab !== 'overview' && tab !== 'patterns')) return null
  const n = Number.parseInt(page ?? '0', 10)
  return { key, view: { tab, page: Number.isFinite(n) && n > 0 ? n : 0 } }
}

/** The most the bot's own additions (pattern summary, a pattern page) may print. */
const ADDITIONS_MAX = 1800

/**
 * Lines that fit `max` characters, whole: the rest is counted in a closing
 * line that says where they are. A summary never cuts a name in half.
 */
function boundedLines(lines: string[], max: number, more: (n: number) => string): string[] {
  const kept: string[] = []
  let used = 0
  for (const [index, line] of lines.entries()) {
    const remaining = lines.length - index
    const reserve = remaining > 1 ? more(remaining).length + 1 : 0
    if (used + line.length + 1 + reserve > max) {
      kept.push(more(remaining))
      return kept
    }
    kept.push(line)
    used += line.length + 1
  }
  return kept
}

/** A card's text as Discord counts it, plus what the bot adds beside it. */
const fitsWith =
  (extra: number) =>
  (card: DiscordCard): boolean =>
    containerTextLength({ accent: 0, blocks: card.blocks }) + extra <= V2_LIMIT.totalText

/** One pattern as a summary line: `**[Hauler](…)** · `7` systems · `2` modules`. */
function patternLine(host: SURefEntity, pattern: SURefObjectAnyPattern): string {
  const parts = discordCardParts(toEntityModel(host, undefined, { pattern }))
  const label = escapeMarkdownLabel(pattern.name)
  const name = parts.url ? `**[${label}](${parts.url})**` : `**${label}**`
  const facts = isBioTitanPattern(pattern)
    ? [`adds \`${extractPatternActions(pattern).length}\` actions`]
    : parts.children.map((group) => `\`${group.count}\` ${group.label.toLowerCase()}`)
  const legal =
    'legalStarting' in pattern && pattern.legalStarting === true ? ['legal starting'] : []
  return [name, ...facts, ...legal].join(' · ')
}

/** One pattern as a page entry: its name, its prose, and what it adds. */
function patternEntry(host: SURefEntity, pattern: SURefObjectAnyPattern): string {
  const parts = discordCardParts(toEntityModel(host, undefined, { pattern }))
  const legal = 'legalStarting' in pattern && pattern.legalStarting === true
  const lines = [
    `### ${parts.url ? `[${escapeMarkdownLabel(pattern.name)}](${parts.url})` : escapeMarkdownLabel(pattern.name)}`,
    ...(legal ? ['-# Legal starting pattern'] : []),
    ...parts.prose,
    ...parts.children.map(
      (group) => `-# ${group.label.toUpperCase()} (${group.count})\n${group.line}`
    ),
    // A Bio-Titan pattern's difference is the actions it adds, ahead of the
    // ones it inherits.
    ...parts.actions.slice(0, extractPatternActions(pattern).length).map((action) => action.text),
  ]
  return lines.join('\n')
}

function patternSelect(key: string, patterns: SURefObjectAnyPattern[]): ContainerBlock | null {
  const customId = makeCustomId('peek', key)
  if (!customId) return null
  return {
    kind: 'select',
    customId,
    placeholder: 'Open a pattern…',
    options: patterns.slice(0, V2_LIMIT.selectOptions).map((pattern) => ({
      label: pattern.name,
      value: nameToSlug(pattern.name),
      ...(isBioTitanPattern(pattern) ? {} : { description: 'Mech pattern' }),
    })),
  }
}

/** The roll buttons: the entity's own table, then each table its actions roll on. */
function rollButtons(
  schemaName: SURefEnumSchemaName,
  parts: ReturnType<typeof discordCardParts>
): ButtonSpec[] {
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
      schemaName === 'roll-tables' && index === 0 ? 'Roll on this table' : `Roll ${name}`
    return [{ kind: 'action' as const, customId, label, style: ButtonStyle.Primary }]
  })
}

/**
 * Build the lookup card for an entity, on a tab and page (the Overview by
 * default). `entity` must carry its `schemaName`.
 */
export function lookupCard(
  entity: SURefEntity & { schemaName: SURefEnumSchemaName },
  schemaName: SURefEnumSchemaName,
  view: LookupView = OVERVIEW
): ContainerData {
  const parts = discordCardParts(toEntityModel(entity))
  const key = lookupKey({ schemaName, entity })
  const patterns = getPatterns(entity) ?? []
  const tab = patterns.length > 0 ? view.tab : 'overview'

  const select = patterns.length > 0 ? patternSelect(key, patterns) : null
  const tabs: ButtonSpec[] =
    patterns.length > 0
      ? (['overview', 'patterns'] as const).flatMap((name) => {
          const customId = viewId(key, name)
          return customId
            ? [
                {
                  kind: 'action' as const,
                  customId,
                  label: name === 'overview' ? 'Overview' : `Patterns (${patterns.length})`,
                  disabled: name === tab,
                },
              ]
            : []
        })
      : []
  const controls: ContainerBlock[] = []
  const row = [...tabs, ...rollButtons(schemaName, parts)]

  let card: DiscordCard
  let insert: ContainerBlock[] = []

  if (tab === 'patterns') {
    const pages = Math.ceil(patterns.length / PATTERNS_PER_PAGE)
    const page = Math.min(view.page, pages - 1)
    const shown = patterns.slice(page * PATTERNS_PER_PAGE, (page + 1) * PATTERNS_PER_PAGE)
    const entries = shown.map((pattern) => patternEntry(entity, pattern))
    insert = [
      { kind: 'separator' },
      {
        kind: 'text',
        content: [
          `-# PATTERNS (${patterns.length}) · PAGE ${page + 1} OF ${pages}`,
          ...boundedLines(
            entries,
            ADDITIONS_MAX,
            () => '-# …the rest of this page is on salvageunion.io'
          ),
        ].join('\n'),
      },
    ]
    const pager: ButtonSpec[] = [
      { id: viewId(key, 'patterns', page - 1), label: '‹', disabled: page === 0 },
      { id: viewId(key, 'patterns', page, true), label: `${page + 1} / ${pages}`, disabled: true },
      { id: viewId(key, 'patterns', page + 1), label: '›', disabled: page >= pages - 1 },
    ].flatMap(({ id, label, disabled }) =>
      id ? [{ kind: 'action' as const, customId: id, label, disabled }] : []
    )
    if (pages > 1) controls.push({ kind: 'buttons', buttons: pager })
    // The patterns ARE the page: the card keeps its head and cite only.
    card = discordCard(parts, {
      prose: false,
      actions: false,
      table: false,
      children: false,
      fits: fitsWith(containerTextLength({ accent: 0, blocks: insert })),
    })
  } else {
    if (patterns.length > 0) {
      insert = [
        {
          kind: 'text',
          content: [
            `-# PATTERNS (${patterns.length})`,
            ...boundedLines(
              patterns.map((pattern) => patternLine(entity, pattern)),
              ADDITIONS_MAX,
              (n) => `-# …and ${n} more on the Patterns tab`
            ),
          ].join('\n'),
        },
      ]
    }
    card = discordCard(parts, {
      fits: fitsWith(containerTextLength({ accent: 0, blocks: insert })),
    })
  }

  // The bot's additions sit above the foot rule: the cite stays last.
  const blocks: ContainerBlock[] = [...card.blocks]
  const foot = blocks.splice(-2, 2)
  blocks.push(...insert)
  if (select) blocks.push(select)
  blocks.push(...foot, ...controls)
  if (row.length > 0) blocks.push({ kind: 'buttons', buttons: row.slice(0, V2_LIMIT.rowButtons) })

  return { accent: discordAccent(card.tone), blocks }
}

/**
 * A pattern's Peek: its card, privately, read-only and terminal (EDL E16) — no
 * controls, its name linking its page.
 */
export function patternPeek(host: SURefEntity, patternSlug: string): ContainerData | null {
  const pattern = (getPatterns(host) ?? []).find((p) => nameToSlug(p.name) === patternSlug)
  if (!pattern) return null
  const card = discordCard(discordCardParts(toEntityModel(host, undefined, { pattern })), {
    fits: fitsWith(0),
  })
  return { accent: discordAccent(card.tone), blocks: card.blocks }
}
