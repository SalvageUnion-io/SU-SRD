/**
 * Which entity a retired snapshot was taken of (ADR-036).
 *
 * Snapshots are no longer minted, and the frozen copy inside an existing one is
 * no longer rendered. The only thing an old `/s/:id` link is still good for is
 * finding the entity it was taken of, so that it can redirect to that entity's
 * live public sheet (`/p/:kind/:appId`, ADR-032) when its owner has made one.
 *
 * ## What a stored snapshot carries
 *
 * Every snapshot ever published is `{ kind, entity, context? }`, where `entity`
 * is the whole client record — and a client record's `id` is the `appId` its
 * server row is addressed by. So the identity is `{ kind, appId: entity.id }`,
 * read straight off the blob. A snapshot taken before its entity reached an
 * account, or of a copy that was later re-minted on import, carries an id no
 * server row has; that link resolves to nothing public and shows the retired
 * page, which is the honest answer.
 *
 * ## Two shapes in, one out
 *
 * The Worker reads the stored blob and answers `{ kind, appId }`. The client
 * reads that answer through the same function, and it accepts the full blob as
 * well, deliberately: the endpoint used to return the whole snapshot with a
 * year-long `immutable` Cache-Control, so a browser that opened a link before
 * this change can still be handed that old body from its HTTP cache for the
 * same URL. Both shapes name the same entity; refusing one would show the
 * retired page for a link that could have resolved.
 */

import { isRecord } from '../isRecord'

/** The three kinds a public sheet can be (`convex/publicSheet.ts`). */
const KINDS = ['pilot', 'mech', 'crawler'] as const

export type SnapshotIdentity = {
  kind: (typeof KINDS)[number]
  /** The client-minted entity id, which addresses its server row and `/p/` URL. */
  appId: string
}

/**
 * Generous for a UUID, and bounded so an arbitrary blob cannot hand the client
 * an arbitrarily long string to put in a URL and a Convex argument.
 */
const MAX_APP_ID_LENGTH = 128

function isKind(value: unknown): value is SnapshotIdentity['kind'] {
  return typeof value === 'string' && (KINDS as readonly string[]).includes(value)
}

function isAppId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_APP_ID_LENGTH
}

/**
 * The identity in a stored snapshot or an identity response, or null when it
 * names no entity this app could look up. Never throws: the input is untrusted
 * in both directions.
 */
export function snapshotIdentity(value: unknown): SnapshotIdentity | null {
  if (!isRecord(value) || Array.isArray(value)) return null
  if (!isKind(value.kind)) return null

  // The identity response.
  if (isAppId(value.appId)) return { kind: value.kind, appId: value.appId }

  // The stored snapshot itself (and the endpoint's old, cacheable answer).
  const entity = value.entity
  if (isRecord(entity) && isAppId(entity.id)) return { kind: value.kind, appId: entity.id }

  return null
}
