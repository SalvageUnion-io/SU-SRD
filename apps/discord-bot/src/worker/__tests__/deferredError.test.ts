import { describe, expect, test } from 'bun:test'
import { InteractionResponseType } from 'discord-api-types/v10'
import { ResponseSink, webhookRoutes } from '../adapter.js'

/**
 * A deferred command that throws must still say something.
 *
 * ## The bug
 *
 * `ResponseSink.send` is a **no-op once settled**, and `deferReply` settles it.
 * So for the commands that defer — which are exactly the ones that make a
 * network call and can therefore throw — a single `sink.send` in the Worker's
 * catch would write nothing at all, and Discord would leave "<bot> is
 * thinking…" on screen until the interaction expired. The Worker therefore
 * patches `@original` once the sink is settled.
 *
 * ## Why these tests are at this level
 *
 * `replay.test.ts` drives the whole Worker through a signed request, which is
 * right for the transport. This is about the sink's settle semantics and the
 * route the repair has to take, so it asserts those directly — a full replay
 * would prove the response code and still not show WHICH Discord endpoint was
 * written to, which is the entire question.
 */

const APPLICATION_ID = '111111111111111111'

describe('ResponseSink settle semantics', () => {
  test('send() is a no-op once settled — the mechanism behind the bug', () => {
    const sink = new ResponseSink()
    sink.send({
      type: InteractionResponseType.ChannelMessageWithSource,
      data: { content: 'first' },
    })

    expect(sink.settled).toBe(true)

    // The second send is silently dropped. This is correct behaviour — an
    // interaction has exactly one initial response — and is precisely why the
    // error path could not rely on it.
    sink.send({
      type: InteractionResponseType.ChannelMessageWithSource,
      data: { content: 'second' },
    })

    return expect(sink.first).resolves.toMatchObject({ data: { content: 'first' } })
  })

  test('a fresh sink is unsettled, so the error path may use it', () => {
    expect(new ResponseSink().settled).toBe(false)
  })
})

describe('the repair route', () => {
  test('targets @original, which is the message a defer promised', () => {
    // A deferred interaction has already spent its initial response; the only
    // way to say anything afterwards is to edit the message it promised.
    // `followUp` would post a SECOND message and leave the "thinking…" one
    // hanging, which is why the repair patches @original instead.
    const routes = webhookRoutes(APPLICATION_ID, 'interaction-token')

    // `%40original`, not `@original` — Routes.webhookMessage percent-encodes the
    // segment. Pinned in that form because a hand-built URL using a literal `@`
    // is a plausible "simplification" that Discord would reject.
    expect(routes.original).toBe(
      `/webhooks/${APPLICATION_ID}/interaction-token/messages/%40original`
    )
    expect(routes.original).not.toBe(routes.followUp)
  })

  test('the two routes are distinct — patching followUp would not clear the spinner', () => {
    const routes = webhookRoutes(APPLICATION_ID, 'tok')
    expect(routes.followUp).not.toContain('%40original')
    expect(routes.followUp).toBe(`/webhooks/${APPLICATION_ID}/tok`)
  })
})
