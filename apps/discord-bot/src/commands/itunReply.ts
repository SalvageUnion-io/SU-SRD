import { MessageFlags } from 'discord-api-types/v10'
import type { ContainerData } from '../container.js'
import { toContainer } from '../container.js'
import { denialMessage, ITUN_ORIGIN } from '../gameCards.js'
import type { ItunClient } from '../itun/client.js'
import { createItunClient } from '../itun/client.js'
import type { ItunResult } from '../itun/types.js'
import type { CommandExecuteInteraction } from './interactions.js'

/**
 * The shared spine of every ITUN Game command (ADR-030 Phase 6).
 *
 * Three things are identical across all of them and are therefore in one place
 * rather than six:
 *
 *  1. **Deferring.** Discord gives a command 3 seconds to acknowledge. A round
 *     trip to Convex usually fits and must not be assumed to, so every Game
 *     subcommand defers before it calls anything.
 *  2. **The result kinds.** Ok, denied and unavailable each want different
 *     words. A single exhaustive branch here means no command can quietly
 *     forget one.
 *  3. **Ephemerality.** Denials and errors are *always* ephemeral, whatever the
 *     command's own visibility. That is what makes it safe to state the actual
 *     reason: an ephemeral reply is seen only by the person who asked, so it
 *     never announces to a public channel who holds an account.
 */

/**
 * The bot's ITUN client. Unconfigured until the Worker installs one from its
 * `env` — configuration does not exist on workerd until `fetch` is called — and
 * an unconfigured client answers every call `unavailable`.
 */
let client: ItunClient = createItunClient({})

/** The current client. */
export function itun(): ItunClient {
  return client
}

/**
 * Install the client, returning a function that puts the previous one back.
 *
 * The Worker calls it per request with a client built from `env`; tests call it
 * with a fake and `afterEach(restore)`. A test cannot set an environment
 * variable instead (configuration arrives as the Worker's `env`), and
 * `mock.module` is process-global in Bun, so faking it for one file would hand
 * that fake to every file that ran afterwards.
 */
export function setItunClient(next: ItunClient): () => void {
  const previous = client
  client = next
  return () => {
    client = previous
  }
}

/** The V2 payload for a rendered Game result, at the given visibility. */
function containerPayload(data: ContainerData, ephemeral: boolean) {
  return {
    flags: ephemeral
      ? MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
      : MessageFlags.IsComponentsV2,
    components: [toContainer(data)],
  }
}

/**
 * Run one ITUN call and render it, or explain precisely why it could not run.
 *
 * `render` is only ever reached on success, so a command handler contains no
 * failure branches of its own — which is the point. Every command that forgets
 * to handle "not signed in" is a command that silently does nothing, and this
 * makes forgetting impossible rather than merely discouraged.
 *
 * `visibility: 'public'` posts the rendered result to the channel; failures are
 * **always** ephemeral, whatever the command asked for.
 *
 * That guarantee is why every command defers ephemerally and a public result is
 * then sent as a follow-up, rather than the obvious "defer with the command's
 * own visibility". Discord fixes ephemerality at defer time and will not let it
 * change afterwards, so deferring publicly would put "you are not a member of
 * this game" — a fact about a person — into the channel for everyone. The
 * follow-up costs one extra ephemeral line ("Posted to the channel.") and buys
 * the invariant outright.
 */
export async function respondWithItun<T>(
  interaction: CommandExecuteInteraction,
  options: {
    visibility?: 'public' | 'ephemeral'
    call: (client: ItunClient) => Promise<ItunResult<T>>
    render: (value: T) => ContainerData
  }
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral })

  const result = await options.call(itun())
  switch (result.kind) {
    case 'ok': {
      const ephemeral = options.visibility !== 'public'
      // Always a follow-up: a new message carries the V2 flag from creation,
      // where an edit of the deferred placeholder would be a toggle Discord
      // refuses. See the note above.
      await interaction.followUp(containerPayload(options.render(result.value), ephemeral))
      // The placeholder still has to become something, or it sits on
      // "thinking…" forever. Mirrors the public path's grammar.
      await interaction.editReply({
        content: ephemeral ? 'Rendered below.' : 'Posted to the channel.',
      })
      return
    }
    case 'denied':
      await interaction.editReply({
        content: denialMessage(result.reason, ITUN_ORIGIN, result.message),
      })
      return
    case 'unavailable':
      await interaction.editReply({ content: result.message })
      return
  }
}
