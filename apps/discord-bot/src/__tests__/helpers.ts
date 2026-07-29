import { handleButtonInteraction } from '../buttons.js'
import type { CommandButtonInteraction } from '../commands/interactions.js'
import type { ReplyArg } from './fakeInteraction.js'

/**
 * A fake button interaction, wired to the real router.
 *
 * Lives alongside `fakeInteraction.ts` and satisfies `CommandButtonInteraction`
 * structurally, so no cast is needed — which is the point of the router taking
 * a narrow type rather than discord.js's `ButtonInteraction` class.
 */
export function buttonInteractionHandlerFor(customId: string): {
  handle: () => Promise<void>
  replies: ReplyArg[]
  edits: ReplyArg[]
} {
  const replies: ReplyArg[] = []
  const edits: ReplyArg[] = []

  const interaction: CommandButtonInteraction = {
    customId,
    client: { user: null },
    user: { id: 'discord-tester' },
    channelId: 'chan-1',
    reply: (arg: ReplyArg) => {
      replies.push(arg)
      return Promise.resolve()
    },
    editReply: (arg: ReplyArg) => {
      edits.push(arg)
      return Promise.resolve()
    },
  }

  return { handle: () => handleButtonInteraction(interaction), replies, edits }
}
