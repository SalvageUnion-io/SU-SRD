import { afterEach, describe, expect, test } from 'bun:test'
import { feedbackCommand } from '../commands/feedback'
import { setSiteClient } from '../commands/siteReply'
import { suCommand } from '../commands/su'
import type { SiteClient } from '../play/client'
import { createSiteClient } from '../play/client'
import { fakeExecute } from './fakeInteraction'

/**
 * `/su feedback`. Whether a note is taken is the app's call
 * (`apps/web/src/worker/shared/feedback.ts`, proven in its tests); these pin what
 * the bot sends and that every answer is private.
 */

let restore: (() => void) | null = null
afterEach(() => {
  restore?.()
  restore = null
})

const unexpected = () => Promise.reject(new Error('not called in this test')) as never

function client(overrides: Partial<SiteClient>): SiteClient {
  return {
    ...createSiteClient(undefined),
    me: unexpected,
    games: unexpected,
    sheet: unexpected,
    usage: unexpected,
    feedback: unexpected,
    ...overrides,
  }
}

describe('/su feedback', () => {
  test('is registered under /su, with a description that says the note goes public', () => {
    const json = suCommand.data.toJSON()
    const sub = json.options?.find((option) => option.name === 'feedback')
    expect(sub?.description).toContain('publicly on GitHub')
    expect(sub?.description.length).toBeLessThanOrEqual(100)
  })

  test('sends the kind and words with the sender’s id, and answers privately in the app’s words', async () => {
    let asked: unknown[] = []
    restore = setSiteClient(
      client({
        feedback: (...args) => {
          asked = args
          return Promise.resolve({
            kind: 'ok',
            value: { ok: true, accepted: true, message: 'Thank you!' },
          })
        },
      })
    )
    const { interaction, edits, deferred } = fakeExecute({
      subcommand: 'feedback',
      userId: 'discord-me',
      strings: { kind: 'report', text: 'The Mule page has a typo' },
    })
    await feedbackCommand.execute(interaction)
    expect(asked).toEqual(['discord-me', 'report', 'The Mule page has a typo'])
    expect(deferred).toEqual({ called: true, ephemeral: true })
    expect(edits[0]?.content).toBe('Thank you!')
  })

  test('a refusal and an outage are both said privately', async () => {
    restore = setSiteClient(
      client({
        feedback: () =>
          Promise.resolve({
            kind: 'ok',
            value: { ok: true, accepted: false, message: 'That is 5 notes today.' },
          }),
      })
    )
    const refused = fakeExecute({
      subcommand: 'feedback',
      strings: { kind: 'suggestion', text: 'More tables please' },
    })
    await feedbackCommand.execute(refused.interaction)
    expect(refused.edits[0]?.content).toBe('That is 5 notes today.')

    restore()
    restore = setSiteClient(createSiteClient(undefined))
    const down = fakeExecute({
      subcommand: 'feedback',
      strings: { kind: 'suggestion', text: 'More tables please' },
    })
    await feedbackCommand.execute(down.interaction)
    expect(down.deferred.ephemeral).toBe(true)
    expect(String(down.edits[0]?.content)).toContain('not configured')
  })
})
