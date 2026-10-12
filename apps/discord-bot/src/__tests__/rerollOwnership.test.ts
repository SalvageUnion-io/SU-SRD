/**
 * Only the person who rolled can roll again, and a roll is always a NEW
 * message in the channel, never a redraw of an old one.
 */
import { describe, expect, test } from 'bun:test'
import { MessageFlags } from 'discord-api-types/v10'
import { SalvageUnionReference } from 'salvageunion-reference'
import { buildPostedRollMessage, buildRollMessage } from '../commands/roll.js'
import type { ContainerData } from '../container.js'
import { decodeRollRequest, encodeRollRequest } from '../customId.js'
import { noEffectContainer } from '../errorContainer.js'
import { buttonInteractionHandlerFor } from './helpers.js'

const reroll = (data: ContainerData): string => {
  for (const block of data.blocks) {
    if (block.kind !== 'buttons') continue
    for (const button of block.buttons) {
      if (button.kind === 'action' && button.label === '↻ Roll again') return button.customId
    }
  }
  throw new Error('no Roll again')
}

describe('the roll request', () => {
  test('carries its owner, and a bare name carries none', () => {
    expect(encodeRollRequest('Core Mechanic', '1234')).toBe('Core Mechanic|1234')
    expect(decodeRollRequest('Core Mechanic|1234')).toEqual({
      tableName: 'Core Mechanic',
      ownerId: '1234',
      isPrivate: false,
    })
    expect(decodeRollRequest('Core Mechanic')).toEqual({
      tableName: 'Core Mechanic',
      isPrivate: false,
    })
    expect(encodeRollRequest('Core Mechanic', '1234', true)).toBe('Core Mechanic|1234|p')
    expect(decodeRollRequest('Core Mechanic|1234|p').isPrivate).toBe(true)
  })

  test('every Roll again a roll posts names its roller', () => {
    const rolled = buildRollMessage('Reactor Overload', 'Alex', () => 14, false, '1234')
    if ('error' in rolled) throw new Error(rolled.error)
    expect(reroll(rolled.data)).toBe('su:roll:Reactor Overload|1234')

    const missed = buildRollMessage('Bio-Talon', 'Alex', () => 7, false, '1234')
    if ('error' in missed) throw new Error(missed.error)
    expect(reroll(missed.data)).toBe('su:roll:Bio-Talon|1234')

    const posted = buildPostedRollMessage('Reactor Overload|14', 'Alex', '1234')
    if ('error' in posted) throw new Error(posted.error)
    expect(reroll(posted.data)).toBe('su:roll:Reactor Overload|1234')
  })

  test('the longest table name still fits the 100-character id with a snowflake', () => {
    const name = 'Salvage Cache Table (Reclamation of the Wastes)'
    const rolled = buildRollMessage(name, 'Alex', () => 14, false, '12345678901234567890')
    if ('error' in rolled) throw new Error(rolled.error)
    expect(reroll(rolled.data)).toEndWith('|12345678901234567890')
  })

  test('a no-effect roll names its roller too', () => {
    const bioTalon = SalvageUnionReference.RollTables.getByName('Bio-Talon')
    if (!bioTalon) throw new Error('no Bio-Talon')
    expect(reroll(noEffectContainer(bioTalon, 7, 'Alex', '1234'))).toBe('su:roll:Bio-Talon|1234')
  })
})

describe('pressing Roll again', () => {
  test('the roller gets a NEW message, never a redraw', async () => {
    const { handle, replies, updates } = buttonInteractionHandlerFor(
      'su:roll:Core Mechanic|1234',
      [],
      '1234'
    )
    await handle()
    expect(updates).toHaveLength(0)
    expect(replies).toHaveLength(1)
    expect(replies[0]?.flags).toBe(MessageFlags.IsComponentsV2)
  })

  test('anyone else is told, privately, to roll it themselves', async () => {
    const { handle, replies, updates } = buttonInteractionHandlerFor(
      'su:roll:Core Mechanic|1234',
      [],
      '9999'
    )
    await handle()
    expect(updates).toHaveLength(0)
    expect(replies).toHaveLength(1)
    expect(replies[0]?.flags).toBe(MessageFlags.Ephemeral)
    expect(replies[0]?.content).toContain('/su roll table: Core Mechanic')
  })

  test('an older button with no owner stays open to anyone', async () => {
    const { handle, replies } = buttonInteractionHandlerFor('su:roll:Core Mechanic', [], '9999')
    await handle()
    expect(replies[0]?.flags).toBe(MessageFlags.IsComponentsV2)
  })
})

describe('a re-roll shares the status of its first roll', () => {
  test('a private roll offers a private re-roll; a posted one, a public re-roll', () => {
    const secret = buildRollMessage('Core Mechanic', 'Alex', () => 14, true, '1234')
    if ('error' in secret) throw new Error(secret.error)
    expect(reroll(secret.data)).toBe('su:roll:Core Mechanic|1234|p')

    const posted = buildPostedRollMessage('Core Mechanic|14', 'Alex', '1234')
    if ('error' in posted) throw new Error(posted.error)
    expect(reroll(posted.data)).toBe('su:roll:Core Mechanic|1234')
  })

  test('a private miss stays private, and so does its re-roll', () => {
    const miss = buildRollMessage('Bio-Talon', 'Alex', () => 7, true, '1234')
    if ('error' in miss) throw new Error(miss.error)
    expect(miss.flags).toBe(MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral)
    expect(reroll(miss.data)).toBe('su:roll:Bio-Talon|1234|p')
  })

  test('pressing a private re-roll answers privately, as a new message', async () => {
    const { handle, replies, updates, edits } = buttonInteractionHandlerFor(
      'su:roll:Core Mechanic|1234|p',
      [],
      '1234'
    )
    await handle()
    expect(updates).toHaveLength(0)
    expect(replies).toHaveLength(1)
    expect(replies[0]?.flags).toBe(MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral)
    // Ours, not Discord's: the internal marker never reaches the wire.
    expect(replies[0]).not.toHaveProperty('ephemeral')
    // Not at the table until posted: nothing is recorded.
    expect(edits).toHaveLength(0)
  })

  test('pressing a public re-roll answers publicly', async () => {
    const { handle, replies } = buttonInteractionHandlerFor(
      'su:roll:Core Mechanic|1234',
      [],
      '1234'
    )
    await handle()
    expect(replies[0]?.flags).toBe(MessageFlags.IsComponentsV2)
  })
})
