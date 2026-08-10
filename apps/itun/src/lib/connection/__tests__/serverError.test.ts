import { describe, expect, test } from 'bun:test'
import { ConvexError } from 'convex/values'
import { convexFunctionName, isServerRefusal, serverMessage } from '../serverError'

/**
 * Telling a refusal apart from a defect on the client.
 *
 * The distinction is not cosmetic. Convex sends a `ConvexError`'s data across
 * intact and redacts everything else to `"[CONVEX M(fn)] […] Server Error"`, so
 * "did the backend choose to say this?" is the only honest basis for deciding
 * whether a string is fit to show a player. Getting it wrong in the permissive
 * direction is how an opaque internal error ends up rendered in the UI.
 */
describe('serverMessage', () => {
  test('returns the message the backend deliberately sent', () => {
    // What `NotAuthorized` becomes by the time it reaches the browser: the
    // subclass does not survive serialization, only the data does.
    const refusal = new ConvexError(
      'This game has no Union Crawler yet — the Mediator raises one before the crew joins it'
    )

    expect(serverMessage(refusal)).toBe(
      'This game has no Union Crawler yet — the Mediator raises one before the crew joins it'
    )
    expect(isServerRefusal(refusal)).toBe(true)
  })

  test('returns null for a redacted server error, so nothing leaks to the UI', () => {
    // The real shape of a defect: the cause is stripped before it leaves the
    // deployment, so this string is all the client ever gets. Showing it to a
    // player is strictly worse than saying nothing.
    const defect = new Error('[CONVEX M(entities:upsertByAppId)] [Request ID: abc] Server Error')

    expect(serverMessage(defect)).toBeNull()
    expect(isServerRefusal(defect)).toBe(false)
  })

  test('non-Error values are not refusals', () => {
    expect(serverMessage('a bare string')).toBeNull()
    expect(serverMessage(null)).toBeNull()
    expect(serverMessage(undefined)).toBeNull()
  })

  test('a non-string or empty payload counts as no message', () => {
    // `ConvexError.data` is any Convex value. A structured payload would
    // stringify to something no player should read, and an empty string is not
    // a message at all — both take the "there is nothing to show" path rather
    // than rendering as a blank or a JSON blob.
    expect(serverMessage(new ConvexError({ code: 'nope' }))).toBeNull()
    expect(serverMessage(new ConvexError(''))).toBeNull()
  })
})

describe('convexFunctionName', () => {
  test('extracts the function from a redacted defect', () => {
    // The one durable fact a redacted error still carries. Everything else in
    // the string is either constant or a per-request id.
    const defect = new Error(
      '[CONVEX M(entities:upsertByAppId)] [Request ID: 1b66d281943b5176] Server Error'
    )

    expect(convexFunctionName(defect)).toBe('entities:upsertByAppId')
  })

  test('handles queries and actions, not just mutations', () => {
    expect(convexFunctionName(new Error('[CONVEX Q(games:members)] Server Error'))).toBe(
      'games:members'
    )
    expect(convexFunctionName(new Error('[CONVEX A(auth:signIn)] Server Error'))).toBe(
      'auth:signIn'
    )
  })

  test('returns null for anything without the prefix', () => {
    expect(convexFunctionName(new Error('TypeError: x is not a function'))).toBeNull()
    expect(convexFunctionName(new ConvexError('Only the Mediator can do that'))).toBeNull()
    expect(convexFunctionName(null)).toBeNull()
    expect(convexFunctionName(undefined)).toBeNull()
  })

  test('is a diagnostic label, not a refusal classifier', () => {
    // Guards the one way this helper could be misused. A refusal and a defect
    // are told apart by `instanceof ConvexError` — never by this string, which
    // is why a ConvexError carrying the prefix must still read as a refusal.
    const refusalWithPrefix = new ConvexError('[CONVEX M(games:create)] Only the organizer can')

    expect(isServerRefusal(refusalWithPrefix)).toBe(true)
    expect(convexFunctionName(refusalWithPrefix)).toBe('games:create')
  })
})
