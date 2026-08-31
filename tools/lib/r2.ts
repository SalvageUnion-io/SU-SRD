/**
 * A minimal S3-compatible client for R2, built on SigV4.
 *
 * ## Why this exists rather than `wrangler r2 object`
 *
 * `wrangler r2 object` offers exactly three verbs — `get`, `put`, `delete` —
 * and **no `list`**. That is disqualifying for a backup tool: an export that
 * cannot enumerate the bucket cannot prove it copied everything, and "we
 * exported the keys we already knew about" is not a backup of licensed material
 * that exists in one place. R2's S3-compatible API does have `ListObjectsV2`,
 * so that is the interface used here.
 *
 * Deriving the key list from the dataset instead was considered and rejected for
 * the same reason. `getAssetUrl` can generate every key the *site* asks for, but
 * an object nobody references is exactly the object a store listing would catch
 * and a derived list would silently drop — and losing it is unrecoverable,
 * because the bytes are licensed and cannot enter this repo.
 *
 * ## Credentials
 *
 * Four values, all read from the environment and never logged:
 *
 *   R2_ACCOUNT_ID          the Cloudflare account id, OR the S3 endpoint URL
 *                          Cloudflare actually hands you — see below
 *   R2_ACCESS_KEY_ID       from an R2 API token
 *   R2_SECRET_ACCESS_KEY   from the same token
 *
 * `R2_ACCOUNT_ID` accepts the endpoint because that is the form the dashboard
 * gives you: creating an R2 token shows an Access Key ID, a Secret Access Key
 * and an endpoint like `https://<account id>.r2.cloudflarestorage.com`, and
 * nowhere on that screen is the bare account id presented as a copyable value.
 * Demanding one meant an operator had to know that the first hostname label IS
 * the account id and retype it — friction invented by this tool, paid every
 * time, for nothing.
 *
 * Create the token scoped to a single bucket. ADR-033 records that Cloudflare
 * supports per-bucket R2 scoping but not per-Worker scoping, and asks for the
 * R2 half to be narrowed precisely because the other half cannot be — so a token
 * minted for this tool should reach `su-lp-assets` and nothing else.
 *
 * ## Scope
 *
 * Deliberately small: list, get, put. No multipart, no delete, no ACLs. R2
 * accepts single-part uploads to 5 GB and the largest object here is a few
 * hundred KB, so multipart would be unused code guarding an impossible case.
 */
import { createHash, createHmac } from 'node:crypto'

const SERVICE = 's3'
const REGION = 'auto'

export type R2Credentials = {
  accountId: string
  accessKeyId: string
  secretAccessKey: string
}

export type R2Object = {
  key: string
  size: number
  etag: string
}

/**
 * Read credentials from the environment, failing with a message that names every
 * missing variable at once.
 *
 * One error listing all three beats three runs each revealing the next gap.
 */
/**
 * The account id, from either the bare id or the S3 endpoint URL.
 *
 * Tolerant of what a person actually has on their clipboard: with or without a
 * scheme, with or without a trailing slash or path. Anything that is not an
 * endpoint is returned unchanged, so a bare id still works and a malformed
 * value still fails later with a signing error naming the host it tried.
 */
export function accountIdFrom(value: string): string {
  const withoutScheme = value.replace(/^https?:\/\//, '')
  const host = withoutScheme.split('/')[0] ?? withoutScheme
  const label = host.split('.')[0] ?? host
  return host.includes('.r2.cloudflarestorage.com') ? label : value
}

export function credentialsFromEnv(): R2Credentials {
  const accountId = process.env.R2_ACCOUNT_ID
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY

  const missing = [
    !accountId && 'R2_ACCOUNT_ID',
    !accessKeyId && 'R2_ACCESS_KEY_ID',
    !secretAccessKey && 'R2_SECRET_ACCESS_KEY',
  ].filter((name): name is string => typeof name === 'string')

  if (missing.length > 0) {
    throw new Error(
      `missing R2 credential(s): ${missing.join(', ')}\n` +
        '  Create an R2 API token scoped to the one bucket you are touching:\n' +
        '  Cloudflare dashboard → R2 → Manage R2 API Tokens → Create API token.'
    )
  }

  return {
    accountId: accountIdFrom(accountId as string),
    accessKeyId: accessKeyId as string,
    secretAccessKey: secretAccessKey as string,
  }
}

function sha256Hex(payload: Uint8Array | string): string {
  return createHash('sha256').update(payload).digest('hex')
}

function hmac(key: Uint8Array | string, data: string): Buffer {
  return createHmac('sha256', key).update(data).digest()
}

/**
 * The SigV4 signing key: a four-step HMAC chain over date, region, service and
 * the literal `aws4_request`. Each step keys the next.
 */
function signingKey(secret: string, date: string): Buffer {
  return hmac(hmac(hmac(hmac(`AWS4${secret}`, date), REGION), SERVICE), 'aws4_request')
}

/**
 * Percent-encode one path segment per RFC 3986.
 *
 * `encodeURIComponent` leaves `!'()*` alone and AWS requires them encoded, so
 * they are fixed up explicitly. A key containing an apostrophe — which entity
 * slugs can produce — would otherwise sign correctly and 403 on arrival.
 */
function encodeSegment(segment: string): string {
  return encodeURIComponent(segment).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  )
}

