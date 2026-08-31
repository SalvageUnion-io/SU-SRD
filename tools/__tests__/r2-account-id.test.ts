import { describe, expect, test } from 'bun:test'
import { accountIdFrom } from '../lib/r2.ts'

/**
 * `R2_ACCOUNT_ID` accepts the endpoint, not just the bare id.
 *
 * Creating an R2 API token shows an Access Key ID, a Secret Access Key and an
 * endpoint like `https://<account id>.r2.cloudflarestorage.com`. The bare
 * account id is nowhere on that screen as a copyable value, so requiring one
 * meant an operator had to know the first hostname label IS the account id and
 * retype it — friction this tool invented and then charged for every run.
 *
 * Found the only way things like this are found: by running the tool for real
 * against a credential someone had actually stored, which held the endpoint
 * because that is what Cloudflare hands you.
 */
describe('accountIdFrom', () => {
  const ACCOUNT = 'f5f08e7e86ab8c183e381d4504abcdef'

  test('takes the account id out of a full endpoint URL', () => {
    expect(accountIdFrom(`https://${ACCOUNT}.r2.cloudflarestorage.com`)).toBe(ACCOUNT)
  })

  test('tolerates a trailing slash', () => {
    expect(accountIdFrom(`https://${ACCOUNT}.r2.cloudflarestorage.com/`)).toBe(ACCOUNT)
  })

  test('tolerates a bucket path appended', () => {
    expect(accountIdFrom(`https://${ACCOUNT}.r2.cloudflarestorage.com/su-lp-assets`)).toBe(ACCOUNT)
  })

  test('tolerates a missing scheme', () => {
    expect(accountIdFrom(`${ACCOUNT}.r2.cloudflarestorage.com`)).toBe(ACCOUNT)
  })

  test('passes a bare account id through unchanged', () => {
    // The documented form still works; this is a widening, not a replacement.
    expect(accountIdFrom(ACCOUNT)).toBe(ACCOUNT)
  })

  test('does not mangle an unrecognised value', () => {
    // Anything that is not an R2 endpoint is returned as-is, so a typo fails
    // later with a signing error naming the host it tried — which is a better
    // diagnostic than this function silently inventing an account id from it.
    expect(accountIdFrom('not-an-endpoint.example.com')).toBe('not-an-endpoint.example.com')
    expect(accountIdFrom('')).toBe('')
  })
})
