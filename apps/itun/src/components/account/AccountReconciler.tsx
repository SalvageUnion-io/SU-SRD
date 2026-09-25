/**
 * AccountReconciler — the one surface that moves local work into the account.
 *
 * ## What this replaced
 *
 * Four root-mounted pieces, each reconciling on its own: `UnsavedWorkBanner`
 * (anonymous work in this tab), `AnonymousWorkPromoter` (uploading it on
 * sign-in), `LegacyLocalData` (a pre-account roster in IndexedDB: a second
 * banner signed out, a second upload and a second error line signed in), and
 * `ShelfSync` (the download direction, which had to be told about the other
 * three through module-scope flags). A visitor holding both kinds of work saw
 * two banners with two download buttons, and a failed upload was retryable or
 * not depending on which path it went through. The rule now lives once in
 * `lib/account/reconcile.ts`, and this is its only UI.
 *
 * ## Signed out: say what is at stake, and offer both doors
 *
 * The account gate (ADR-034 decision 1), at the moment it means something: a
 * visitor with nothing built is told nothing; once there is work, one banner
 * names what would be lost — this tab's builds, and any rows this device still
 * holds — with one "Download all" covering both and the
 * sign-in beside it. Sign-in is Discord and nothing else, so the download is
 * what keeps this from being a hard wall for somebody without Discord.
 *
 * It is not dismissible. It states a fact about the session, and a dismissed
 * banner would leave somebody believing their build was saved because nothing
 * on screen said otherwise.
 *
 * ## Signed in: reconcile, once, and say so only if it did not land
 *
 * Session work is sent the moment the backend flips to `remote`. Device rows
 * are compared against `entities.listMine` first and only what is missing is
 * sent (ADR-035 — no offer, no decline). Both report through one error line
 * with one "Try again", which retries whatever did not land: session work is
 * filtered against `listMine` on a retry too, because `claimLocal` reports a
 * row the first pass already saved as `alreadyPresent`.
 *
 * The in-flight flags and the error line live in the always-mounted parent,
 * not in the signed-in half. That half unmounts whenever the backend leaves
 * `remote` (connectivity dropping mid-upload), and a flag owned by the mount
 * would let the next mount send the same rows while the first call is still
 * queued — the second to land then reports every row as `alreadyPresent`.
 *
 * ## The consent line
 *
 * Only work captured WHILE ANONYMOUS IN THIS TAB is uploaded as session work.
 * A page loaded already signed in never captures anything, so signing in to
 * look at a friend's Game cannot publish builds nobody asked to save. The
 * capture lives in a ref on this always-mounted component because the
 * signed-in half mounts only after the flip — a capture living there would be
 * torn down at exactly the moment it is needed.
 */

import { Button, Text, toast } from 'component-lib'
import { useMutation, useQuery } from 'convex/react'
import type { Dispatch, RefObject, SetStateAction } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import {
  buildLegacyExportBundle,
  countStranded,
  selectStranded,
} from '../../lib/account/legacyMigration'
import { setPromotionState } from '../../lib/account/promotionState'
import type { LocalWork } from '../../lib/account/reconcile'
import { combineBundles, countWork, reconcile, unsavedWork } from '../../lib/account/reconcile'
import { useConnection } from '../../lib/connection/connectionContext'
import { isConvexConfigured } from '../../lib/connection/convexClient'
import { isServerRefusal, serverMessage } from '../../lib/connection/serverError'
import type { LegacyLocalData as DeviceRows } from '../../lib/db/legacyLocalData'
import {
  markLegacyLocalDataMigrated,
  probeLegacyLocalData,
  readLegacyLocalData,
} from '../../lib/db/legacyLocalData'
import { buildExportBundle } from '../../lib/export/buildExportBundle'
import { downloadJson } from '../../lib/export/downloadJson'
import { captureException } from '../../lib/observability'
import { useEncounterStore } from '../../stores/encounterStore'
import { backendForMode } from '../../stores/entityBackend'
import { useEntityStore } from '../../stores/entityStore'
import { usePatternStore } from '../../stores/patternStore'
import { ShelfSync } from './ShelfSync'
import { SignInControl } from './SignInControl'

/** "3 builds" / "1 build". Plain, because it is being read in a warning. */
function builds(n: number): string {
  return `${n} ${n === 1 ? 'build' : 'builds'}`
}

