/**
 * UnsavedWorkBanner — the account gate, at the moment it means something.
 *
 * ADR-034 decision 1: an anonymous visitor may build, and what they build is
 * in-memory only. This is what says so, and it is the only place the app asks
 * for an account.
 *
 * ## Why it appears when there is work, not on arrival
 *
 * The ADR is explicit that the ask "arrives when the user has something worth
 * keeping and can see what keeping it means, rather than in front of a product
 * they have not tried". A visitor with an empty roster is told nothing at all;
 * the banner appears the moment they have built something, and names the count
 * so what is at stake is legible rather than abstract.
 *
 * ## Why it offers a download beside the sign-in
 *
 * Sign-in is Discord and nothing else, so this banner is a hard wall for anybody
 * without a Discord account. Export is what keeps that from being a data-loss
 * event, which means it belongs *here* — in the gate — and not on a settings
 * screen a blocked user has no reason to visit. ADR-034 calls the export
 * load-bearing for exactly this reason.
 *
 * ## Why it is not dismissible
 *
 * It is stating a fact about the session — this work will not survive the tab —
 * and a dismissed banner would leave a visitor believing their build was saved
 * because nothing on screen said otherwise. It goes away when the work is saved
 * or when there is no work, which are the two states in which it is untrue.
 */

import { Button, Text } from 'component-lib'
import { useMutation } from 'convex/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import {
  captureAnonymousWork,
  countAnonymousWork,
  promoteAnonymousWork,
} from '../../lib/account/promoteAnonymousWork'
import { setPromotionState } from '../../lib/account/promotionState'
import { isConvexConfigured } from '../../lib/connection/convexClient'
import { isServerRefusal, serverMessage } from '../../lib/connection/serverError'
import { captureException } from '../../lib/observability'
import { selectBackend } from '../../stores/entityBackend'
import { useEntityStore } from '../../stores/entityStore'
import { usePatternStore } from '../../stores/patternStore'
import { ExportAllButton } from '../export/ExportAllButton'
import { SignInControl } from './SignInControl'

/** "3 builds" / "1 build". Plain, because it is being read in a warning. */
function buildPhrase(n: number): string {
  return `${n} ${n === 1 ? 'build' : 'builds'}`
}

export function UnsavedWorkBanner() {
  // Subscribed rather than captured: the banner has to appear the moment the
  // first build lands and disappear the moment the work is promoted, and both
  // of those are store changes.
  const pilots = useEntityStore((s) => s.list('pilot'))
  const mechs = useEntityStore((s) => s.list('mech'))
  const crawlers = useEntityStore((s) => s.list('crawler'))
  const patterns = usePatternStore((s) => s.mechPatterns)

  const count = pilots.length + mechs.length + crawlers.length + patterns.length
  const anonymous = selectBackend() === 'memory'

  if (!anonymous || count === 0) return null

  return (
    <div className="border-b-2 border-ink bg-paper px-4 py-3">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
        <Text>
          <strong>{buildPhrase(count)} not saved.</strong> Everything here lives in this tab only —
          closing it loses the lot.
        </Text>
        <div className="flex flex-wrap items-center gap-2">
          {/* Both ways out, side by side. Neither is the "cancel". */}
          <ExportAllButton />
          {isConvexConfigured && <SignInControl />}
        </div>
      </div>
    </div>
  )
}

/**
 * Promotes anonymous work once a sign-in resolves.
 *
 * Separate from the banner because it must keep running after the banner has
 * stopped rendering: the sign-in flips the backend to `remote`, at which point
 * `selectBackend() === 'memory'` is false and the banner unmounts — so a
 * promotion living inside it would be torn down at exactly the moment it was
 * needed. Mount this once, high, and let it watch.
 *
 * ## It only promotes work THIS session built anonymously
 *
 * The distinction is not cosmetic, it is the consent rule. A signed-in user
 * whose IndexedDB holds an old roster must be *offered* the upload
 * (`ClaimLocalData`), because publishing somebody's builds is a decision made
 * with their data and signing in to view a friend's game is not consent to it.
 * Work built anonymously in this tab is different: the user reached this path by
 * pressing a control that said "sign in to save this".
 *
 * A naive "signed in and there is work → promote" test cannot tell those apart
 * and would silently upload the first case. The ref is what draws the line — it
 * is set only while the session is genuinely anonymous with work in hand, so a
 * page loaded already signed in never arms it.
 */
export function AnonymousWorkPromoter() {
  // Split so the Convex hook below is never reached without a provider — see
  // `AnonymousWorkPromoter` for why that is not optional.
  if (!isConvexConfigured) return null
  return <ConnectedPromoter />
}

/**
 * The half that talks to Convex.
 *
 * **Never call a Convex hook unconditionally.** A build with no
 * `VITE_CONVEX_URL` — CI, a fresh checkout, a deliberately backend-free deploy —
 * mounts no Convex context at all, and `useMutation` throws on the spot. Mounted
 * at the root as this is, that throw takes the entire app down: the first-run
 * welcome never renders and every route is blank. The e2e smoke test caught
 * exactly that, which is what it is for.
 *
 * The gate has to be a separate component rather than an early return in the
 * one below, because hooks cannot sit behind a condition.
 */
