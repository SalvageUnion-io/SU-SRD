/**
 * interactionCreate dispatcher tests — the router had ZERO coverage.
 *
 * Exercises every dispatch path against mocked interactions: autocomplete
 * (dispatch + missing-handler), chat-input command (dispatch + missing
 * command), the NEW isButton branch (valid re-roll + unrecognized id), and
 * BOTH error branches — the followUp-vs-reply choice keyed on
 * `interaction.replied || interaction.deferred`.
 *
 * interactionCreate transitively imports config.ts (which throws when
 * DISCORD_TOKEN is unset), so we set the env and import it dynamically after.
 */
import { beforeAll, describe, expect, test } from 'bun:test'
import { MessageFlags } from 'discord.js'
import { SalvageUnionReference } from 'salvageunion-reference'

import type { Command } from '../commands/index.js'

process.env.DISCORD_TOKEN ??= 'test-token'
process.env.DISCORD_CLIENT_ID ??= 'test-client-id'

let handleInteractionCreate: typeof import('../events/interactionCreate.js').handleInteractionCreate

beforeAll(async () => {
  await SalvageUnionReference.preload('all')
  ;({ handleInteractionCreate } = await import('../events/interactionCreate.js'))
})

type Call = { content?: string; embeds?: unknown[]; components?: unknown[]; flags?: number }

type MockOptions = {
  kind: 'autocomplete' | 'button' | 'chat' | 'other'
  commandName?: string
  customId?: string
  commands?: Map<string, Command>
  replied?: boolean
  deferred?: boolean
}

/** Build a mock Interaction with recording reply/followUp/respond. */
function mockInteraction(opts: MockOptions) {
  const replies: Call[] = []
  const followUps: Call[] = []
  const autocompleteResponses: unknown[] = []
  const interaction = {
    commandName: opts.commandName ?? 'su',
    customId: opts.customId ?? '',
    replied: opts.replied ?? false,
    deferred: opts.deferred ?? false,
    isAutocomplete: () => opts.kind === 'autocomplete',
    isButton: () => opts.kind === 'button',
    isChatInputCommand: () => opts.kind === 'chat',
    client: { commands: opts.commands ?? new Map<string, Command>() },
    options: { getFocused: () => '' },
    reply: (arg: Call) => {
      replies.push(arg)
      return Promise.resolve()
    },
    followUp: (arg: Call) => {
      followUps.push(arg)
      return Promise.resolve()
    },
    respond: (choices: unknown) => {
      autocompleteResponses.push(choices)
      return Promise.resolve()
    },
  }
  return { interaction, replies, followUps, autocompleteResponses }
}

/** A command whose autocomplete/execute record whether they ran. */
function spyCommand(): { command: Command; calls: { execute: number; autocomplete: number } } {
  const calls = { execute: 0, autocomplete: 0 }
  const command = {
    data: { name: 'su' },
    execute: async () => {
      calls.execute += 1
    },
    autocomplete: async () => {
      calls.autocomplete += 1
    },
  } as unknown as Command
  return { command, calls }
}

describe('handleInteractionCreate — autocomplete', () => {
  test('routes to the command autocomplete handler', async () => {
    const { command, calls } = spyCommand()
    const { interaction } = mockInteraction({
      kind: 'autocomplete',
      commands: new Map([['su', command]]),
    })
    await handleInteractionCreate(interaction as never)
    expect(calls.autocomplete).toBe(1)
  })

  test('missing autocomplete handler is a no-op, not a throw', async () => {
    const { interaction, replies } = mockInteraction({ kind: 'autocomplete', commands: new Map() })
    await expect(handleInteractionCreate(interaction as never)).resolves.toBeUndefined()
    expect(replies).toHaveLength(0)
  })
})

describe('handleInteractionCreate — chat-input command', () => {
  test('routes to the command execute handler', async () => {
    const { command, calls } = spyCommand()
    const { interaction } = mockInteraction({
      kind: 'chat',
      commands: new Map([['su', command]]),
    })
    await handleInteractionCreate(interaction as never)
    expect(calls.execute).toBe(1)
  })

  test('unknown command is a no-op, not a throw', async () => {
    const { interaction, replies } = mockInteraction({ kind: 'chat', commands: new Map() })
    await expect(handleInteractionCreate(interaction as never)).resolves.toBeUndefined()
    expect(replies).toHaveLength(0)
  })
})

