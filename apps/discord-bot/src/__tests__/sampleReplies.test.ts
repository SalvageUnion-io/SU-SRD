/**
 * The replies the reference site's `/bot` page draws as its screenshots: the bot's
 * own, committed in the web app as generated data.
 */
import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderSampleRepliesModule, sampleReplies } from '../sampleReplies'

const COMMITTED = join(import.meta.dir, '../../../web/src/generated/discordSamples.ts')

describe('the /bot page’s sample replies', () => {
  test('are a roll and a lookup, each with its controls', () => {
    const { roll, lookup } = sampleReplies()
    expect(roll.data.blocks.some((block) => block.kind === 'buttons')).toBe(true)
    expect(lookup.command).toBe('/su lookup entity: green laser')
  })

  test('the web app’s committed copy is current (regenerate: bun --filter discord-bot gen:sample-replies)', () => {
    expect(readFileSync(COMMITTED, 'utf-8')).toBe(renderSampleRepliesModule())
  })
})
