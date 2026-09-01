/**
 * The migration off device-only storage, run automatically (ADR-035).
 *
 * ## What this replaces, and why it is not a card any more
 *
 * `ClaimLocalData` offered a signed-in player the chance to copy their local
 * roster into their account. It was deliberately an offer, on the reasoning that
 * "uploading somebody's whole roster the instant they sign in is a decision made
 * on their behalf with their data".
 *
 * That reasoning describes a world with two legitimate homes for a build. There
 * is one now: the account. Copying a shelf row into the account it already
 * belongs to is not publication — nothing is shared, `publicRead` stays off,
 * and it lands on the owner's own shelf — while *not* copying it is what leaves
 * a roster that shows up signed out and disappears signed in.
 *
 * The card also could not do the job it was for. It lived on the Account screen,
 * so a player had to go looking; it could be dismissed permanently; and it
 * counted the **entity store**, which for a signed-in player is filled from the
 * server — so once `ShelfSync` had run it read a full account, found nothing to
 * offer, and rendered nothing while the local rows sat untouched beside it.
 *
 * So: mounted at the root, comparing IndexedDB against `listMine` directly, and
 * with no decline. Export is still one press away and is still the way out for
 * somebody who does not want an account — see the signed-out half below.
 *
 * ## Two halves, because a browser is in one of two states
 *
 * Signed out, there is no account to migrate into, so the honest thing is to say
 * what is on the device and offer both doors: sign in, or download. Signed in,
 * the reconciliation just runs.
 */

