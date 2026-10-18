import type { SlashCommandSubcommandBuilder } from '@discordjs/builders'
import { MessageFlags } from 'discord-api-types/v10'
import type { SheetKind } from 'game-domain/entityKinds'
import { TABLE_OF_KIND } from 'game-domain/entityKinds'
import { bodyName, sheetCard } from '../gameCards'
import type { SheetTable } from '../play/types'
import { cantina, respondWithCantina } from './cantinaReply'
import type { CommandAutocompleteInteraction, CommandExecuteInteraction } from './interactions'

/**
 * `/su sheet` — the one Cantina command (ADR-030).
 *
 * The picker offers what is **yours**: every pilot, mech and crawler you own,
 * and the crawler of each Game you are in. Anything else — a crewmate's
 * sheet, a stranger's published one — is reached by pasting its link, the
 * `/sheet/…` or `/p/…` address the Cantina shows. The server decides what the caller
 * may read (theirs, a Game they belong to, or published), so the link is an
 * address, never a permission.
 *
 * It needs no channel and no binding: a sheet is a person's, not a channel's.
 * It writes nothing. ADR-030 §4 forbids a Mediator writing another player's
 * sheet on any surface, so there is deliberately no `/su damage` here.
 */

/** A Cantina sheet address: `/sheet/<kind>/<rowId>` or the public `/p/<kind>/<appId>`. */
const SHEET_LINK = /\/(?:sheet|p)\/(pilot|mech|crawler)\/([^/?#\s>]+)/

/**
 * What the `entity` option names: a picked `<table>:<id>`, or a pasted link.
 *
 * Parsed rather than trusted, because a user may type anything into an
 * autocomplete field. Null for anything else, so a typed name is answered with
 * how to use the command rather than sent to the server as an id.
 */
export function parseSheetTarget(raw: string): { table: SheetTable; entityId: string } | null {
  const text = raw.trim()
  const link = SHEET_LINK.exec(text)
  if (link?.[1] !== undefined && link[2] !== undefined) {
    const table = TABLE_OF_KIND[link[1] as SheetKind]
    try {
      return { table, entityId: decodeURIComponent(link[2]) }
    } catch {
      return null
    }
  }

  // Checked, not assumed: `indexOf` returns -1 with no colon, and slicing on
  // that silently yields `raw.slice(0, -1)` — so `mechsX` would parse as
  // table `mechs` and be sent to the server.
  const separator = text.indexOf(':')
  if (separator === -1) return null
  const table = text.slice(0, separator)
  const entityId = text.slice(separator + 1)
  if (table !== 'pilots' && table !== 'mechs' && table !== 'crawlers') return null
  if (entityId.length === 0) return null
  return { table, entityId }
}

export const sheetCommand = {
  subcommand(sub: SlashCommandSubcommandBuilder): SlashCommandSubcommandBuilder {
    return sub
      .setName('sheet')
      .setDescription('Read a sheet: pick one of yours, or paste a link to any other')
      .addStringOption((option) =>
        option
          .setName('entity')
          .setDescription('One of your pilots, mechs or crawlers, or a sheet link')
          .setRequired(true)
          .setAutocomplete(true)
      )
  },

  /**
   * Autocomplete over what the caller owns. Every failure yields an empty list:
   * an autocomplete has no way to explain itself, and Discord renders "no
   * options" perfectly well. A pasted link is not filtered against: it simply
   * matches nothing, and Discord sends the typed text as the value.
   */
  async autocomplete(interaction: CommandAutocompleteInteraction): Promise<void> {
    const result = await cantina().mineForAutocomplete(interaction.user.id)
    if (result.kind !== 'ok') {
      await interaction.respond([])
      return
    }

    const focused = interaction.options.getFocused().toLowerCase()
    const choices = [
      ...result.value.pilots.map((p) => ({
        name: `${bodyName(p.body, ['callsign', 'name'])} — pilot`,
        value: `pilots:${p.id}`,
      })),
      ...result.value.mechs.map((m) => ({
        name: `${bodyName(m.body, ['name'])} — mech`,
        value: `mechs:${m.id}`,
      })),
      ...result.value.crawlers.map((c) => ({
        name: `${bodyName(c.body, ['name'])} — crawler`,
        value: `crawlers:${c.id}`,
      })),
    ]
      .filter((choice) => choice.name.toLowerCase().includes(focused))
      .slice(0, 25) // Discord's hard cap on choices.

    await interaction.respond(choices)
  },

  async execute(interaction: CommandExecuteInteraction): Promise<void> {
    const target = parseSheetTarget(interaction.options.getString('entity', true))
    if (target === null) {
      await interaction.reply({
        content: 'Pick one of yours from the list, or paste a link to a sheet.',
        flags: MessageFlags.Ephemeral,
      })
      return
    }

    // EPHEMERAL, ALWAYS — never `visibility: 'public'`.
    //
    // Most sheets are private (ADR-032 makes a public URL opt-in and off by
    // default), so a public reply would post a sheet into the channel that has
    // no shareable page behind it: readers would see somebody's build, and any
    // link they tried to follow would 404. Reading is private; publishing is
    // the owner's separate, deliberate act.
    //
    // The default here is ephemeral, so this is a comment rather than a flag —
    // and `sheetVisibility.test.ts` holds it, because "someone adds
    // visibility: 'public' to make sharing easier" is exactly the plausible
    // future change that would break it silently.
    await respondWithCantina(interaction, {
      call: (client) => client.sheet(interaction.user.id, target.table, target.entityId),
      render: (value) => sheetCard(value),
    })
  },
}
