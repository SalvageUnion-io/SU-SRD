import type { SlashCommandSubcommandBuilder } from '@discordjs/builders'
import { MessageFlags } from 'discord-api-types/v10'
import { toContainer } from '../container.js'
import { denialMessage } from '../gameEmbed.js'
import { buildInviteDm, joinUrl } from '../inviteContainer.js'
import { itunSettings } from '../itunSettings.js'
import type { CommandAutocompleteInteraction, CommandExecuteInteraction } from './interactions.js'
import { itun, SOLO_NOTICE } from './itunReply.js'

/**
 * `/su invite @user` — invite somebody to a Game by their Discord account
 * (ADR-038 §3).
 *
 * **This command does not ask Convex to trust the bot.** Every other Game
 * command sends a Discord id the bot asserts; this one forwards Discord's
 * signed interaction verbatim (`interaction.signed`) and Convex verifies the
 * signature itself, then reads who is inviting, whom, into which Game and in
 * which seat out of those bytes. That is what keeps "a leaked bot secret
 * cannot invent a membership" true with an invite command in the bot.
 *
 * The rest is delivery. The bot DMs the invitee a link; a DM is best effort —
 * Discord refuses one when the bot and the invitee share no server, or the
 * invitee has DMs from server members switched off — so the outcome is
 * reported back onto the invite for the Organizer's list, and on failure the
 * Organizer is handed the link to pass on. Nothing is posted in the channel:
 * who is being invited where is the Organizer's to announce.
 *
 * A failed DM loses nothing either way. The invite is addressed to the
 * account, so it also waits on the invitee's hub in the app.
 */

/** Discord's "Cannot send messages to this user". */
const DM_REFUSED = 50007

export const inviteCommand = {
  subcommand(sub: SlashCommandSubcommandBuilder): SlashCommandSubcommandBuilder {
    return sub
      .setName('invite')
      .setDescription('Invite someone to one of your games (Organizer only)')
      .addUserOption((option) =>
        option.setName('user').setDescription('Who to invite').setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName('seat')
          .setDescription('The seat they take (default: Player)')
          .addChoices({ name: 'Player', value: 'player' }, { name: 'Mediator', value: 'mediator' })
      )
      .addStringOption((option) =>
        option
          .setName('game')
          .setDescription('Which game (default: the one this channel is bound to)')
          .setAutocomplete(true)
      )
  },

  /**
   * The caller's games that they organise. Inviting is the Organizer's act, so
   * listing the rest would only offer choices the server refuses.
   */
  async autocomplete(interaction: CommandAutocompleteInteraction): Promise<void> {
    const client = itun()
    if (client === null) {
      await interaction.respond([])
      return
    }

    const result = await client.gamesForAutocomplete(interaction.user.id)
    if (result.kind !== 'ok') {
      await interaction.respond([])
      return
    }

    const focused = interaction.options.getFocused().toLowerCase()
    await interaction.respond(
      result.value.games
        .filter((game) => game.organizer && game.name.toLowerCase().includes(focused))
        .slice(0, 25)
        .map((game) => ({ name: game.name, value: game.gameId }))
    )
  },

  async execute(interaction: CommandExecuteInteraction): Promise<void> {
    // Ephemeral throughout: only the Organizer learns how it went.
    await interaction.deferReply({ flags: MessageFlags.Ephemeral })

    const client = itun()
    if (client === null) {
      await interaction.editReply({ content: SOLO_NOTICE })
      return
    }
    if (interaction.signed === null) {
      await interaction.editReply({ content: 'That invite could not be verified. Try again.' })
      return
    }

    const webUrl = itunSettings().webUrl
    const result = await client.invite(interaction.signed)

    if (result.kind === 'unavailable') {
      await interaction.editReply({ content: result.message })
      return
    }
    if (result.kind === 'denied') {
      // An unbound channel has a fix specific to this command — the `game`
      // option — which the server's wording names and the generic one does not.
      await interaction.editReply({
        content:
          result.reason === 'unbound'
            ? result.message
            : denialMessage(result.reason, webUrl, result.message),
      })
      return
    }

    const invite = result.value
    if (invite.outcome === 'already-member') {
      await interaction.editReply({
        content: `**${invite.inviteeName}** is already in **${invite.gameName}**.`,
      })
      return
    }

    const seat = invite.role === 'mediator' ? ' as its Mediator' : ''
    const link = joinUrl(webUrl, invite.code)

    // The server says no fresh DM: this person was DMed this invite recently.
    // Re-offer the link to the Organizer and leave the invitee alone.
    if (!invite.deliver) {
      await interaction.editReply({
        content: [
          `**${invite.inviteeName}** already has an invite to **${invite.gameName}**${seat}, and I DMed it to them recently, so I haven’t sent it again.`,
          'It waits on their In The Union Now home page, or send them this link — only their Discord account can use it:',
          link,
        ].join('\n'),
      })
      return
    }

    const dm = await interaction.directMessage(invite.inviteeDiscordId, {
      components: [toContainer(buildInviteDm(invite, webUrl))],
      flags: MessageFlags.IsComponentsV2,
    })
    const detail = dm.ok
      ? undefined
      : dm.code === DM_REFUSED
        ? 'their DMs are closed, or they share no server with the bot'
        : 'Discord would not deliver it'

    // A note for the Organizer's invite list. If it does not land, the list
    // says "DM sending" instead — the invite itself is unaffected, and this
    // reply already tells the Organizer what happened.
    await client.inviteDelivery(interaction.user.id, invite.code, dm.ok ? 'sent' : 'failed', detail)

    const again = invite.reused ? 'They already had an invite, so I sent it again. ' : ''
    const content = dm.ok
      ? `${again}Invited **${invite.inviteeName}** to **${invite.gameName}**${seat}. I sent them a DM with the link, and it waits on their In The Union Now home page too.`
      : [
          `${again}Invited **${invite.inviteeName}** to **${invite.gameName}**${seat}, but I couldn’t DM them (${detail}).`,
          'Send them this link — only their Discord account can use it:',
          link,
          'It also waits on their In The Union Now home page once they sign in.',
        ].join('\n')
    await interaction.editReply({ content })
  },
}
