import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import {
  errorOfConvexEvent,
  handleConvexLogStream,
  handleErrorReport,
  reportError,
  verifyConvexSignature,
} from '../cloudflare'

/**
 * Workers Issues records what a Worker logs with `console.error`, so what these
 * assert is exactly what reaches it: the arguments `console.error` was called
 * with. The spy swallows the output.
 */
let logged: unknown[][] = []
let spy: ReturnType<typeof spyOn>

beforeEach(() => {
  logged = []
  spy = spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    logged.push(args)
  })
})

afterEach(() => {
  spy.mockRestore()
})

describe('reportError', () => {
  test('logs the error and its context at error level', () => {
    const boom = new Error('r2 down')
    reportError(boom, { op: 'r2.get' })
    expect(logged).toEqual([[boom, { op: 'r2.get' }]])
  })

  test('logs an empty context rather than undefined', () => {
    reportError('bare')
    expect(logged).toEqual([['bare', {}]])
  })
})

function post(body: string, headers: Record<string, string> = {}): Request {
  return new Request('https://salvageunion.io/__errors', { method: 'POST', body, headers })
}

describe('handleErrorReport', () => {
  test('logs a report as an Error carrying the browser’s name, message and stack', async () => {
    const res = await handleErrorReport(
      post(
        JSON.stringify({
          name: 'TypeError',
          message: 'x is undefined',
          stack:
            'TypeError: x is undefined\n    at a (https://salvageunion.io/assets/i-ABC.js:1:2)',
          url: 'https://salvageunion.io/chassis/mule/',
          release: 'abc123',
          context: { where: 'island' },
          tags: { handler: 'error' },
        }),
        { 'user-agent': 'test-agent' }
      ),
      { app: 'srd' }
    )

    expect(res.status).toBe(204)
    expect(res.headers.get('cache-control')).toBe('no-store')
    const [error, context] = logged[0] as [Error, Record<string, unknown>]
    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('TypeError')
    expect(error.message).toBe('x is undefined')
    expect(error.stack).toContain('i-ABC.js:1:2')
    expect(context).toEqual({
      source: 'browser',
      app: 'srd',
      url: 'https://salvageunion.io/chassis/mule/',
      release: 'abc123',
      tags: { handler: 'error' },
      context: { where: 'island' },
      userAgent: 'test-agent',
    })
  })

  test('a fingerprinted report is logged under its fingerprint, the message kept as context', async () => {
    // A message with a request id in it would group one condition as many.
    const res = await handleErrorReport(
      post(
        JSON.stringify({
          message: '[CONVEX M(games:create)] [Request ID: 1b66] Server Error',
          fingerprint: ['convex', 'games:create'],
        })
      ),
      { app: 'cantina' }
    )

    expect(res.status).toBe(204)
    const [error, context] = logged[0] as [Error, Record<string, unknown>]
    expect(error.name).toBe('Error')
    expect(error.message).toBe('convex games:create')
    expect(error.stack).toBe('Error: convex games:create')
    expect(context.message).toBe('[CONVEX M(games:create)] [Request ID: 1b66] Server Error')
  })

  test('answers 405 to anything but POST, and logs nothing', async () => {
    const res = await handleErrorReport(new Request('https://salvageunion.io/__errors'), {
      app: 'srd',
    })
    expect(res.status).toBe(405)
    expect(res.headers.get('allow')).toBe('POST')
    expect(logged).toEqual([])
  })

  test.each([
    ['not JSON', 'not json'],
    ['not an object', '[1, 2]'],
    ['no message', '{"name":"Error"}'],
  ])('answers 400 to a body that is %s, and logs nothing', async (_, body) => {
    const res = await handleErrorReport(post(body), { app: 'srd' })
    expect(res.status).toBe(400)
    expect(logged).toEqual([])
  })

  test('answers 413 to an oversized body', async () => {
    const res = await handleErrorReport(post(JSON.stringify({ message: 'x'.repeat(20_000) })), {
      app: 'srd',
    })
    expect(res.status).toBe(413)
    expect(logged).toEqual([])
  })

  test('answers 429 when the address is over its limit, keyed by the client address', async () => {
    const keys: string[] = []
    const limiter = {
      limit: async ({ key }: { key: string }) => {
        keys.push(key)
        return { success: false }
      },
    }
    const res = await handleErrorReport(
      post('{"message":"x"}', { 'cf-connecting-ip': '203.0.113.7' }),
      { app: 'srd', limiter }
    )
    expect(res.status).toBe(429)
    expect(keys).toEqual(['203.0.113.7'])
    expect(logged).toEqual([])
  })

  test('drops fields of the wrong type rather than refusing the report', async () => {
    const res = await handleErrorReport(
      post(
        JSON.stringify({ message: 'm', name: 7, tags: { ok: 'yes', bad: 1 }, fingerprint: [1] })
      ),
      { app: 'srd' }
    )
    expect(res.status).toBe(204)
    const [error, context] = logged[0] as [Error, Record<string, unknown>]
    expect(error.name).toBe('Error')
    expect(error.message).toBe('m')
    expect(context.tags).toEqual({ ok: 'yes' })
  })
})

