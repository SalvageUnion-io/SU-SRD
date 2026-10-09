/**
 * Tests for the R2 helpers and the export's write path.
 *
 * `listObjects` is driven through the real `Bun.S3Client` against a local server
 * answering `ListObjectsV2`, so what is tested is the pagination this tool
 * relies on, not a mock of it.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { join, resolve } from 'node:path'
import { destinationFor } from '../export-lp-assets.ts'
import { credentialsFromEnv, listObjects, r2Client } from '../lib/r2.ts'

describe('credentialsFromEnv', () => {
  const NAMES = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY'] as const

  // Restores the three keys in place: reassigning `process.env` replaces the
  // object other suites' `import.meta.env` reads through, in a shared process.
  function withEnv(values: Partial<Record<(typeof NAMES)[number], string>>, run: () => void) {
    const saved = Object.fromEntries(NAMES.map((k) => [k, process.env[k]]))
    for (const k of NAMES) {
      const v = values[k]
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
    try {
      run()
    } finally {
      for (const [k, v] of Object.entries(saved)) {
        if (v === undefined) delete process.env[k]
        else process.env[k] = v
      }
    }
  }

  test('names every missing variable in one error', () => {
    withEnv({}, () => {
      expect(() => credentialsFromEnv()).toThrow(
        /R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY/
      )
    })
  })

  test('returns all three when present', () => {
    withEnv(
      { R2_ACCOUNT_ID: 'acct', R2_ACCESS_KEY_ID: 'akid', R2_SECRET_ACCESS_KEY: 'secret' },
      () => {
        expect(credentialsFromEnv()).toEqual({
          accountId: 'acct',
          accessKeyId: 'akid',
          secretAccessKey: 'secret',
        })
      }
    )
  })
})

describe('listObjects', () => {
  const creds = { accountId: 'acct', accessKeyId: 'akid', secretAccessKey: 'secret' }
  let respond: (url: URL) => Response
  let server: ReturnType<typeof Bun.serve>

  beforeAll(() => {
    server = Bun.serve({ port: 0, fetch: (req) => respond(new URL(req.url)) })
  })
  afterAll(() => server.stop(true))

  const client = () => r2Client(creds, 'su-lp-assets', `http://127.0.0.1:${server.port}`)
  const xml = (body: string) =>
    new Response(
      `<?xml version="1.0" encoding="UTF-8"?><ListBucketResult>${body}</ListBucketResult>`
    )

  test('parses keys and sizes', async () => {
    respond = () =>
      xml(`<Contents><Key>classes/salvager.webp</Key><Size>12345</Size></Contents>
        <Contents><Key>chassis/mule.webp</Key><Size>67</Size></Contents>
        <IsTruncated>false</IsTruncated>`)

    expect(await listObjects(client())).toEqual([
      { key: 'classes/salvager.webp', size: 12345 },
      { key: 'chassis/mule.webp', size: 67 },
    ])
  })

  test('follows continuation tokens rather than stopping at the first page', async () => {
    // The failure this guards: a truncated listing that looks complete would
    // produce a backup silently missing everything after key 1000.
    const tokens: (string | null)[] = []
    respond = (url) => {
      const token = url.searchParams.get('continuation-token')
      tokens.push(token)
      return token === null
        ? xml(`<Contents><Key>a.webp</Key><Size>1</Size></Contents>
            <IsTruncated>true</IsTruncated><NextContinuationToken>PAGE2</NextContinuationToken>`)
        : xml(
            '<Contents><Key>b.webp</Key><Size>2</Size></Contents><IsTruncated>false</IsTruncated>'
          )
    }

    const objects = await listObjects(client())
    expect(tokens).toEqual([null, 'PAGE2'])
    expect(objects.map((o) => o.key)).toEqual(['a.webp', 'b.webp'])
  })

  test('an empty bucket lists nothing rather than throwing', async () => {
    respond = () => xml('<IsTruncated>false</IsTruncated>')
    expect(await listObjects(client())).toEqual([])
  })

  test('surfaces the R2 error code rather than a bare status', async () => {
    respond = () =>
      new Response('<Error><Code>AccessDenied</Code><Message>Access Denied</Message></Error>', {
        status: 403,
      })
    await expect(listObjects(client())).rejects.toMatchObject({ code: 'AccessDenied' })
  })
})

describe('destinationFor', () => {
  const out = resolve('/tmp/export')

  test('places a key under the output directory', () => {
    expect(destinationFor(out, 'chassis/mule.webp')).toBe(join(out, 'chassis/mule.webp'))
  })

  test('refuses a key that climbs out of the output directory (CodeQL #93)', () => {
    expect(() => destinationFor(out, '../../etc/passwd')).toThrow(/escapes/)
    expect(() => destinationFor(out, 'chassis/../../x')).toThrow(/escapes/)
    expect(() => destinationFor(out, '/etc/passwd')).toThrow(/escapes/)
  })
})
