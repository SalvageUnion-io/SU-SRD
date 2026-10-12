import { handleButtonInteraction } from '../buttons.js'
import type { CommandButtonInteraction } from '../commands/interactions.js'
import type { ReplyArg } from './fakeInteraction.js'

/**
 * A fake button interaction, wired to the real router.
 *
 * Lives alongside `fakeInteraction.ts` and satisfies `CommandButtonInteraction`
 * structurally, so no cast is needed — the same contract `worker/adapter.ts`
 * (`makeButtonInteraction`) builds from the raw interaction.
 */
export function buttonInteractionHandlerFor(
  customId: string,
  values: readonly string[] = [],
  userId = 'discord-tester'
): {
  handle: () => Promise<void>
  replies: ReplyArg[]
  updates: ReplyArg[]
  edits: ReplyArg[]
} {
  const replies: ReplyArg[] = []
  const updates: ReplyArg[] = []
  const edits: ReplyArg[] = []

  const interaction: CommandButtonInteraction = {
    customId,
    values,
    user: { id: userId, displayName: 'Alex' },
    channelId: 'chan-1',
    reply: (arg: ReplyArg) => {
      replies.push(arg)
      return Promise.resolve()
    },
    update: (arg: ReplyArg) => {
      updates.push(arg)
      return Promise.resolve()
    },
    editReply: (arg: ReplyArg) => {
      edits.push(arg)
      return Promise.resolve()
    },
  }

  return { handle: () => handleButtonInteraction(interaction), replies, updates, edits }
}
