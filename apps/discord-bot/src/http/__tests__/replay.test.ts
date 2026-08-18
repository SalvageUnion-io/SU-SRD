import { describe, expect, test } from 'bun:test'
import { InteractionResponseType, InteractionType } from 'discord-api-types/v10'
import type { Env } from '../worker.js'
import worker from '../worker.js'

/**
 * The signed replay harness — P5's gate (ADR-033).
 *
 * ## Why this is the gate rather than a staged rollout
 *
 * Gateway and HTTP interactions are **mutually exclusive**, and the Interactions
 * Endpoint URL is an application-level setting. There is no canary, no
 * percentage rollout and no test guild: one toggle moves every server at once.
 * So the only pre-flip evidence available is driving the Worker with payloads
 * shaped exactly like Discord's, signed exactly as Discord signs them.
 *
 * ## Why a locally-generated keypair rather than a second Discord app
 *
 * The verification path does not care whose key it is — it cares that the
 * signature over `timestamp + rawBody` validates against the configured public
 * key. Generating a keypair here exercises the identical code path with no
 * second application to register, and lets the suite assert the NEGATIVE cases
 * (wrong key, tampered body, absent headers) that a real application cannot
 * produce on demand.
 *
 * The one thing this cannot test is Discord's own behaviour: whether it accepts
 * our PONG when saving the endpoint URL, and whether a deferred reply lands
 * inside its 3-second window under real latency. Those are verified at the flip.
 */

const ENCODER = new TextEncoder()

const APPLICATION_ID = '111111111111111111'
const USER_ID = '222222222222222222'
const CHANNEL_ID = '333333333333333333'

type KeyPairHex = { privateKey: CryptoKey; publicKeyHex: string }

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * A throwaway Ed25519 identity standing in for the Discord application's.
 *
 * The double cast is the same class of problem `verify.ts` documents: this app
 * is typechecked against Node's lib, whose `generateKey` overloads do not know
 * `Ed25519` and so resolve to the single-`CryptoKey` return rather than a pair.
 * The runtime — Bun here, workerd in production — returns a pair.
 */
async function generateKeyPair(): Promise<KeyPairHex> {
  const pair = (await crypto.subtle.generateKey({ name: 'Ed25519' }, true, [
    'sign',
    'verify',
  ])) as unknown as CryptoKeyPair
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))
  return { privateKey: pair.privateKey, publicKeyHex: bytesToHex(raw) }
}

/**
 * Build the request Discord would send.
 *
 * Signs `timestamp + body` over the EXACT string that becomes the request body,
 * mirroring the production path — the verifier reads the raw text rather than a
 * re-serialised object precisely because those two can differ.
 */
async function signedRequest(
  body: unknown,
  keys: KeyPairHex,
  overrides: { signature?: string; timestamp?: string; body?: string } = {}
): Promise<Request> {
  const raw = overrides.body ?? JSON.stringify(body)
  const timestamp = overrides.timestamp ?? '1700000000'
  const signature =
    overrides.signature ??
    bytesToHex(
      new Uint8Array(
        await crypto.subtle.sign(
          { name: 'Ed25519' },
          keys.privateKey,
          ENCODER.encode(timestamp + raw)
        )
      )
    )

  return new Request('https://bot.example/interactions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-signature-ed25519': signature,
      'x-signature-timestamp': timestamp,
    },
    body: raw,
  })
}

function envFor(keys: KeyPairHex): Env {
  return {
    DISCORD_PUBLIC_KEY: keys.publicKeyHex,
    DISCORD_APPLICATION_ID: APPLICATION_ID,
    DISCORD_TOKEN: 'test-token',
  }
}

/**
 * A stand-in for Cloudflare's ExecutionContext that keeps the promises, so a
 * test can await the background half of a deferred interaction instead of
 * racing it.
 */
function executionContext() {
  const pending: Promise<unknown>[] = []
  return {
    ctx: { waitUntil: (p: Promise<unknown>) => void pending.push(p) },
    settled: () => Promise.allSettled(pending),
  }
}

