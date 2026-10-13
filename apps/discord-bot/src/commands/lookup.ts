import type { ContainerBuilder, SlashCommandSubcommandBuilder } from '@discordjs/builders'
import { findEntityBySlug, getPatterns, nameToSlug, search } from 'salvageunion-reference'
import type { ContainerData } from '../container'
import { v2Reply } from '../container'
import { noEntryContainer } from '../errorContainer'
import type { LookupHit } from '../lookupCard'
import { entityFromKey, lookupCard, lookupKey, patternOf } from '../lookupCard'
import type { CommandAutocompleteInteraction, CommandExecuteInteraction } from './interactions'

/** A `/su lookup` reply ready for `interaction.reply`, or a user-facing error. */
export type LookupMessage =
  | { flags: number; components: [ContainerBuilder]; data: ContainerData }
  | { error: string }

/**
 * Build the lookup reply for a resolved entry or pattern. Shared by the
 * `/su lookup` slash handler, the older tab buttons (which redraw it), the older
 * "See table" buttons and the message context menu.
 */
export function buildLookupMessage(hit: LookupHit): {
  flags: number
  components: [ContainerBuilder]
  data: ContainerData
} {
  const data = lookupCard(hit)
  return { ...v2Reply(data), data }
}

/**
 * Build the lookup reply for a roll-table addressed by name — what the "See
 * table" button on a `/su roll` result invokes. Resolves the table via its slug
 * (the button carries the exact table name); returns an error if it's gone.
 */
export function buildTableLookupMessage(tableName: string): LookupMessage {
  const slug = nameToSlug(tableName)
  const entity = slug ? findEntityBySlug('roll-tables', slug) : null
  if (!entity) {
    return { error: `Could not find table: "${tableName}".` }
  }
  return buildLookupMessage({
    schemaName: 'roll-tables',
    entity: { ...entity, schemaName: 'roll-tables' },
  })
}

/** Autocomplete's most choices, Discord's limit. */
const MAX_CHOICES = 25

/**
 * Autocomplete choices for a query: each entry the search finds, and any of its
 * patterns whose name the query names, as an entry of its own (the pattern's
 * card, not its host's). A pattern leads its host, since its name is what
 * matched.
 */
export function lookupChoices(query: string): { name: string; value: string }[] {
  const needle = query.trim().toLowerCase()
  const choices: { name: string; value: string }[] = []
  for (const hit of search({ query, limit: MAX_CHOICES })) {
    const entity = { ...hit.entity, schemaName: hit.schemaName }
    const hostName =
      'name' in hit.entity && hit.entity.name ? String(hit.entity.name) : hit.entity.id
    for (const pattern of getPatterns(hit.entity) ?? []) {
      if (!pattern.name.toLowerCase().includes(needle)) continue
      choices.push({
        name: `${pattern.name} (${hostName} pattern)`.slice(0, 100),
        value: lookupKey({ schemaName: hit.schemaName, entity, pattern }),
      })
    }
    choices.push({
      name: hostName.slice(0, 100),
      value: lookupKey({ schemaName: hit.schemaName, entity }),
    })
  }
  return choices.slice(0, MAX_CHOICES)
}

/**
 * What free-typed text looks up: the top search hit, or one of its patterns
 * when the text is that pattern's name.
 */
function typedHit(input: string): LookupHit | null {
  const [top] = search({ query: input, limit: 1 })
  if (!top) return null
  const entity = { ...top.entity, schemaName: top.schemaName }
  const pattern = patternOf(top.entity, nameToSlug(input))
  return pattern
    ? { schemaName: top.schemaName, entity, pattern }
    : { schemaName: top.schemaName, entity }
}

export const lookupCommand = {
  /** Options for the `/su lookup` subcommand (registered by su.ts). */
  subcommand(sub: SlashCommandSubcommandBuilder): SlashCommandSubcommandBuilder {
    return sub
      .setName('lookup')
      .setDescription('Look up any Salvage Union entity (equipment, chassis, systems, keywords, …)')
      .addStringOption((option) =>
        option
          .setName('entity')
          .setDescription('What to look up')
          .setRequired(true)
          .setAutocomplete(true)
      )
  },

  async autocomplete(interaction: CommandAutocompleteInteraction): Promise<void> {
    const focusedValue = interaction.options.getFocused()
    if (!focusedValue.trim()) {
      await interaction.respond([])
      return
    }
    await interaction.respond(lookupChoices(focusedValue))
  },

  async execute(interaction: CommandExecuteInteraction): Promise<void> {
    const input = interaction.options.getString('entity', true)

    // Autocomplete selections arrive as `schemaName::slug[::pattern]`;
    // free-typed text falls back to the top search hit, or its pattern.
    const hit = entityFromKey(input) ?? typedHit(input)

    if (!hit) {
      // An in-system 'no such entry' container pointing at `entity:`
      // autocomplete (no suggestion buttons — the lookup already fell back to
      // the top search hit). Errors are always ephemeral.
      await interaction.reply(v2Reply(noEntryContainer(input), true))
      return
    }

    const { data: _data, ...payload } = buildLookupMessage(hit)
    await interaction.reply(payload)
  },
}
