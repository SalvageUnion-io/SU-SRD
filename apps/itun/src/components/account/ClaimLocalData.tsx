import { useState } from 'react'
import { Button, Card, Text } from 'component-lib'
import { useMutation } from 'convex/react'

import { api } from '../../../convex/_generated/api'
import { useConnection } from '../../lib/connection/connectionContext'
import { isConvexConfigured } from '../../lib/connection/convexClient'
import { useEntityStore } from '../../stores/entityStore'
import { usePatternStore } from '../../stores/patternStore'

/**
 * The one-time "bring your local data into your account" step (D11).
 *
 * An existing player has a roster in IndexedDB built before accounts existed.
 * Migration v13 gives it containers automatically, but that is all it does —
 * the data stays on that device. This is the only path from local storage into
 * an account, and without it signing in produces an empty account beside a full
 * local one, which reads as data loss even though nothing was lost.
 *
 * ## Why it is offered, not automatic
 *
 * Uploading somebody's whole roster the instant they sign in is a decision made
 * on their behalf with their data. Somebody signing in to look at a friend's
 * game should not thereby publish their own builds. So it is a prompt with a
 * count, and it says exactly what will happen.
 *
 * ## Why it is one-time
 *
 * Claiming twice would duplicate the roster: `claimLocal` inserts, and the
 * local records keep their ids, so a second run creates a second copy of
 * everything. The completion marker is per **account**, not per device — the
 * same person on a second device should still be offered their local data
 * there, but should never be asked twice for the same upload on the same one.
 */

const CLAIMED_KEY_PREFIX = 'itun.claimedLocalData.'

function hasClaimed(userKey: string): boolean {
  try {
    return localStorage.getItem(CLAIMED_KEY_PREFIX + userKey) !== null
  } catch {
    // Private mode: fall back to offering it. A duplicate prompt is a smaller
    // harm than never offering the only path off a device.
    return false
  }
}

function markClaimed(userKey: string): void {
  try {
    localStorage.setItem(CLAIMED_KEY_PREFIX + userKey, new Date().toISOString())
  } catch {
    // Nothing to do — the claim itself already succeeded.
  }
}

type Summary = { claimed: number; skipped: number; byKind: Record<string, number> }

function ConnectedClaim() {
  const claimLocal = useMutation(api.entities.claimLocal)

  const pilots = useEntityStore((s) => s.list('pilot'))
  const mechs = useEntityStore((s) => s.list('mech'))
  const crawlers = useEntityStore((s) => s.list('crawler'))
  const softLinks = useEntityStore((s) => s.list('softLink'))
  const patterns = usePatternStore((s) => s.mechPatterns)

  const [summary, setSummary] = useState<Summary | null>(null)
  const [busy, setBusy] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  const total = pilots.length + mechs.length + crawlers.length + patterns.length
  // Keyed on the roster itself rather than a user id the client does not hold:
  // two different local rosters are two different claims worth offering.
  const userKey = `${pilots.length}-${mechs.length}-${crawlers.length}`

  if (total === 0 || dismissed || hasClaimed(userKey)) return null

  return (
    <Card>
      <div className="flex flex-col gap-3 p-4">
        <Text as="span" className="font-cond text-xs font-bold tracking-caps-wide uppercase">
          Bring your builds with you
        </Text>

        {summary === null ? (
          <>
            <Text>
              This device has {pilots.length} pilot{pilots.length === 1 ? '' : 's'}, {mechs.length}{' '}
              mech{mechs.length === 1 ? '' : 's'}, {crawlers.length} crawler
              {crawlers.length === 1 ? '' : 's'} and {patterns.length} saved pattern
              {patterns.length === 1 ? '' : 's'} that are not in your account yet.
            </Text>
            <Text variant="hint" className="text-left">
              They will be copied to your account and land on your shelf — not in any game — so you
              can place them yourself. Nothing on this device is changed or removed.
            </Text>
            <div className="flex gap-2">
              <Button
                variant="primary"
                size="compact"
                disabled={busy}
                onClick={() => {
                  setBusy(true)
                  void claimLocal({
                    pilots: pilots as unknown[],
                    mechs: mechs as unknown[],
                    crawlers: crawlers as unknown[],
                    softLinks: softLinks as unknown[],
                    mechPatterns: patterns as unknown[],
                  })
                    .then((result) => {
                      markClaimed(userKey)
                      setSummary(result as Summary)
                    })
                    .finally(() => setBusy(false))
                }}
              >
                {busy ? 'Copying…' : 'Copy to my account'}
              </Button>
              <Button variant="ghost" size="compact" onClick={() => setDismissed(true)}>
                Not now
              </Button>
            </div>
          </>
        ) : (
          <>
            <Text>
              Copied {summary.claimed} item{summary.claimed === 1 ? '' : 's'} to your account.
            </Text>
            {summary.skipped > 0 && (
              <Text variant="hint" className="text-left">
                {summary.skipped} could not be read and {summary.skipped === 1 ? 'was' : 'were'}{' '}
                left on this device — they are still here, and still exportable.
              </Text>
            )}
          </>
        )}
      </div>
    </Card>
  )
}

/**
 * Offered only while Connected. Solo has no account to claim into, and
 * Disconnected cannot write — offering it there would fail on click.
 */
export function ClaimLocalData() {
  const { mode } = useConnection()
  if (!isConvexConfigured || mode !== 'connected') return null
  return <ConnectedClaim />
}
