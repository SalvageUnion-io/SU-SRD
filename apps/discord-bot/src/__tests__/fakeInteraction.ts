import type {
  CommandAutocompleteInteraction,
  CommandExecuteInteraction,
} from '../commands/interactions.js'

/**
 * Fakes for the narrow interaction contracts in `commands/interactions.ts`.
 *
 * Every command test used to build its own inline fake, which meant adding one
 * member to `CommandExecuteInteraction` broke four files at once and had to be
 * fixed four times identically. They live here now, so widening the contract is
 * a one-file change — which is the point of the contract being narrow in the
 * first place.
 *
 * These satisfy the types **structurally**, with no casts. That is deliberate:
 * a cast would let a fake drift from the real interaction and still compile,
 * and the whole reason the handlers depend on a narrow type rather than on
 * discord.js's classes is so that cannot happen.
 */

/**
 * A recorded reply payload — a structural SUPERTYPE of both
 * `InteractionReplyOptions` and `InteractionEditReplyOptions` (readonly arrays,
 * wide flags, nullable content, which `editReply` permits and `reply` does not)
 * so the fakes satisfy the narrow contracts with no forced cast.
 */
export type ReplyArg = {
  content?: string | null
  embeds?: readonly unknown[]
  components?: readonly unknown[]
  flags?: unknown
}

export type FakeExecute = {
  interaction: CommandExecuteInteraction
  /** Everything passed to `reply`, in order. */
  replies: ReplyArg[]
  /** Everything passed to `editReply`, in order. */
  edits: ReplyArg[]
  /** Everything passed to `followUp`, in order. */
  followUps: ReplyArg[]
  /** Whether `deferReply` was called, and with what. */
  deferred: { called: boolean; ephemeral: boolean }
}

export type FakeExecuteOptions = {
  subcommand?: string
  subcommandGroup?: string | null
  /** Values returned by `getString`, keyed by option name. */
  strings?: Record<string, string | null>
  channelId?: string | null
  userId?: string
  displayName?: string
}

export function fakeExecute(options: FakeExecuteOptions = {}): FakeExecute {
  const replies: ReplyArg[] = []
  const edits: ReplyArg[] = []
  const followUps: ReplyArg[] = []
  const deferred = { called: false, ephemeral: false }
  const strings = options.strings ?? {}

  // Overload-declared to mirror discord.js's required-form getString.
  function getString(name: string, required: true): string
  function getString(name: string, required?: boolean): string | null
  function getString(name: string): string | null {
    return strings[name] ?? null
  }

  const interaction: CommandExecuteInteraction = {
    options: {
      getSubcommand: () => options.subcommand ?? 'roll',
      getSubcommandGroup: () => options.subcommandGroup ?? null,
      getString,
    },
    // Handlers read `client.user` only for embed branding; no avatar in tests.
    client: { user: null },
    user: { id: options.userId ?? 'discord-tester', displayName: options.displayName },
    channelId: options.channelId === undefined ? 'chan-1' : options.channelId,
    reply: (arg: ReplyArg) => {
      replies.push(arg)
      return Promise.resolve()
    },
    deferReply: (arg?: { flags?: unknown }) => {
      deferred.called = true
      deferred.ephemeral = arg?.flags !== undefined
      return Promise.resolve()
    },
    editReply: (arg: ReplyArg) => {
      edits.push(arg)
      return Promise.resolve()
    },
    followUp: (arg: ReplyArg) => {
      followUps.push(arg)
      return Promise.resolve()
    },
  }

  return { interaction, replies, edits, followUps, deferred }
}

export type FakeAutocomplete = {
  interaction: CommandAutocompleteInteraction
  /** Each `respond` call's choices, in order. */
  responses: { name: string; value: string }[][]
}

export function fakeAutocomplete(
  options: {
    subcommand?: string
    subcommandGroup?: string | null
    focused?: string
    channelId?: string | null
    userId?: string
    displayName?: string
  } = {}
): FakeAutocomplete {
  const responses: { name: string; value: string }[][] = []

  const interaction: CommandAutocompleteInteraction = {
    options: {
      getSubcommand: () => options.subcommand ?? 'roll',
      getSubcommandGroup: () => options.subcommandGroup ?? null,
      getFocused: () => options.focused ?? '',
    },
    user: { id: options.userId ?? 'discord-tester', displayName: options.displayName },
    channelId: options.channelId === undefined ? 'chan-1' : options.channelId,
    respond: (choices: { name: string; value: string }[]) => {
      responses.push(choices)
      return Promise.resolve()
    },
  }

  return { interaction, responses }
}