function encodeKey(key: string): string {
  return key.split('/').map(encodeSegment).join('/')
}

type SignedRequest = {
  url: string
  method: string
  headers: Record<string, string>
  body?: Uint8Array
}

/**
 * Sign a request with SigV4.
 *
 * The payload hash is always computed rather than sent as `UNSIGNED-PAYLOAD`:
 * R2 accepts both, and signing the body means a corrupted upload fails the
 * signature instead of landing as corrupt bytes — which is the failure this
 * whole tool exists to make impossible.
 */
function sign(
  creds: R2Credentials,
  method: string,
  path: string,
  query: Record<string, string>,
  body: Uint8Array | undefined
): SignedRequest {
  const host = `${creds.accountId}.r2.cloudflarestorage.com`
  // `2026-08-31T05:25:17.123Z` → `20260831T052517Z`. The trailing Z survives the
  // replace and is required; slicing it off and re-appending drops a digit.
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '')
  const dateStamp = amzDate.slice(0, 8)
  const payloadHash = sha256Hex(body ?? '')

  const canonicalQuery = Object.keys(query)
    .sort()
    .map((k) => `${encodeSegment(k)}=${encodeSegment(query[k] as string)}`)
    .join('&')

  const headers: Record<string, string> = {
    host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
  }

  const signedHeaders = Object.keys(headers).sort().join(';')
  const canonicalHeaders = `${Object.keys(headers)
    .sort()
    .map((h) => `${h}:${headers[h]}`)
    .join('\n')}\n`

  const canonicalRequest = [
    method,
    path,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n')

  const scope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256Hex(canonicalRequest)].join('\n')

  const signature = hmac(signingKey(creds.secretAccessKey, dateStamp), stringToSign).toString('hex')

  headers.authorization =
    `AWS4-HMAC-SHA256 Credential=${creds.accessKeyId}/${scope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`

  return {
    url: `https://${host}${path}${canonicalQuery ? `?${canonicalQuery}` : ''}`,
    method,
    headers,
    body,
  }
}

async function send(req: SignedRequest): Promise<Response> {
  const response = await fetch(req.url, {
    method: req.method,
    headers: req.headers,
    body: req.body,
  })
  if (!response.ok) {
    // R2 returns an XML error document. Surfacing its body is what turns
    // "403" into "the token has no access to this bucket".
    const detail = (await response.text()).slice(0, 400)
    throw new Error(`R2 ${req.method} failed: ${response.status} ${response.statusText}\n${detail}`)
  }
  return response
}

/** Pull the text content of the first `<tag>` inside `xml`, or undefined. */
function tagText(xml: string, tag: string): string | undefined {
  return new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`).exec(xml)?.[1]
}

/**
 * Every object in the bucket, following continuation tokens to the end.
 *
 * A truncated listing that looks complete is the one bug that would defeat the
 * verification below, so the loop is unbounded by design and terminates on
 * `IsTruncated` rather than on a page count.
 */
export async function listObjects(
  creds: R2Credentials,
  bucket: string,
  prefix?: string
): Promise<R2Object[]> {
  const objects: R2Object[] = []
  let continuationToken: string | undefined

  do {
    const query: Record<string, string> = { 'list-type': '2', 'max-keys': '1000' }
    if (prefix) query.prefix = prefix
    if (continuationToken) query['continuation-token'] = continuationToken

    const xml = await (await send(sign(creds, 'GET', `/${bucket}`, query, undefined))).text()

    for (const match of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
      const block = match[1]
      if (block === undefined) continue
      const key = tagText(block, 'Key')
      if (!key) continue
      objects.push({
        key,
        size: Number(tagText(block, 'Size') ?? 0),
        etag: (tagText(block, 'ETag') ?? '').replace(/(^"|"$|^&quot;|&quot;$)/g, ''),
      })
    }

    continuationToken =
      tagText(xml, 'IsTruncated') === 'true' ? tagText(xml, 'NextContinuationToken') : undefined
  } while (continuationToken)

  return objects
}

/** One object's bytes. */
export async function getObject(
  creds: R2Credentials,
  bucket: string,
  key: string
): Promise<Uint8Array> {
  const response = await send(sign(creds, 'GET', `/${bucket}/${encodeKey(key)}`, {}, undefined))
  return new Uint8Array(await response.arrayBuffer())
}

/** Write one object, with an explicit content type. */
export async function putObject(
  creds: R2Credentials,
  bucket: string,
  key: string,
  body: Uint8Array,
  contentType: string
): Promise<void> {
  const signed = sign(creds, 'PUT', `/${bucket}/${encodeKey(key)}`, {}, body)
  // Content-Type is not signed — R2 stores it as object metadata, and the
  // su-assets Worker sets its own on the way out, so a mismatch here is
  // cosmetic rather than load-bearing. It is set anyway so the bucket is
  // browsable in the dashboard.
  signed.headers['content-type'] = contentType
  await send(signed)
}
