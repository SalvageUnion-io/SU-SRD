/**
 * The `/su` command list the SRD's `/bot` page renders: read from the
 * registered builder, and committed in the web app as generated data.
 */
import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { commandList, renderCommandListModule } from '../commandList'

const COMMITTED = join(import.meta.dir, '../../../web/src/generated/discordCommands.ts')

describe('the /su command list', () => {
  test('lists every leaf subcommand in registration order', () => {
    expect(commandList().map((c) => c.name)).toEqual([
      'roll',
      'lookup',
      'me',
      'games',
      'sheet',
      'bind',
      'unbind',
      'feedback',
    ])
  })

  test('only the reference tools and feedback answer without an account', () => {
    expect(
      commandList()
        .filter((c) => !c.needsAccount)
        .map((c) => c.name)
    ).toEqual(['roll', 'lookup', 'feedback'])
  })

  test('carries each description and option, required or not', () => {
    const roll = commandList().find((c) => c.name === 'roll')
    expect(roll?.description).toBe('Roll on a Salvage Union table')
    expect(roll?.options).toEqual([
      { name: 'table', required: false },
      { name: 'private', required: false },
    ])
    const sheet = commandList().find((c) => c.name === 'sheet')
    expect(sheet?.options).toEqual([{ name: 'entity', required: true }])
  })

  test('a group leaf needs an account even when it shares a reference tool’s name', () => {
    const list = commandList([
      { type: 3, name: 'not-a-subcommand', description: 'skipped' },
      {
        type: 2,
        name: 'game',
        description: 'A group',
        options: [{ type: 1, name: 'roll', description: 'A leaf' }],
      },
    ])
    expect(list).toEqual([
      { name: 'game roll', description: 'A leaf', options: [], needsAccount: true },
    ])
  })

  test('the web app’s committed copy is current (regenerate: bun --filter discord-bot gen:command-list)', () => {
    expect(readFileSync(COMMITTED, 'utf-8')).toBe(renderCommandListModule())
  })
})
