/**
 * /su namespace command — builder shape + subcommand dispatch.
 *
 * The handlers' behavior is covered by format.test.ts (pure functions);
 * these tests pin the registration contract: one top-level command named
 * `su` carrying exactly the roll, check, and lookup subcommands, with execute/
 * autocomplete routed by getSubcommand().
 */
import { describe, expect, test } from 'bun:test'

import { commands } from '../commands/index.js'
import { suCommand } from '../commands/su.js'

describe('/su command', () => {
  test('is the only registered top-level command', () => {
    expect([...commands.keys()]).toEqual(['su'])
  })

  test('registers roll, check, and lookup as subcommands with their options', () => {
    const json = suCommand.data.toJSON()
    expect(json.name).toBe('su')
    const subs = (json.options ?? []).map((o) => o.name).sort()
    expect(subs).toEqual(['check', 'lookup', 'roll'])

    const roll = (json.options ?? []).find((o) => o.name === 'roll')
    const check = (json.options ?? []).find((o) => o.name === 'check')
    const lookup = (json.options ?? []).find((o) => o.name === 'lookup')
    expect(
      (roll as { options?: { name: string; autocomplete?: boolean }[] }).options?.[0]
    ).toMatchObject({ name: 'table', autocomplete: true, required: false })
    expect(
      (check as { options?: { name: string; required?: boolean }[] }).options?.[0]
    ).toMatchObject({ name: 'dice', required: true })
    expect(
      (lookup as { options?: { name: string; autocomplete?: boolean }[] }).options?.[0]
    ).toMatchObject({ name: 'entity', autocomplete: true, required: true })
  })

  test('execute throws loudly on an unknown subcommand', async () => {
    // The narrow CommandExecuteInteraction surface is satisfied structurally —
    // getString's required-form overload is declared, the impl never runs here.
    function getString(name: string, required: true): string
    function getString(name: string, required?: boolean): string | null
    function getString(): string | null {
      return null
    }
    const interaction: Parameters<typeof suCommand.execute>[0] = {
      options: { getSubcommand: () => 'nonsense', getString },
      client: { user: null },
      reply: () => Promise.resolve(),
    }
    await expect(suCommand.execute(interaction)).rejects.toThrow('Unknown /su subcommand')
  })

  test('autocomplete responds empty on an unknown subcommand', async () => {
    let responded: unknown = null
    const interaction: Parameters<typeof suCommand.autocomplete>[0] = {
      options: { getSubcommand: () => 'nonsense', getFocused: () => '' },
      respond: (choices) => {
        responded = choices
        return Promise.resolve()
      },
    }
    await suCommand.autocomplete(interaction)
    expect(responded).toEqual([])
  })
})
