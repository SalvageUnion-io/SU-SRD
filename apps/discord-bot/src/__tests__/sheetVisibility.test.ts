/**
 * `/su sheet` must stay ephemeral, and must not advertise a public URL that
 * does not exist.
 *
 * These two are one rule seen from two sides. A public sheet is **opt-in and
 * off by default** (ADR-032), so almost every sheet the bot renders has no
 * shareable page behind it. Posting such a sheet into the channel would show
 * the table somebody's build while every link on it 404s, and it would do that
 * because a third party ran a command — reading is private, and publishing is
 * the owner's own deliberate act.
 *
 * The failure mode this guards is not exotic: "make /su sheet public so the
 * table can see it" is an obviously reasonable-sounding change, and it is one
 * line.
 */
import { describe, expect, test } from 'bun:test'
import { commands } from '../commands/index.js'
import { setItunClientForTests } from '../commands/itunReply.js'
import { buildSheetEmbed, publicSheetUrl } from '../gameEmbed.js'
import type { ItunClient } from '../itun/client.js'
import type { EntityBody, SheetResult } from '../itun/types.js'
import { fakeExecute } from './fakeInteraction.js'

const WEB = 'https://intheunionnow.com'

function sheetResult(overrides: Partial<SheetResult> = {}): SheetResult {
  return {
    table: 'pilots',
    id: 'cx1',
    appId: 'app1',
    gameId: 'g1',
    publicRead: false,
    ownerName: 'alxjrvs',
    body: { callsign: 'Vex' } as EntityBody,
    ...overrides,
  }
}

describe('publicSheetUrl', () => {
  test('is null for a sheet nobody has published', () => {
    // The common case, and the one that must not produce a link.
    expect(publicSheetUrl(WEB, 'pilots', 'app1', false)).toBeNull()
  })

  test('builds the /p route by app id once published', () => {
    expect(publicSheetUrl(WEB, 'pilots', 'app1', true)).toBe(`${WEB}/p/pilot/app1`)
    expect(publicSheetUrl(WEB, 'mechs', 'app1', true)).toBe(`${WEB}/p/mech/app1`)
    expect(publicSheetUrl(WEB, 'crawlers', 'app1', true)).toBe(`${WEB}/p/crawler/app1`)
  })

  test('is null with no app id, even when published', () => {
    // The public route resolves by app id; a server-created entity nobody has
    // claimed has none, so there is nothing addressable to link.
    expect(publicSheetUrl(WEB, 'pilots', null, true)).toBeNull()
  })
})

describe('the Share field', () => {
  test('is absent from a private sheet', () => {
    const embed = buildSheetEmbed(sheetResult({ publicRead: false }), WEB)
    expect(embed.fields.some((f) => f.name === 'Share')).toBe(false)
    // And nothing anywhere in the embed points at the public route.
    const text = embed.fields.map((f) => f.value).join('\n') + (embed.description ?? '')
    expect(text).not.toContain('/p/')
  })

  test('appears once the owner has published it', () => {
    const embed = buildSheetEmbed(sheetResult({ publicRead: true }), WEB)
    const share = embed.fields.find((f) => f.name === 'Share')
    expect(share?.value).toContain(`${WEB}/p/pilot/app1`)
  })

  test('is absent when the server does not send the flag at all', () => {
    // An older deployment sends no `publicRead`. Absent must read as private,
    // never as published.
    const embed = buildSheetEmbed(
      { ...sheetResult(), publicRead: undefined as unknown as boolean },
      WEB
    )
    expect(embed.fields.some((f) => f.name === 'Share')).toBe(false)
  })
})

describe('/su sheet visibility', () => {
  test('replies ephemerally and posts nothing to the channel', async () => {
    const restore = setItunClientForTests({
      sheet: async () => ({ kind: 'ok', value: sheetResult({ publicRead: false }) }),
    } as unknown as ItunClient)

    try {
      const { interaction, edits, followUps, deferred } = fakeExecute({
        subcommand: 'sheet',
        strings: { entity: 'pilots:cx1' },
      })
      await commands.get('su')?.execute(interaction)

      // Deferred ephemerally — Discord fixes ephemerality at defer time, so
      // this is what actually decides who sees the reply.
      expect(deferred.ephemeral).toBe(true)
      // The sheet went to the asker...
      expect(edits.length).toBeGreaterThan(0)
      // ...and NOT to the channel. A follow-up is how a public result is sent.
      expect(followUps).toHaveLength(0)
    } finally {
      restore()
    }
  })

  test('a PUBLISHED sheet is still ephemeral', async () => {
    // Having a public URL does not make the reply public. The owner chose to
    // publish a page; they did not choose to have it posted to this channel by
    // whoever ran the command.
    const restore = setItunClientForTests({
      sheet: async () => ({ kind: 'ok', value: sheetResult({ publicRead: true }) }),
    } as unknown as ItunClient)

    try {
      const { interaction, followUps, deferred } = fakeExecute({
        subcommand: 'sheet',
        strings: { entity: 'pilots:cx1' },
      })
      await commands.get('su')?.execute(interaction)

      expect(deferred.ephemeral).toBe(true)
      expect(followUps).toHaveLength(0)
    } finally {
      restore()
    }
  })
})
