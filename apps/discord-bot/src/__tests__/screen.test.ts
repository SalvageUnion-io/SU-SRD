/**
 * `/su screen` — the Mediator Screen. Pins what a Mediator relies on: every
 * Quick Ref table is there with its bands and a button that rolls it, the
 * screen answers only to its asker, the buttons are the asker's alone, and
 * `private` carries through to the rolls they make.
 */
import { describe, expect, test } from 'bun:test'
import { MessageFlags } from 'discord-api-types/v10'
import { screenCommand } from '../commands/screen'
import type { ContainerData } from '../container'
import { containerComponentCount, containerTextLength, V2_LIMIT } from '../container'
import { decodeRollRequest, parseCustomId } from '../customId'
import { buildScreenData, SCREEN_SECTIONS, SCREEN_URL } from '../screenContainer'
import { fakeExecute } from './fakeInteraction'
import { buttonInteractionHandlerFor } from './helpers'

const TABLES = SCREEN_SECTIONS.flatMap((s) => s.tables)

function buttonsOf(data: ContainerData) {
  return data.blocks.flatMap((b) => (b.kind === 'buttons' ? b.buttons : []))
}

function textOf(data: ContainerData): string {
  return data.blocks.map((b) => (b.kind === 'text' ? b.content : '')).join('\n')
}

describe('/su screen', () => {
  test('carries every Quick Ref table: its bands, its page link and a roll button', () => {
    const data = buildScreenData('mediator-1', false)
    const text = textOf(data)
    expect(text).toContain(`## [Mediator Screen](${SCREEN_URL})`)
    for (const name of TABLES) expect(text).toContain(`**[${name}](`)
    expect(text).toContain(
      '20 Nailed it · 11–19 Success · 6–10 Tough Choice · 2–5 Failure · 1 Cascade Failure'
    )
    expect(text).toContain('/roll-tables/critical-injury)** p.241')
    expect(buttonsOf(data).map((b) => b.label)).toEqual(TABLES)
  })

  test('fits one message, a row never over five buttons', () => {
    const data = buildScreenData('mediator-1', true)
    expect(containerTextLength(data)).toBeLessThanOrEqual(V2_LIMIT.totalText)
    expect(containerComponentCount(data)).toBeLessThanOrEqual(V2_LIMIT.components)
    for (const block of data.blocks) {
      if (block.kind === 'buttons')
        expect(block.buttons.length).toBeLessThanOrEqual(V2_LIMIT.rowButtons)
    }
  })

  test('every button rolls its table for the asker, privately when asked', () => {
    for (const isPrivate of [false, true]) {
      for (const button of buttonsOf(buildScreenData('mediator-1', isPrivate))) {
        if (button.kind !== 'action') throw new Error('expected an action button')
        const parsed = parseCustomId(button.customId)
        expect(parsed?.action).toBe('roll')
        expect(decodeRollRequest(parsed?.payload ?? '')).toEqual({
          tableName: button.label,
          ownerId: 'mediator-1',
          isPrivate,
        })
      }
    }
  })

  test('answers only to its asker', async () => {
    const { interaction, replies } = fakeExecute({ subcommand: 'screen', userId: 'mediator-1' })
    await screenCommand.execute(interaction)
    expect(replies).toHaveLength(1)
    expect(replies[0]?.flags).toBe(MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral)
  })

  test('a button rolls its table in the channel', async () => {
    const button = buttonsOf(buildScreenData('mediator-1', false)).find((b) => b.label === 'Morale')
    if (button?.kind !== 'action') throw new Error('expected the Morale button')
    const { handle, replies } = buttonInteractionHandlerFor(button.customId, [], 'mediator-1')
    await handle()
    expect(replies).toHaveLength(1)
    expect(replies[0]?.flags).toBe(MessageFlags.IsComponentsV2)
  })
})
