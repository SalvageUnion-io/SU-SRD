import { handleButtonInteraction } from '../buttons'
import type { CommandButtonInteraction } from '../commands/interactions'
import type { ReplyArg } from './fakeInteraction'

/**
 * A fake button interaction, wired to the real router.
 *
 * Lives alongside `fakeInteraction.ts` and satisfies `CommandButtonInteraction`
 * structurally, so no cast is needed — the same contract `worker/adapter.ts`
 * (`makeButtonInteraction`) builds from the raw interaction.
 */
export function buttonInteractionHandlerFor(
  customId: string,
  userId = 'discord-tester'
): {
  handle: () => Promise<void>
  replies: ReplyArg[]
} {
  const replies: ReplyArg[] = []

  const interaction: CommandButtonInteraction = {
    customId,
    user: { id: userId, displayName: 'Alex' },
    reply: (arg: ReplyArg) => {
      replies.push(arg)
      return Promise.resolve()
    },
  }

  return { handle: () => handleButtonInteraction(interaction), replies }
}
