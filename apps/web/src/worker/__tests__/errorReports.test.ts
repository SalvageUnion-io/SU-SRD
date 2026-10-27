import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import { handleErrorReport, reportError } from '../errorReports'

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
    expect(logged).toEqual([[boom, { message: 'Error: r2 down', op: 'r2.get' }]])
  })

  test('puts a many-line message on one line, where Workers Logs shows it', () => {
    const refused = Object.assign(new Error('Invalid Form Body\ncontent[BASE_TYPE]: refused'), {
      name: 'DiscordAPIError[50035]',
    })
    reportError(refused, { op: 'patch-original' })
    expect(logged[0]?.[1]).toEqual({
      message: 'DiscordAPIError[50035]: Invalid Form Body content[BASE_TYPE]: refused',
      op: 'patch-original',
    })
  })

  test('a message of the caller’s own wins', () => {
    reportError(new Error('x'), { message: 'mine' })
    expect(logged[0]?.[1]).toEqual({ message: 'mine' })
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
      { app: 'app' }
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