const SECRET = 'whsec-test'

async function sign(body: string, secret = SECRET): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body)))
  return [...mac].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function delivery(body: string, signature?: string): Request {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (signature !== undefined) headers['x-webhook-signature'] = signature
  return new Request('https://salvageunion.io/__convex-logs', {
    method: 'POST',
    body,
    headers,
  })
}

const FAILURE = {
  topic: 'function_execution',
  function: { type: 'action', path: 'authHealth:check', request_id: 'req-1' },
  status: 'failure',
  error_message: 'Uncaught Error: sign-in stalled\n    at handler (../convex/authHealth.ts:80:11)',
}
const SUCCESS = { ...FAILURE, status: 'success', error_message: undefined }
const CONSOLE_ERROR = {
  topic: 'console',
  function: { type: 'mutation', path: 'auth:store' },
  log_level: 'ERROR',
  message: 'unexpected "iss" (issuer) response parameter value',
}
const CONSOLE_WARN = { ...CONSOLE_ERROR, log_level: 'WARN' }

describe('handleConvexLogStream', () => {
  test('logs each failed function and console.error, and nothing else', async () => {
    const body = JSON.stringify([
      { topic: 'verification', message: 'Convex connection test' },
      SUCCESS,
      FAILURE,
      CONSOLE_WARN,
      CONSOLE_ERROR,
    ])
    const res = await handleConvexLogStream(delivery(body, await sign(body)), SECRET)

    expect(res.status).toBe(200)
    expect(logged).toHaveLength(2)
    const [failure, failureContext] = logged[0] as [Error, Record<string, unknown>]
    expect(failure.name).toBe('ConvexFunctionError')
    expect(failure.message).toBe('Uncaught Error: sign-in stalled')
    expect(failure.stack).toContain('authHealth.ts:80:11')
    expect(failureContext).toEqual({
      source: 'convex',
      function: 'authHealth:check',
      type: 'action',
      requestId: 'req-1',
    })
    const [consoleError] = logged[1] as [Error]
    expect(consoleError.name).toBe('ConvexConsoleError')
    expect(consoleError.message).toBe('unexpected "iss" (issuer) response parameter value')
  })

  test('accepts the signature with a sha256= prefix, one object, and JSON lines', async () => {
    const single = JSON.stringify(FAILURE)
    const one = await handleConvexLogStream(
      delivery(single, `sha256=${await sign(single)}`),
      SECRET
    )
    expect(one.status).toBe(200)

    const lines = `${JSON.stringify(FAILURE)}\nnot json\n${JSON.stringify(CONSOLE_ERROR)}\n`
    const many = await handleConvexLogStream(delivery(lines, await sign(lines)), SECRET)
    expect(many.status).toBe(200)
    expect(logged).toHaveLength(3)
  })

  test.each([
    ['missing', undefined],
    ['not hex', 'zz'],
    ['for another body', 'sign-other'],
    ['under another secret', 'sign-wrong-secret'],
  ])('answers 401 to a signature %s, and logs nothing', async (_, kind) => {
    const body = JSON.stringify([FAILURE])
    const signature =
      kind === 'sign-other'
        ? await sign('{}')
        : kind === 'sign-wrong-secret'
          ? await sign(body, 'other')
          : kind
    const res = await handleConvexLogStream(delivery(body, signature), SECRET)
    expect(res.status).toBe(401)
    expect(logged).toEqual([])
  })

  test('answers 503 with no secret configured, and 405 to anything but POST', async () => {
    const body = JSON.stringify([FAILURE])
    expect((await handleConvexLogStream(delivery(body, await sign(body)), undefined)).status).toBe(
      503
    )
    const get = new Request('https://salvageunion.io/__convex-logs')
    expect((await handleConvexLogStream(get, SECRET)).status).toBe(405)
    expect(logged).toEqual([])
  })
})

describe('verifyConvexSignature and errorOfConvexEvent', () => {
  test('an odd-length signature is refused, not thrown on', async () => {
    expect(await verifyConvexSignature(new Uint8Array(), 'abc', SECRET)).toBe(false)
  })

  test('a failure with no message and no function still becomes an error', () => {
    const failure = errorOfConvexEvent({ topic: 'function_execution', status: 'failure' })
    expect(failure?.error.message).toBe('Convex function failed')
    expect(failure?.context.function).toBeUndefined()
  })
})
