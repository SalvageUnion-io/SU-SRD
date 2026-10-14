import { describe, expect, test } from 'bun:test'
import { gamesCommand, meCommand } from '../commands/account'
import { lookupCommand } from '../commands/lookup'
import { rollCommand } from '../commands/roll'
import { sheetCommand } from '../commands/sheet'
import { fakeExecute } from './fakeInteraction'

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

describe('with The Cantina unavailable', () => {
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
    ['sheet', sheetCommand],
  ])('/su %s explains itself instead of failing', async (name, command) => {
    const { interaction, edits, deferred, followUps } = fakeExecute({
      subcommand: name,
      strings: { entity: 'pilots:jd7k2m9p4q8r3s6t1v5w0x2y' },
    })
    await command.execute(interaction)

    // Registered but honest: the command exists, defers ephemerally, and says
    // it cannot reach In The Union Now — worded as an outage, never as a
    // permissions problem, and posting nothing to the channel.
    expect(deferred.called).toBe(true)
    expect(deferred.ephemeral).toBe(true)
    expect(followUps).toHaveLength(0)
    expect(edits).toHaveLength(1)
    expect(edits[0]?.content).toContain('The Cantina')
  })

  test('/su sheet needs no channel: a DM asks the server like anywhere else', async () => {
    const { interaction, edits, deferred } = fakeExecute({
      subcommand: 'sheet',
      strings: { entity: 'pilots:jd7k2m9p4q8r3s6t1v5w0x2y' },
    })
    await sheetCommand.execute(interaction)
    expect(deferred.called).toBe(true)
    expect(edits[0]?.content).toContain('The Cantina')
  })
})
