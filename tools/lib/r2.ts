/**
 * The R2 bucket behind https://assets.salvageunion.io, through Bun's own S3
 * client (`Bun.S3Client`) against R2's S3-compatible API.
 *
 * ## Why S3 rather than `wrangler r2 object`
 *
 * `wrangler r2 object` offers exactly three verbs — `get`, `put`, `delete` —
 * and **no `list`**. That is disqualifying for a backup tool: an export that
 * cannot enumerate the bucket cannot prove it copied everything, and "we
 * exported the keys we already knew about" is not a backup of licensed material
 * that exists in one place. R2's S3-compatible API does have `ListObjectsV2`.
 *
 * Deriving the key list from the dataset instead was considered and rejected for
 * the same reason. `getAssetUrl` can generate every key the *site* asks for, but
 * an object nobody references is exactly the object a store listing would catch
 * and a derived list would silently drop — and losing it is unrecoverable,
 * because the bytes are licensed and cannot enter this repo.
 *
 * ## Credentials
 *
 * Three values, all read from the environment and never logged:
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
 *
 * Create the token scoped to a single bucket. ADR-033 records that Cloudflare
 * supports per-bucket R2 scoping but not per-Worker scoping, and asks for the
 * R2 half to be narrowed precisely because the other half cannot be — so a token
 * minted for this tool should reach `su-lp-assets` and nothing else.
 */
import { S3Client } from 'bun'

export type R2Credentials = {
  accountId: string
  accessKeyId: string
  secretAccessKey: string
}

export type R2Object = {
  key: string
  size: number
}

/**
 * The account id, from either the bare id or the S3 endpoint URL.
 *
 * Tolerant of what a person actually has on their clipboard: with or without a
 * scheme, with or without a trailing slash or path. Anything that is not an
 * endpoint is returned unchanged, so a bare id still works and a malformed
 * value still fails later with an error naming the host it tried.
 *
 * The host must END in the R2 suffix: a substring test also matched
 * `<id>.r2.cloudflarestorage.com.example.net` (CodeQL alert #94).
 */
export function accountIdFrom(value: string): string {
  const withoutScheme = value.replace(/^https?:\/\//, '')
  const host = withoutScheme.split('/')[0] ?? withoutScheme
  const label = host.split('.')[0] ?? host
  return host.endsWith('.r2.cloudflarestorage.com') ? label : value
}

/**
 * Read credentials from the environment, failing with a message that names every
 * missing variable at once.
 */
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

/**
 * A client for one bucket. `endpoint` defaults to the account's R2 endpoint;
 * the tests point it at a local server.
 */
export function r2Client(
  creds: R2Credentials,
  bucket: string,
  endpoint = `https://${creds.accountId}.r2.cloudflarestorage.com`
): S3Client {
  return new S3Client({
    accessKeyId: creds.accessKeyId,
    secretAccessKey: creds.secretAccessKey,
    bucket,
    endpoint,
    region: 'auto',
  })
}

/**
 * Every object in the bucket, following continuation tokens to the end.
 *
 * A truncated listing that looks complete is the one bug that would defeat the
 * export's verification, so the loop is unbounded by design and terminates on
 * `isTruncated` rather than on a page count.
 */
export async function listObjects(client: S3Client, prefix?: string): Promise<R2Object[]> {
  const objects: R2Object[] = []
  let continuationToken: string | undefined

  do {
    const page = await client.list({ prefix, continuationToken })
    for (const { key, size } of page.contents ?? []) objects.push({ key, size: size ?? 0 })
    continuationToken = page.isTruncated ? page.nextContinuationToken : undefined
    if (page.isTruncated && !continuationToken) {
      throw new Error('R2 reported a truncated listing with no continuation token')
    }
  } while (continuationToken)

  return objects
}
