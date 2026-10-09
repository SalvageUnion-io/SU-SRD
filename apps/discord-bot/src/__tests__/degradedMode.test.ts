import { describe, expect, test } from 'bun:test'
import { gamesCommand, meCommand, shelfCommand } from '../commands/account.js'
import { crewCommand } from '../commands/crew.js'
import { gameCommand } from '../commands/game.js'
import { inviteCommand } from '../commands/invite.js'
import { lookupCommand } from '../commands/lookup.js'
import { rollCommand } from '../commands/roll.js'
import { fakeExecute } from './fakeInteraction.js'

/**
 * **The reference bot must keep working when In The Union Now does not.**
 *
 * Roll and lookup are the thing people already use, and ADR-030's first
 * principle is that accounts must not gate or alter anything that worked
 * without them. So when the ITUN client cannot help — the deployment is down,
 * or (as in every test here) the client is unconfigured — rolling and looking
 * up are untouched, and every Game command says why it cannot help rather than
 * failing.
 *
 * No test file installs a client by default, so this whole file runs against
 * the unconfigured client, which makes no request at all.
 */

describe('with In The Union Now unavailable', () => {
  test('rolling is untouched — no defer, no edit, just the reply', async () => {
    const { interaction, replies, deferred, edits } = fakeExecute({
      subcommand: 'roll',
      strings: { table: 'Core Mechanic' },
    })
    await rollCommand.execute(interaction)

    // One immediate, public reply carrying the result. A deferred roll would
    // be a visibly slower dice bot, and recording it to a Game is best effort.
    expect(replies).toHaveLength(1)
    expect(replies[0]?.components).toHaveLength(1)
    expect(deferred.called).toBe(false)
    expect(edits).toHaveLength(0)
  })

  test('looking something up is untouched', async () => {
    const { interaction, replies, deferred } = fakeExecute({
      subcommand: 'lookup',
      strings: { entity: 'systems::50-cal-machine-gun' },
    })
    await lookupCommand.execute(interaction)

    expect(replies).toHaveLength(1)
    expect(replies[0]?.components).toHaveLength(1)
    expect(deferred.called).toBe(false)
  })

  test.each([
    ['me', meCommand],
    ['games', gamesCommand],
    ['my-stuff', shelfCommand],
    ['crew', crewCommand],
    ['invite', inviteCommand],
  ])('/su %s explains itself instead of failing', async (name, command) => {
    const { interaction, edits, deferred, followUps } = fakeExecute({
      subcommand: name,
      // `/su invite` forwards Discord's signed request; give it one, so what
      // is under test is the unavailable deployment, not a missing signature.
      signed: { body: '{}', signature: 'sig', timestamp: '0' },
    })
    await command.execute(interaction)

    // Registered but honest: the command exists, defers ephemerally, and says
    // it cannot reach In The Union Now — worded as an outage, never as a
    // permissions problem, and posting nothing to the channel.
    expect(deferred.called).toBe(true)
    expect(deferred.ephemeral).toBe(true)
    expect(followUps).toHaveLength(0)
    expect(edits).toHaveLength(1)
    expect(edits[0]?.content).toContain('In The Union Now')
  })

  test('/su game bind says the same thing', async () => {
    const { interaction, edits } = fakeExecute({
      subcommand: 'bind',
      subcommandGroup: 'game',
      strings: { game: 'jd7k2m9p4q8r3s6t1v5w0x2y' },
    })
    await gameCommand.execute(interaction)
    expect(edits[0]?.content).toContain('In The Union Now')
  })

  test('a Game command outside a channel says so before anything else', async () => {
    // A DM has no channel, so there is no binding to resolve and no useful
    // question to ask the server.
    const { interaction, replies, deferred } = fakeExecute({
      subcommand: 'crew',
      channelId: null,
    })
    await crewCommand.execute(interaction)
    expect(deferred.called).toBe(false)
    expect(replies[0]?.content).toContain('has to be run in a channel')
  })
})