/** The rows this browser still holds in IndexedDB, or null when it holds none. */
function useDeviceRows(): DeviceRows | null {
  const [rows, setRows] = useState<DeviceRows | null>(null)

  useEffect(() => {
    let cancelled = false
    // Probed rather than read from `legacyLocalDataState()`: the probe resolves
    // after mount and the connection context does not re-render on it, so a
    // one-shot read would decide "nothing here" before the answer existed. The
    // probe caches, so awaiting it again costs nothing.
    void probeLegacyLocalData()
      .then(async (state) => {
        if (state !== 'present' || cancelled) return
        const local = await readLegacyLocalData()
        if (!cancelled) setRows(local)
      })
      .catch((err: unknown) => {
        // A browser that will not read is not holding a roster this app can
        // migrate. Report it and render nothing rather than blocking.
        captureException(err)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return rows
}

/**
 * This tab's work, subscribed so the banner appears with the first build and
 * the capture is current at the instant of sign-in. `s.mechPatterns`, not
 * `s.list()`: a selector returning a fresh array every read re-renders forever.
 */
function useSessionWork(): LocalWork {
  const pilots = useEntityStore((s) => s.list('pilot'))
  const mechs = useEntityStore((s) => s.list('mech'))
  const crawlers = useEntityStore((s) => s.list('crawler'))
  const softLinks = useEntityStore((s) => s.list('softLink'))
  const mechPatterns = usePatternStore((s) => s.mechPatterns)
  const encounterNpcs = useEncounterStore((s) => s.encounterNpcs)
  return useMemo(
    () => ({ pilots, mechs, crawlers, softLinks, mechPatterns, encounterNpcs }),
    [pilots, mechs, crawlers, softLinks, mechPatterns, encounterNpcs]
  )
}

/** The sign-in / download sentence, naming only what is on screen. */
function closingLine(session: number, onDevice: number): string {
  const download = session + onDevice === 1 ? 'it' : 'them all'
  if (onDevice === 0) {
    return `Sign in to keep ${session === 1 ? 'it' : 'them'} in your account — or download ${download}.`
  }
  const save = session > 0 ? 'save this tab’s work and ' : ''
  return `Sign in to ${save}bring anything missing into your account — or download ${download}.`
}

/** The signed-out banner. One statement, one download, one sign-in. */
function AnonymousNotice({ session, device }: { session: number; device: DeviceRows | null }) {
  const [busy, setBusy] = useState(false)
  const onDevice = device === null ? 0 : countWork(device)

  async function downloadAll() {
    setBusy(true)
    try {
      const sessionBundle = session > 0 ? await buildExportBundle(useEntityStore.getState()) : null
      const deviceBundle = device === null ? null : buildLegacyExportBundle(device)
      const bundle = combineBundles(sessionBundle, deviceBundle)
      if (bundle === null) return
      const date = new Date().toISOString().slice(0, 10)
      downloadJson(`itun-backup-${date}.json`, bundle)
      toast.success('Backup downloaded.')
    } catch (err) {
      captureException(err)
      toast.error('That could not be downloaded.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="border-b-2 border-ink bg-paper px-4 py-3" role="status">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
        <Text>
          {session > 0 && (
            <>
              <strong>{builds(session)} not saved.</strong> Everything built here lives in this tab
              only — closing it loses the lot.{' '}
            </>
          )}
          {/* Describes the DEVICE, and says no more than it can know. Signed
              out there is no `listMine` to compare against, and the probe
              reports `present` for any non-empty store — a returning player's
              own account cache included — so this names neither provenance
              ("from before accounts") nor a count missing from an account. */}
          {onDevice > 0 && (
            <>
              <strong>
                This device {session > 0 ? 'also ' : ''}holds {builds(onDevice)}.
              </strong>{' '}
            </>
          )}
          {closingLine(session, onDevice)}
        </Text>
        <div className="flex flex-wrap items-center gap-2">
          {/* Both ways out, side by side. Neither is the "cancel". */}
          <Button size="compact" disabled={busy} onClick={() => void downloadAll()}>
            {busy ? 'Exporting…' : 'Download all'}
          </Button>
          <SignInControl />
        </div>
      </div>
    </div>
  )
}

type Failure = { session: string | null; device: string | null }
const NO_FAILURE: Failure = { session: null, device: null }

/**
 * What must outlive a mount of the signed-in half. See the header: owned by the
 * always-mounted parent so a remount neither re-sends in-flight work nor loses
 * the error line a pass finished writing while nothing was mounted.
 */
type ReconcileState = {
  sessionWork: RefObject<LocalWork | null>
  running: RefObject<{ session: boolean; device: boolean }>
  failure: Failure
  setFailure: Dispatch<SetStateAction<Failure>>
}

const STILL_HERE = 'They are still on this device — download a copy before clearing this browser.'

/** Why a whole call failed, in words a player can act on. */
function failureMessage(err: unknown, fallback: string): string {
  if (isServerRefusal(err)) return serverMessage(err) ?? fallback
  captureException(err)
  return fallback
}

/**
 * The signed-in half. Mounted only while the backend is `remote`, so every
 * Convex hook here has a provider and every write it starts can land.
 */
function SignedInReconciler({
  state,
  device,
}: {
  state: ReconcileState
  device: DeviceRows | null
}) {
  const { sessionWork, running, failure, setFailure } = state
  const mine = useQuery(api.entities.listMine, {})
  const games = useQuery(api.games.listMine, {})
  const claimLocal = useMutation(api.entities.claimLocal)
  const repairContainers = useMutation(api.entities.repairContainers)

  /** One device pass per mount: a live query re-emits, the reconciliation must not. */
  const deviceRan = useRef(false)

  const runSession = useCallback(() => {
    if (running.current.session) return
    const captured = sessionWork.current
    // Filtered once the account has loaded — always so on a "Try again", and
    // usually not on the first pass, which must not wait on it (every id in a
    // fresh capture is new, so there is nothing to filter).
    const work = captured === null || mine === undefined ? captured : unsavedWork(captured, mine)
    if (work === null || countWork(work) === 0) {
      sessionWork.current = null
      setPromotionState('idle')
      setFailure((f) => ({ ...f, session: null }))
      return
    }

    running.current.session = true
    // Announced BEFORE the await. `ShelfSync` prunes local shelf rows the
    // server did not return, and until this lands these rows are exactly that.
    setPromotionState('pending')

    void reconcile(claimLocal, work, { adopt: true })
      .then(({ stranded }) => {
        if (stranded > 0) {
          setPromotionState('failed')
          setFailure((f) => ({
            ...f,
            session: `${builds(stranded)} could not be saved to your account. ${STILL_HERE}`,
          }))
          return
        }
        sessionWork.current = null
        setPromotionState('idle')
        setFailure((f) => ({ ...f, session: null }))
      })
      .catch((err: unknown) => {
        // The caches still hold the work, and `ShelfSync` must be told so it
        // does not read that as "deleted elsewhere" and forget it.
        setPromotionState('failed')
        setFailure((f) => ({
          ...f,
          session: failureMessage(err, 'That could not be saved to your account.'),
        }))
      })
      .finally(() => {
        running.current.session = false
      })
  }, [claimLocal, mine, running, sessionWork, setFailure])

  const runDevice = useCallback(() => {
    // Nothing on this device, or the account is still loading. `undefined` is
    // Convex's in-flight value, not an empty result — running against it would
    // read every local row as stranded and re-upload the lot.
    if (device === null || mine === undefined || games === undefined) return
    if (running.current.device) return

    const work = selectStranded(device, mine, new Set(games.map((g) => g._id)))
    if (countStranded(work) === 0 && work.softLinks.length === 0) {
      // Nothing isolated — the steady state on every load after the first, and
      // what closes the migration window (re-enabling cache pruning).
      markLegacyLocalDataMigrated()
      return
    }

    running.current.device = true
    void reconcile(claimLocal, work, { adopt: false })
      .then(({ stranded }) => {
        if (stranded > 0) {
          setFailure((f) => ({
            ...f,
            device: `${builds(stranded)} could not be moved into your account. ${STILL_HERE}`,
          }))
          return
        }
        markLegacyLocalDataMigrated()
        setFailure((f) => ({ ...f, device: null }))
      })
      .catch((err: unknown) => {
        setFailure((f) => ({
          ...f,
          device: failureMessage(
            err,
            'Your builds on this device could not be moved into your account.'
          ),
        }))
      })
      .finally(() => {
        running.current.device = false
      })
  }, [claimLocal, device, mine, games, running, setFailure])

  // Session work goes the moment the backend is `remote` — it needs no
  // comparison (every id is fresh), and a sign-in that was pressed to save
  // this should not wait on anything.
  //
  // Once per mount, through a ref rather than the dependency list: the effect
  // must not re-run because a hook handed back a new function identity, and a
  // second pass after a failure is the "Try again" button's job, not a render's
  // — which is also why a remount that finds a failure already on screen does
  // not start one.
  const sessionStarted = useRef(false)
  useEffect(() => {
    if (sessionStarted.current) return
    sessionStarted.current = true
    if (failure.session !== null) return
    runSession()
  }, [runSession, failure.session])

  useEffect(() => {
    if (deviceRan.current) return
    if (device === null || mine === undefined || games === undefined) return
    deviceRan.current = true
    if (failure.device !== null) return
    runDevice()
  }, [device, mine, games, runDevice, failure.device])

  /**
   * Repair bodies whose container disagrees with the row they are stored in.
   *
   * Deliberately NOT gated on this device holding anything: the rows it fixes
   * are already in the account and may never have been on this browser. Silent
   * either way — nothing is at risk, so Sentry is the audience, not a banner.
   */
  useEffect(() => {
    if (repairDoneThisSession()) return
    markRepairDone()
    void repairContainers({})
      .then((result) => {
        if (result.skipped > 0) {
          captureException(
            new Error(`repairContainers skipped ${result.skipped} unparseable row(s)`)
          )
        }
      })
      .catch((err: unknown) => {
        // Retry on the next load rather than remembering a failed pass as done.
        clearRepairDone()
        captureException(err, { source: 'repairContainers' })
      })
  }, [repairContainers])

  const messages = [failure.session, failure.device].filter((m): m is string => m !== null)

  return (
    <>
      <ShelfSync />
      {messages.length > 0 && (
        <div className="flex items-center justify-between gap-3 border-b-2 border-ink bg-paper px-4 py-3">
          <div className="flex flex-col gap-1">
            {messages.map((m) => (
              <Text key={m} variant="hint" className="text-left text-[var(--color-roll-cascade)]">
                {m}
              </Text>
            ))}
          </div>
          <Button
            variant="default"
            size="compact"
            onClick={() => {
              if (failure.session !== null) {
                setFailure((f) => ({ ...f, session: null }))
                runSession()
              }
              if (failure.device !== null) {
                setFailure((f) => ({ ...f, device: null }))
                runDevice()
              }
            }}
          >
            Try again
          </Button>
        </div>
      )}
    </>
  )
}

const REPAIR_KEY = 'itun.containersRepaired'

/**
 * Whether the container repair has already run in this tab.
 *
 * `sessionStorage`, not a ref: the signed-in half remounts on every backend
 * transition (the handshake settling, connectivity returning), and each pass is
 * a `.collect()` over every owned row inside a write transaction. Session-scoped
 * rather than persisted, because a new session is exactly when a row repaired on
 * another device should be re-checked here. All three accessors swallow: a
 * browser that refuses storage still gets the repair, once per mount.
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
    // Nothing to do — the repair runs regardless.
  }
}

function clearRepairDone(): void {
  try {
    sessionStorage.removeItem(REPAIR_KEY)
  } catch {
    // Nothing to do.
  }
}

/**
 * Mounted once, at the root. A fact about the browser and the session, not
 * about a route — a predecessor that lived on the Account screen went unseen.
 */
export function AccountReconciler() {
  const { mode } = useConnection()
  const backend = backendForMode(mode)
  const device = useDeviceRows()
  const session = useSessionWork()

  /** This tab's anonymous work, as of the last anonymous render. See the header. */
  const sessionWork = useRef<LocalWork | null>(null)
  const running = useRef({ session: false, device: false })
  const [failure, setFailure] = useState<Failure>(NO_FAILURE)
  useEffect(() => {
    if (backend !== 'memory') return
    sessionWork.current = countWork(session) > 0 ? session : null
  }, [backend, session])

  if (backend === 'memory') {
    const n = countWork(session)
    if (n === 0 && device === null) return null
    return <AnonymousNotice session={n} device={device} />
  }

  // `blocked` is Disconnected or mid-handshake: no writes, so no reconciling —
  // and a build with no Convex URL mounts no provider for the hooks below.
  if (backend !== 'remote' || !isConvexConfigured) return null
  return (
    <SignedInReconciler state={{ sessionWork, running, failure, setFailure }} device={device} />
  )
}
