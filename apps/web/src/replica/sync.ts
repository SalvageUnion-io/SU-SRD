/**
 * The sync status: one word for where this tab stands with the server, shown
 * once, in the bar (`SyncBadge`), and read by every surface that offers a
 * write. It replaces the four connection modes.
 *
 *  - `signedOut`: nobody is signed in. Reference only; building needs an
 *    account (ADR-034, as amended), so nothing is held and nothing is written.
 *  - `syncing`: signed in (or still finding out) and the server's first answer
 *    is not in yet. Writes wait: we do not yet know whose rows these are.
 *  - `live`: the feed is answering. Writes go up.
 *  - `offline`: signed in with no network. The replica shows what the device
 *    kept; a player's own units take edits that the outbox sends on reconnect
 *    (the outbox), Game-wide acts wait for the network.
 *
 * Apart from the status, a tab below the backend's build floor is `outdated`
 * (`lib/connection/buildFloor.ts`): it stays live, writes nothing, and
 * reloads onto the new build.
 *
 * Pure: `SyncProvider` feeds it the inputs and publishes the answer.
 */

export const SYNC_STATUSES = ['signedOut', 'syncing', 'live', 'offline'] as const
export type SyncStatus = (typeof SYNC_STATUSES)[number]

export type SyncInputs = {
  /** The auth layer has finished deciding whether there is a session. */
  authSettled: boolean
  signedIn: boolean
  /** `navigator.onLine`. */
  online: boolean
  /** A session token is on the device: an offline boot that was signed in. */
  storedSession: boolean
}

export function syncStatusOf(inputs: SyncInputs): SyncStatus {
  if (!inputs.online) {
    if (inputs.authSettled ? inputs.signedIn : inputs.storedSession) return 'offline'
    return inputs.authSettled ? 'signedOut' : 'syncing'
  }
  if (!inputs.authSettled) return 'syncing'
  if (!inputs.signedIn) return 'signedOut'
  return 'live'
}

/** A session is on this tab: its rows are held and its screens run. */
export function isSignedIn(status: SyncStatus): boolean {
  return status === 'live' || status === 'offline'
}

// ── The status, as module state the replica's writers read ───────────────

let current: SyncStatus = 'signedOut'
let outdated = false
const listeners = new Set<() => void>()

/** `SyncProvider`'s one write: the status, and whether this build is outdated. */
export function setSyncStatus(next: SyncStatus, nextOutdated = false): void {
  if (next === current && nextOutdated === outdated) return
  current = next
  outdated = nextOutdated
  for (const listener of [...listeners]) listener()
}

/** The status as last published. */
export function syncStatus(): SyncStatus {
  return current
}

/** Hear the status change. Returns the unsubscribe. */
export function subscribeSync(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** A unit test's reset. */
export function resetSync(next: SyncStatus = 'signedOut'): void {
  current = next
  outdated = false
}

// ── Refusing a write ─────────────────────────────────────────────────────

/**
 * Why a write was refused: four different things to say to a player. One
 * they wait out, one resolves itself in a moment, one needs them to sign in,
 * and one is this tab running a build the backend has moved past.
 */
export type BlockedWriteReason = 'offline' | 'settling' | 'signedOut' | 'outdated'

const BLOCKED_WRITE_COPY: Record<BlockedWriteReason, string> = {
  settling: 'Still signing in — that change was not saved. Try again in a moment.',
  // The act, not the condition: the bar's sync status says why.
  offline: 'That change was not saved: your Games are read-only for now.',
  signedOut: 'Sign in to build and edit — nothing is saved without an account.',
  outdated: 'The app has been updated — that change was not saved. Reloading onto the new version.',
}

const REASON_OF: Record<Exclude<SyncStatus, 'live'>, BlockedWriteReason> = {
  signedOut: 'signedOut',
  syncing: 'settling',
  offline: 'offline',
}

/**
 * Thrown when a write is attempted with no way to send it. The message is
 * user-facing copy: it is what the refusal toast shows. Call sites narrow on
 * the class with `instanceof`.
 */
export class WritesBlockedOffline extends Error {
  readonly reason: BlockedWriteReason

  constructor(reason: BlockedWriteReason = 'offline') {
    super(BLOCKED_WRITE_COPY[reason])
    this.name = 'WritesBlockedOffline'
    this.reason = reason
  }
}

/**
 * Thrown when the server refused an op because a field it changes moved after
 * the copy it was made against (ADR-063). By then the replica holds the
 * server's row, so the sheet shows the latest version; the message asks the
 * player to make the change again on top of it (`lib/runWrite.ts`).
 */
export class StaleWriteRefused extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'StaleWriteRefused'
  }
}

/** Throw unless a write can go up now (`live`); the reason says why not. */
export function requireWritable(): void {
  if (current !== 'live') throw new WritesBlockedOffline(REASON_OF[current])
  if (outdated) throw new WritesBlockedOffline('outdated')
}

/** Whether a write goes up now. */
export function writable(): boolean {
  return current === 'live' && !outdated
}
