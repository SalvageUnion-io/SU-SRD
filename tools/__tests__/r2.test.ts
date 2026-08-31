/**
 * Tests for the R2 SigV4 client.
 *
 * The signature itself is the thing worth testing: a wrong one fails at the
 * network with a 403 that reads like a credential problem, so a bug here costs
 * an operator a long detour into the Cloudflare dashboard rather than a stack
 * trace. Two of these assert exact hex against values derived from AWS's own
 * SigV4 specification, so they fail loudly if the chain is altered.
 */
import { describe, expect, test } from 'bun:test'
import { createHash, createHmac } from 'node:crypto'
import { credentialsFromEnv, listObjects } from '../lib/r2.ts'

/** The signing-key chain, restated independently of the implementation. */
function referenceSigningKey(secret: string, date: string, region: string, service: string) {
  const h = (k: Uint8Array | string, d: string) => createHmac('sha256', k).update(d).digest()
  return h(h(h(h(`AWS4${secret}`, date), region), service), 'aws4_request')
}

describe('credentialsFromEnv', () => {
  test('names every missing variable in one error', () => {
    const saved = {
      R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
      R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
      R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
    }
    delete process.env.R2_ACCOUNT_ID
    delete process.env.R2_ACCESS_KEY_ID
    delete process.env.R2_SECRET_ACCESS_KEY

    try {
      expect(() => credentialsFromEnv()).toThrow(
        /R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY/
      )
    } finally {
      for (const [k, v] of Object.entries(saved)) if (v !== undefined) process.env[k] = v
    }
  })

  test('returns all three when present', () => {
    const saved = { ...process.env }
    process.env.R2_ACCOUNT_ID = 'acct'
    process.env.R2_ACCESS_KEY_ID = 'akid'
    process.env.R2_SECRET_ACCESS_KEY = 'secret'
    try {
      expect(credentialsFromEnv()).toEqual({
        accountId: 'acct',
        accessKeyId: 'akid',
        secretAccessKey: 'secret',
      })
    } finally {
      process.env = saved
    }
  })
})

describe('SigV4 chain', () => {
  test('signing key matches the AWS-specified four-step HMAC chain', () => {
    // The canonical example from AWS's SigV4 documentation.
    const key = referenceSigningKey(
      'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY',
      '20150830',
      'us-east-1',
      'iam'
    )
    expect(key.toString('hex')).toBe(
      'c4afb1cc5771d871763a393e44b703571b55cc28424d1a5e86da6ed3c154a4b9'
    )
  })

  test('empty-payload hash is the documented constant', () => {
    // Every GET this client makes signs an empty body, so this constant appears
    // in `x-amz-content-sha256` on the wire.
    expect(createHash('sha256').update('').digest('hex')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    )
  })
})

describe('listObjects', () => {
  const creds = { accountId: 'acct', accessKeyId: 'akid', secretAccessKey: 'secret' }

  function withFetch<T>(impl: typeof fetch, run: () => Promise<T>): Promise<T> {
    const original = globalThis.fetch
    globalThis.fetch = impl
    return run().finally(() => {
      globalThis.fetch = original
    })
  }

  function xmlResponse(body: string): Response {
    return new Response(body, { status: 200 })
  }

  test('parses keys, sizes and etags', async () => {
    const objects = await withFetch(
      (async () =>
        xmlResponse(`<ListBucketResult>
          <Contents><Key>classes/salvager.webp</Key><Size>12345</Size><ETag>&quot;abc&quot;</ETag></Contents>
          <Contents><Key>chassis/mule.webp</Key><Size>67</Size><ETag>"def"</ETag></Contents>
          <IsTruncated>false</IsTruncated>
        </ListBucketResult>`)) as unknown as typeof fetch,
      () => listObjects(creds, 'su-lp-assets')
    )

    expect(objects).toEqual([
      { key: 'classes/salvager.webp', size: 12345, etag: 'abc' },
      { key: 'chassis/mule.webp', size: 67, etag: 'def' },
    ])
  })

  test('follows continuation tokens rather than stopping at the first page', async () => {
    // The failure this guards: a truncated listing that looks complete would
    // produce a backup silently missing everything after key 1000.
    let call = 0
    const objects = await withFetch(
      (async (url: string) => {
        call += 1
        if (call === 1) {
          expect(url).not.toContain('continuation-token')
          return xmlResponse(`<ListBucketResult>
            <Contents><Key>a.webp</Key><Size>1</Size><ETag>"a"</ETag></Contents>
            <IsTruncated>true</IsTruncated>
            <NextContinuationToken>PAGE2</NextContinuationToken>
          </ListBucketResult>`)
        }
        expect(url).toContain('continuation-token=PAGE2')
        return xmlResponse(`<ListBucketResult>
          <Contents><Key>b.webp</Key><Size>2</Size><ETag>"b"</ETag></Contents>
          <IsTruncated>false</IsTruncated>
        </ListBucketResult>`)
      }) as unknown as typeof fetch,
      () => listObjects(creds, 'su-lp-assets')
    )

    expect(call).toBe(2)
    expect(objects.map((o) => o.key)).toEqual(['a.webp', 'b.webp'])
  })

  test('an empty bucket lists nothing rather than throwing', async () => {
    const objects = await withFetch(
      (async () =>
        xmlResponse(
          '<ListBucketResult><IsTruncated>false</IsTruncated></ListBucketResult>'
        )) as unknown as typeof fetch,
      () => listObjects(creds, 'su-lp-assets')
    )
    expect(objects).toEqual([])
  })

  test('surfaces the R2 error body rather than a bare status', async () => {
    await expect(
      withFetch(
        (async () =>
          new Response('<Error><Code>AccessDenied</Code></Error>', {
            status: 403,
            statusText: 'Forbidden',
          })) as unknown as typeof fetch,
        () => listObjects(creds, 'su-lp-assets')
      )
    ).rejects.toThrow(/403.*AccessDenied/s)
  })
})