function ConnectedPromoter() {
  const claimLocal = useMutation(api.entities.claimLocal)
  const [error, setError] = useState<string | null>(null)

  /** Armed only by an anonymous session that had work. See the header. */
  const armed = useRef(false)
  /** Stops a re-render mid-promotion starting a second one. */
  const running = useRef(false)
  const backend = selectBackend()
  const pilots = useEntityStore((s) => s.list('pilot'))
  const mechs = useEntityStore((s) => s.list('mech'))
  const crawlers = useEntityStore((s) => s.list('crawler'))
  // Patterns count. The banner and `countAnonymousWork` both include them, so
  // omitting them here meant a visitor who had saved only patterns was told
  // "1 build not saved", signed in, and had the promoter never arm.
  // `s.mechPatterns`, not `s.list()`: a selector returning a fresh array on
  // every read re-renders forever. Same access the banner above uses.
  const promoterPatterns = usePatternStore((s) => s.mechPatterns)
  const hasWork = pilots.length + mechs.length + crawlers.length + promoterPatterns.length > 0

  /**
   * The promotion itself, extracted so the retry control can invoke it.
   *
   * It used to live inline in the effect below, and there was then no retry at
   * all: `armed` stays true after a failure so that "a later attempt can pick
   * it up", but the effect's deps — `backend`, `hasWork`, `claimLocal` — are
   * all stable by that point, so it never re-ran and no later attempt existed.
   * The error text said "Try again" while offering nothing that could.
   */
  const runPromotion = useCallback(() => {
    if (running.current) return

    running.current = true
    const work = captureAnonymousWork()
    if (countAnonymousWork(work) === 0) {
      armed.current = false
      running.current = false
      setPromotionState('idle')
      return
    }

    // Announce BEFORE the await. `ShelfSync` prunes local rows the server did
    // not return, and until this promotion lands these rows are exactly that —
    // present locally, absent from `listMine`. Publishing the state only on
    // failure would leave the in-flight window unguarded.
    setPromotionState('pending')

    void promoteAnonymousWork(claimLocal, work)
      .then((result) => {
        armed.current = false

        // A resolved promise does NOT mean everything reached the server.
        // `claimLocal` reports per-row failure in its RETURN VALUE, not by
        // throwing: a body that fails Zod is counted as `skipped`, and an
        // `appId` already present in any account is counted as `alreadyPresent`
        // (which a shared/imported build really can be, since import keeps ids).
        // Both leave the row present locally and absent from the server —
        // exactly the state `rowMayBePruned` reads as "deleted elsewhere".
        //
        // Keying the guard on the rejection alone therefore left the original
        // bug intact for the partial case: no error, state `idle`, and
        // `ShelfSync` then forgets the rows that did not make it.
        const stranded = result.skipped + result.alreadyPresent
        if (stranded > 0) {
          setPromotionState('failed')
          setError(
            `${stranded} ${stranded === 1 ? 'build' : 'builds'} could not be saved to your ` +
              `account. Your work is still here — export it before clearing this browser.`
          )
          return
        }

        setError(null)
        setPromotionState('idle')
      })
      .catch((err: unknown) => {
        // The caches still hold the work, and `ShelfSync` must be told so it
        // does not read that as "deleted elsewhere" and forget it. Before this
        // signal existed the comment here said "nothing is lost when this
        // fails" — which was true of this function and false of the app, since
        // the prune then deleted precisely the rows it was reporting on.
        setPromotionState('failed')
        if (isServerRefusal(err)) setError(serverMessage(err))
        else {
          captureException(err)
          setError('That could not be saved to your account.')
        }
      })
      .finally(() => {
        running.current = false
      })
  }, [claimLocal])

  useEffect(() => {
    if (backend === 'memory' && hasWork) {
      armed.current = true
      return
    }

    // `remote` rather than "not memory" so a Disconnected reader, who cannot
    // write at all, never starts a promotion that would fail halfway through.
    if (backend !== 'remote' || !armed.current) return

    runPromotion()
  }, [backend, hasWork, runPromotion])

  if (error === null) return null
  return (
    <div className="flex items-center justify-between gap-3 border-b-2 border-ink bg-paper px-4 py-3">
      <Text variant="hint" className="text-left text-[var(--color-roll-cascade)]">
        {error}
      </Text>
      <Button
        variant="default"
        size="compact"
        // `backend === 'remote'` here for the same reason the effect checks it:
        // a Disconnected reader cannot write, and starting a promotion there
        // pins `running.current` against a mutation that may never settle —
        // which leaves `promotionState` at `pending` and pruning disabled for
        // the rest of the session. The effect had this guard; the button did
        // not, and the button is the one a frustrated user presses repeatedly.
        disabled={backend !== 'remote'}
        onClick={() => {
          if (backend !== 'remote') return
          setError(null)
          runPromotion()
        }}
      >
        Try again
      </Button>
    </div>
  )
}