const interaction = {
  ping: () => ({ id: '1', application_id: APPLICATION_ID, type: InteractionType.Ping, token: 't' }),

  command: (subcommand: string, options: Array<{ name: string; value: string }> = []) => ({
    id: '2',
    application_id: APPLICATION_ID,
    type: InteractionType.ApplicationCommand,
    token: 'interaction-token',
    channel_id: CHANNEL_ID,
    member: { user: { id: USER_ID } },
    data: {
      id: 'cmd',
      name: 'su',
      type: 1,
      options: [
        {
          name: subcommand,
          type: 1, // SUB_COMMAND
          options: options.map((o) => ({ name: o.name, type: 3, value: o.value })),
        },
      ],
    },
  }),

  autocomplete: (subcommand: string, focusedName: string, value: string) => ({
    id: '3',
    application_id: APPLICATION_ID,
    type: InteractionType.ApplicationCommandAutocomplete,
    token: 'interaction-token',
    channel_id: CHANNEL_ID,
    member: { user: { id: USER_ID } },
    data: {
      id: 'cmd',
      name: 'su',
      type: 1,
      options: [
        {
          name: subcommand,
          type: 1,
          options: [{ name: focusedName, type: 3, value, focused: true }],
        },
      ],
    },
  }),

  button: (customId: string) => ({
    id: '4',
    application_id: APPLICATION_ID,
    type: InteractionType.MessageComponent,
    token: 'interaction-token',
    channel_id: CHANNEL_ID,
    member: { user: { id: USER_ID } },
    data: { custom_id: customId, component_type: 2 },
  }),
}

describe('signature verification', () => {
  test('a correctly signed PING is answered with PONG', async () => {
    const keys = await generateKeyPair()
    const { ctx } = executionContext()
    const res = await worker.fetch(await signedRequest(interaction.ping(), keys), envFor(keys), ctx)

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ type: InteractionResponseType.Pong })
  })

  test('a bad signature is rejected with 401', async () => {
    // Discord sends exactly this when you save an Interactions Endpoint URL: a
    // deliberately invalid signature, expecting a 401. Answering anything else
    // fails their validation, so this case is load-bearing rather than academic.
    const keys = await generateKeyPair()
    const { ctx } = executionContext()
    const res = await worker.fetch(
      await signedRequest(interaction.ping(), keys, { signature: 'ff'.repeat(64) }),
      envFor(keys),
      ctx
    )

    expect(res.status).toBe(401)
  })

  test('a body tampered with after signing is rejected', async () => {
    const keys = await generateKeyPair()
    const original = JSON.stringify(interaction.ping())
    const request = await signedRequest(interaction.ping(), keys)
    const signature = request.headers.get('x-signature-ed25519') ?? ''

    const { ctx } = executionContext()
    const res = await worker.fetch(
      await signedRequest(null, keys, {
        signature,
        body: original.replace('"1"', '"999"'),
      }),
      envFor(keys),
      ctx
    )

    expect(res.status).toBe(401)
  })

  test('missing signature headers are rejected', async () => {
    const keys = await generateKeyPair()
    const { ctx } = executionContext()
    const res = await worker.fetch(
      new Request('https://bot.example/interactions', {
        method: 'POST',
        body: JSON.stringify(interaction.ping()),
      }),
      envFor(keys),
      ctx
    )

    expect(res.status).toBe(401)
  })

  test('a signature from a DIFFERENT key is rejected', async () => {
    const keys = await generateKeyPair()
    const attacker = await generateKeyPair()
    const { ctx } = executionContext()
    // Signed correctly — just not by the application whose key we trust.
    const res = await worker.fetch(
      await signedRequest(interaction.ping(), attacker),
      envFor(keys),
      ctx
    )

    expect(res.status).toBe(401)
  })

  test('GET is refused without consulting the signature at all', async () => {
    const keys = await generateKeyPair()
    const { ctx } = executionContext()
    const res = await worker.fetch(
      new Request('https://bot.example/interactions', { method: 'GET' }),
      envFor(keys),
      ctx
    )

    expect(res.status).toBe(405)
  })
})

