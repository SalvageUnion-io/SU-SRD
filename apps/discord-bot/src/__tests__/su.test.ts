/**
 * /su namespace command — builder shape + subcommand dispatch.
 *
 * The handlers' behavior is covered by format.test.ts (pure functions);
 * these tests pin the registration contract: one top-level command named
 * `su` carrying exactly the roll and lookup subcommands, with execute/
 * autocomplete routed by getSubcommand().
 */
import { describe, expect, test } from 'bun:test'

import { commands } from '../commands/index.js'
import { suCommand } from '../commands/su.js'

describe('/su command', () => {
  test('is the only registered top-level command', () => {
    expect([...commands.keys()]).toEqual(['su'])
  })

  test('registers roll and lookup as subcommands with their options', () => {
    const json = suCommand.data.toJSON()
    expect(json.name).toBe('su')
    const subs = (json.options ?? []).map((o) => o.name).sort()
    expect(subs).toEqual(['lookup', 'roll'])

    const roll = (json.options ?? []).find((o) => o.name === 'roll')
    const lookup = (json.options ?? []).find((o) => o.name === 'lookup')
    expect(
      (roll as { options?: { name: string; autocomplete?: boolean }[] }).options?.[0]
    ).toMatchObject({ name: 'table', autocomplete: true, required: false })
    expect(
      (lookup as { options?: { name: string; autocomplete?: boolean }[] }).options?.[0]
    ).toMatchObject({ name: 'entity', autocomplete: true, required: true })
  })

  test('execute throws loudly on an unknown subcommand', async () => {
    const interaction = {
      options: { getSubcommand: () => 'nonsense' },
    } as unknown as Parameters<typeof suCommand.execute>[0]
    await expect(suCommand.execute(interaction)).rejects.toThrow('Unknown /su subcommand')
  })

  test('autocomplete responds empty on an unknown subcommand', async () => {
    let responded: unknown = null
    const interaction = {
      options: { getSubcommand: () => 'nonsense' },
      respond: (choices: unknown) => {
        responded = choices
        return Promise.resolve()
      },
    } as unknown as Parameters<typeof suCommand.autocomplete>[0]
    await suCommand.autocomplete(interaction)
    expect(responded).toEqual([])
  })
})