describe('handleInteractionCreate — button branch', () => {
  test('a valid su:roll button re-rolls and replies with an embed', async () => {
    const { interaction, replies } = mockInteraction({
      kind: 'button',
      customId: 'su:roll:Core Mechanic',
    })
    await handleInteractionCreate(interaction as never)
    expect(replies).toHaveLength(1)
    const reply = replies[0]
    if (!reply) throw new Error('expected a reply')
    expect(reply.embeds).toHaveLength(1)
    expect(reply.flags).toBeUndefined()
  })

  test('a valid su:check button re-rolls the notation', async () => {
    const { interaction, replies } = mockInteraction({
      kind: 'button',
      customId: 'su:check:2d6+3',
    })
    await handleInteractionCreate(interaction as never)
    expect(replies).toHaveLength(1)
    expect(replies[0]?.embeds).toHaveLength(1)
  })

  test('a valid su:lookup button returns the full table embed', async () => {
    const { interaction, replies } = mockInteraction({
      kind: 'button',
      customId: 'su:lookup:Core Mechanic',
    })
    await handleInteractionCreate(interaction as never)
    expect(replies).toHaveLength(1)
    const reply = replies[0]
    if (!reply) throw new Error('expected a reply')
    expect(reply.embeds).toHaveLength(1)
    expect(reply.flags).toBeUndefined()
  })

  test('a foreign / malformed customId replies ephemerally without crashing', async () => {
    const { interaction, replies } = mockInteraction({
      kind: 'button',
      customId: 'someotherbot:thing',
    })
    await handleInteractionCreate(interaction as never)
    expect(replies).toHaveLength(1)
    const reply = replies[0]
    if (!reply) throw new Error('expected a reply')
    expect(reply.embeds).toBeUndefined()
    expect(reply.flags).toBe(MessageFlags.Ephemeral)
  })
})

describe('handleInteractionCreate — error branches', () => {
  function throwingCommand(): Command {
    return {
      data: { name: 'su' },
      execute: async () => {
        throw new Error('boom')
      },
    } as unknown as Command
  }

  test('a fresh interaction (not replied) uses reply for the error notice', async () => {
    const { interaction, replies, followUps } = mockInteraction({
      kind: 'chat',
      replied: false,
      commands: new Map([['su', throwingCommand()]]),
    })
    await handleInteractionCreate(interaction as never)
    expect(replies).toHaveLength(1)
    expect(followUps).toHaveLength(0)
    expect(replies[0]?.content).toContain('error')
    expect(replies[0]?.flags).toBe(MessageFlags.Ephemeral)
  })

  test('an already-acknowledged interaction (replied) uses followUp', async () => {
    const { interaction, replies, followUps } = mockInteraction({
      kind: 'chat',
      replied: true,
      commands: new Map([['su', throwingCommand()]]),
    })
    await handleInteractionCreate(interaction as never)
    expect(followUps).toHaveLength(1)
    expect(replies).toHaveLength(0)
    expect(followUps[0]?.content).toContain('error')
  })

  test('a deferred interaction also uses followUp', async () => {
    const { interaction, replies, followUps } = mockInteraction({
      kind: 'chat',
      deferred: true,
      commands: new Map([['su', throwingCommand()]]),
    })
    await handleInteractionCreate(interaction as never)
    expect(followUps).toHaveLength(1)
    expect(replies).toHaveLength(0)
  })
})

describe('handleInteractionCreate — other interaction types', () => {
  test('an unrecognized interaction type is ignored', async () => {
    const { interaction, replies, followUps } = mockInteraction({ kind: 'other' })
    await expect(handleInteractionCreate(interaction as never)).resolves.toBeUndefined()
    expect(replies).toHaveLength(0)
    expect(followUps).toHaveLength(0)
  })
})