describe('interaction dispatch', () => {
  test('a slash command answers with a message in the initial response', async () => {
    const keys = await generateKeyPair()
    const { ctx, settled } = executionContext()
    const res = await worker.fetch(
      await signedRequest(interaction.command('roll', [{ name: 'table', value: 'core' }]), keys),
      envFor(keys),
      ctx
    )
    await settled()

    expect(res.status).toBe(200)
    const body = (await res.json()) as { type: number; data?: { embeds?: unknown[] } }
    // Either a real result or the command's own error reply — both are message
    // responses. What must NOT happen is a defer or an empty ack, since the roll
    // commands answer synchronously and that is the UX this transport preserves.
    expect(body.type).toBe(InteractionResponseType.ChannelMessageWithSource)
    expect(body.data).toBeDefined()
  })

  test('autocomplete answers with a choices payload, never a defer', async () => {
    const keys = await generateKeyPair()
    const { ctx, settled } = executionContext()
    const res = await worker.fetch(
      await signedRequest(interaction.autocomplete('roll', 'table', 'cor'), keys),
      envFor(keys),
      ctx
    )
    await settled()

    const body = (await res.json()) as { type: number; data?: { choices?: unknown[] } }
    // Discord does not permit deferring an autocomplete; the choices must be in
    // the initial response or the box simply stays empty.
    expect(body.type).toBe(InteractionResponseType.ApplicationCommandAutocompleteResult)
    expect(Array.isArray(body.data?.choices)).toBe(true)
  })

  test('an unrecognised button replies rather than hanging', async () => {
    const keys = await generateKeyPair()
    const { ctx, settled } = executionContext()
    const res = await worker.fetch(
      await signedRequest(interaction.button('not-a-real-button'), keys),
      envFor(keys),
      ctx
    )
    await settled()

    const body = (await res.json()) as { type: number; data?: { content?: string } }
    expect(body.type).toBe(InteractionResponseType.ChannelMessageWithSource)
    expect(body.data?.content).toContain('no longer supported')
  })

  test('a real /su lookup resolves its nested option and returns an embed', async () => {
    // The positive case for option resolution. Discord nests options — a
    // subcommand holds the values — so a naive read of the top level finds
    // nothing, and every command would answer "not found" while looking fine.
    const keys = await generateKeyPair()
    const { ctx, settled } = executionContext()
    const res = await worker.fetch(
      await signedRequest(interaction.command('lookup', [{ name: 'entity', value: 'mule' }]), keys),
      envFor(keys),
      ctx
    )
    await settled()

    const body = (await res.json()) as {
      type: number
      data?: { embeds?: Array<{ title?: string }>; content?: string }
    }
    expect(body.type).toBe(InteractionResponseType.ChannelMessageWithSource)
    // A real result, not the generic failure reply. Asserted on the embed
    // rather than on `content`: a successful lookup carries embeds and NO
    // content, so `expect(content).not.toContain(...)` would be checking
    // `undefined` — which throws rather than passing, and would have made this
    // test fail for a reason unrelated to the behaviour under test.
    expect(body.data?.embeds?.[0]?.title).toBe('Mule')
    expect(body.data?.content).toBeUndefined()
  })

  test('a missing REQUIRED option fails cleanly rather than passing null onward', async () => {
    // `getString(name, true)` is typed as `string`. An adapter that returns null
    // there hands a handler a value its types promised could not exist, and the
    // failure surfaces frames away — this was a real defect, found by driving
    // /su lookup with the wrong option name and getting
    // "null is not an object (evaluating 'value.indexOf')".
    const keys = await generateKeyPair()
    const { ctx, settled } = executionContext()
    const res = await worker.fetch(
      await signedRequest(
        interaction.command('lookup', [{ name: 'wrong-name', value: 'x' }]),
        keys
      ),
      envFor(keys),
      ctx
    )
    await settled()

    const body = (await res.json()) as { type: number; data?: { content?: string } }
    expect(body.type).toBe(InteractionResponseType.ChannelMessageWithSource)
    expect(body.data?.content).toContain('There was an error')
  })

  test('an unknown command name still produces a response', async () => {
    // The failure this guards against is Discord's "The application did not
    // respond" — worse than an error message, because it names nothing.
    const keys = await generateKeyPair()
    const raw = { ...interaction.command('roll'), data: { id: 'x', name: 'nope', type: 1 } }
    const { ctx, settled } = executionContext()
    const res = await worker.fetch(await signedRequest(raw, keys), envFor(keys), ctx)
    await settled()

    const body = (await res.json()) as { type: number }
    expect(body.type).toBe(InteractionResponseType.ChannelMessageWithSource)
  })
})
