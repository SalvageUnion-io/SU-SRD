/**
 * /su namespace command — builder shape + subcommand dispatch.
 *
 * The handlers' behavior is covered by format.test.ts (pure functions);
 * these tests pin the registration contract: one top-level command named
 * `su` carrying the reference subcommands and the app
 * subcommands, with execute/autocomplete routed by getSubcommand().
 */
import { describe, expect, test } from 'bun:test'
import { commands } from '../commands/index'
import { suCommand } from '../commands/su'
import { fakeAutocomplete, fakeExecute } from './fakeInteraction'

describe('/su command', () => {
  test('is the one slash command, beside the message context menu', () => {
    expect([...commands.keys()]).toEqual(['su', 'Look up in Salvage Union'])
  })

  test('registers every subcommand', () => {
    const json = suCommand.data.toJSON()
    expect(json.name).toBe('su')
    const subs = (json.options ?? []).map((o) => o.name).sort()
    // The app subcommands are registered UNCONDITIONALLY — a command that
    // appears or vanishes depending on deployment configuration is harder to
    // explain than one that answers "The app is not configured for
    // this bot" (or that it is unavailable).
    expect(subs).toEqual(['bind', 'feedback', 'games', 'lookup', 'me', 'roll', 'sheet', 'unbind'])

    // Discord caps a command at 25 options, and subcommands + groups both
    // count against it. Worth pinning: overflowing fails at deploy time, in a
    // Discord API error, not here.
    expect(subs.length).toBeLessThanOrEqual(25)

    const roll = (json.options ?? []).find((o) => o.name === 'roll')
    const lookup = (json.options ?? []).find((o) => o.name === 'lookup')
    expect(
      (roll as { options?: { name: string; autocomplete?: boolean }[] }).options?.[0]
    ).toMatchObject({ name: 'table', autocomplete: true, required: false })
    expect(
      (lookup as { options?: { name: string; autocomplete?: boolean }[] }).options?.[0]
    ).toMatchObject({ name: 'entity', autocomplete: true, required: true })

    const sheet = (json.options ?? []).find((o) => o.name === 'sheet')
    expect(
      (sheet as { options?: { name: string; autocomplete?: boolean }[] }).options?.[0]
    ).toMatchObject({ name: 'entity', autocomplete: true, required: true })
  })

  test('execute throws loudly on an unknown subcommand', async () => {
    const { interaction } = fakeExecute({ subcommand: 'nonsense' })
    await expect(suCommand.execute(interaction)).rejects.toThrow('Unknown /su subcommand')
  })

  test('autocomplete responds empty on an unknown subcommand', async () => {
    const { interaction, responses } = fakeAutocomplete({ subcommand: 'nonsense' })
    await suCommand.autocomplete(interaction)
    expect(responses[0]).toEqual([])
  })
})