import { Button, Text, toast } from 'component-lib'
import { useMutation, useQuery } from 'convex/react'
import { useEffect, useRef, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import {
  buildLegacyExportBundle,
  countStranded,
  selectStranded,
} from '../../lib/account/legacyMigration'
import { useConnection } from '../../lib/connection/connectionContext'
import { isConvexConfigured } from '../../lib/connection/convexClient'
import { isServerRefusal, serverMessage } from '../../lib/connection/serverError'
import type { LegacyLocalData as LegacyRows } from '../../lib/db/legacyLocalData'
import {
  markLegacyLocalDataMigrated,
  probeLegacyLocalData,
  readLegacyLocalData,
} from '../../lib/db/legacyLocalData'
import { downloadJson } from '../../lib/export/downloadJson'
import { captureException } from '../../lib/observability'
import { accountRequired, backendForMode } from '../../stores/entityBackend'
import { SignInControl } from './SignInControl'

const REPAIR_KEY = 'itun.containersRepaired'

/**
 * Whether the container repair has already run in this tab.
 *
 * `sessionStorage`, not a module flag: the effect below remounts whenever the
 * backend transitions (the handshake settles, connectivity returns), and a
 * per-mount ref alone would re-run a `.collect()` over every owned row inside a
 * write transaction each time. Session-scoped rather than persisted, because a
 * new session is exactly when a row repaired on another device should be
 * re-checked here.
 *
 * Both accessors swallow: a browser that refuses storage still gets the repair,
 * just once per mount instead of once per session, which is the safe direction.
 */
function repairDoneThisSession(): boolean {
  try {
    return sessionStorage.getItem(REPAIR_KEY) !== null
  } catch {
    return false
  }
}

function markRepairDone(): void {
  try {
    sessionStorage.setItem(REPAIR_KEY, new Date().toISOString())
  } catch {
    // Nothing to do — the repair itself already succeeded.
  }
}

/**
 * The rows this browser is holding, or `null` when it holds none.
 *
 * Probes rather than reading `legacyLocalDataState()` directly: the probe is
 * asynchronous and resolves after mount, and the connection context does not
 * re-render on its completion, so a component that read the cached answer once
 * would decide "nothing here" before the answer existed. `probeLegacyLocalData`
 * caches its own result, so awaiting it again costs nothing.
 */
function useLegacyRows(): LegacyRows | null {
  const [rows, setRows] = useState<LegacyRows | null>(null)

  useEffect(() => {
    let cancelled = false
    void probeLegacyLocalData()
      .then(async (state) => {
        if (state !== 'present' || cancelled) return
        const local = await readLegacyLocalData()
        if (!cancelled) setRows(local)
      })
      .catch((err: unknown) => {
        // A browser that will not read is not a browser holding a roster this
        // app can migrate. Report it and render nothing rather than blocking.
        captureException(err)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return rows
}

function countRows(rows: LegacyRows): number {
  return rows.pilots.length + rows.mechs.length + rows.crawlers.length + rows.mechPatterns.length
}

/**
 * Signed out, with a pre-account roster on the device.
 *
 * States the fact and offers both doors. It is not dismissible, for the same
 * reason `UnsavedWorkBanner` is not: it describes a condition rather than an
 * event, and a dismissed banner would leave somebody believing the app had
 * nothing of theirs on this machine.
 */
function SignedOutNotice({ rows }: { rows: LegacyRows }) {
  const [busy, setBusy] = useState(false)
  const n = countRows(rows)

  return (
    <div className="border-b-2 border-ink bg-paper px-4 py-3">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
        {/* Describes the DEVICE, and says no more than it can know. Signed out
            there is no `listMine` to compare against, so some of these may
            already be in the account — a returning player's cache, or a row
            adopted from a Game. "N builds not in your account" would be a count
            this side of the app cannot compute, and stating it would be wrong
            for exactly the people most likely to read it. */}
        <Text>
          <strong>
            This device holds {n} {n === 1 ? 'build' : 'builds'}.
          </strong>{' '}
          Sign in to bring anything missing into your account — or download{' '}
          {n === 1 ? 'it' : 'them all'} to keep {n === 1 ? 'it' : 'them'} yourself.
        </Text>
        <div className="flex flex-wrap items-center gap-2">
          {/* Both ways out, side by side. Neither is the "cancel". */}
          <Button
            size="compact"
            disabled={busy}
            onClick={() => {
              setBusy(true)
              try {
                const date = new Date().toISOString().slice(0, 10)
                downloadJson(`itun-backup-${date}.json`, buildLegacyExportBundle(rows))
                toast.success('Backup downloaded.')
              } catch (err) {
                captureException(err)
                toast.error('That could not be downloaded.')
              } finally {
                setBusy(false)
              }
            }}
          >
            {busy ? 'Exporting…' : 'Download all'}
          </Button>
          {isConvexConfigured && <SignInControl />}
        </div>
      </div>
    </div>
  )
}

/**
 * Signed in: reconcile the device against the account, once.
 *
 * Renders nothing at all on the happy path. The only thing it can draw is a
 * failure, and it says the one thing that matters when a migration does not
 * land — the work is still here, so take a copy — rather than describing the
 * mechanism.
 */
function SignedInMigration({ rows }: { rows: LegacyRows | null }) {
  const mine = useQuery(api.entities.listMine, {})
  const games = useQuery(api.games.listMine, {})
  const claimLocal = useMutation(api.entities.claimLocal)
  const repairContainers = useMutation(api.entities.repairContainers)

  /** One pass per mount. A live query re-emits; the reconciliation must not. */
  const ran = useRef(false)
  const repaired = useRef(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Repair bodies whose container disagrees with the row they are stored in.
   *
   * Deliberately **not** gated on this browser holding a legacy roster, which
   * is why it is its own effect rather than a step inside the one below. The
   * rows it fixes were already claimed, so they are in the account and may not
   * be in this IndexedDB at all — claimed on a phone, opened on a laptop. A
   * repair that only ran where the old rows happened to still sit would miss
   * exactly the device the player is looking at.
   *
   * Silent either way, including on failure. Nothing is at risk here: these
   * rows are owned and server-backed, so a failed repair leaves them exactly as
   * they were — visible signed out, hidden signed in — rather than losing
   * anything. Sentry is the right audience for that, not a banner the player
   * cannot act on.
   */
  useEffect(() => {
    if (repaired.current || repairDoneThisSession()) return
    repaired.current = true
    void repairContainers({})
      .then((result) => {
        // Marked only on success, so a failed pass retries on the next load
        // rather than being remembered as done.
        markRepairDone()
        if (result.skipped > 0) {
          // Not shown to the player — see above, nothing is at risk — but a body
          // the server accepted that this build cannot re-parse is a real schema
          // disagreement, and silently discarding the count is how it stays
          // unknown. This is the only signal that it happened.
          captureException(
            new Error(`repairContainers skipped ${result.skipped} unparseable row(s)`)
          )
        }
      })
      .catch((err: unknown) => {
        captureException(err, { source: 'repairContainers' })
      })
  }, [repairContainers])

  useEffect(() => {
    // Nothing on this device to reconcile. The repair above still ran.
    if (rows === null) return
    // `undefined` is Convex's in-flight value, not an empty result. Running
    // against it would read every local row as stranded and re-upload the lot.
    if (mine === undefined || games === undefined) return
    if (ran.current) return
    ran.current = true

    const work = selectStranded(rows, mine, new Set(games.map((g) => g._id)))
    if (countStranded(work) === 0 && work.softLinks.length === 0) {
      // Nothing isolated. This is the ordinary steady state on every load after
      // the first, and it is what finally closes the migration window — which
      // re-enables cache pruning (`db/pruneRules.ts`).
      markLegacyLocalDataMigrated()
      return
    }

    void claimLocal(work)
      .then((result) => {
        // A resolved promise does not mean every row landed: `claimLocal`
        // reports per-row failure in its RETURN VALUE. `skipped` is a body this
        // build could not parse, and `alreadyPresent` is an app id taken
        // somewhere in the database — possibly by another account, since import
        // keeps ids. Either way the row is still device-only, so the window
        // stays open and pruning stays off.
        //
        // `result.declined` is deliberately NOT counted here. Those are rows
        // belonging to a Game that exists — a crewmate's build this browser
        // cached and kept after leaving — which the server refused precisely
        // because they are not this account's to migrate. They are already safe
        // on the server, so counting them would hold the window open forever
        // over rows that were never at risk, and `mayPrune` with it.
        const left = result.skipped + result.alreadyPresent
        if (left > 0) {
          setError(
            `${left} ${left === 1 ? 'build' : 'builds'} could not be moved into your account. ` +
              'They are still on this device — download a copy before clearing this browser.'
          )
          return
        }
        markLegacyLocalDataMigrated()
      })
      .catch((err: unknown) => {
        if (isServerRefusal(err)) setError(serverMessage(err))
        else {
          captureException(err)
          setError('Your builds on this device could not be moved into your account.')
        }
      })
  }, [mine, games, rows, claimLocal])

  if (error === null) return null
  return (
    <div className="border-b-2 border-ink bg-paper px-4 py-3">
      <Text variant="hint" className="text-left text-[var(--color-roll-cascade)]">
        {error}
      </Text>
    </div>
  )
}

/**
 * Mounted once, at the root.
 *
 * The root is the only correct place: this is a fact about the *browser*, not
 * about a route, and putting it on the Account screen is precisely what let the
 * previous version go unseen.
 */
export function LegacyLocalData() {
  const { mode } = useConnection()
  const rows = useLegacyRows()

  const backend = backendForMode(mode, accountRequired)

  // `local` is a build that does not require an account at all (CI, `bun run
  // dev`, a backend-free deploy). There, IndexedDB is still the source of truth
  // by design and there is nothing to migrate off.
  if (backend === 'local') return null
  // Signed out there is no account to migrate into, so this is the whole of
  // what can be said — and nothing to say at all in a browser holding nothing.
  if (backend === 'memory') return rows === null ? null : <SignedOutNotice rows={rows} />
  // `blocked` is Disconnected or mid-handshake: no writes, so no migration.
  if (backend !== 'remote' || !isConvexConfigured) return null
  // `rows` may be null here, and the component still mounts: the container
  // repair inside it is about the ACCOUNT, not about this device. Gating the
  // whole thing on a local roster is what would leave a player's already-claimed
  // builds invisible on every device except the one that first held them.
  return <SignedInMigration rows={rows} />
}
