/**
 * A Reference pattern page's Build With This builds (r6 E6). Its link carries
 * `build=now`: signed in, the Mech is made as the book prints the pattern and
 * its sheet opens, one press in all, the notice carrying Undo. The address
 * loses `build=now` before anything is written, so Back or a reload never
 * builds a second one. Signed out, the route shows the build as it would
 * (the guided wizard opens at its review, the pattern chosen), and sign-in
 * keeps the pick.
 */
import { useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { toast } from '../../../components/index'
import { failureMessage } from '../../../lib/connection/useServerAction'
import {
  bookPattern,
  isStartingBookPattern,
  mechFromBookPattern,
} from '../../../lib/patterns/bookPatterns'
import { mechCopy } from '../../../messages/build-mech'
import { subscribeSync, syncStatus } from '../../../replica/sync'
import { useSync } from '../../../replica/syncContext'
import { useUnits } from '../../../replica/units'
import { builtToast, mechNamesTaken } from './buildConfirm.model'

/** Once the replica's writers hear `live`. */
function whenLive(): Promise<void> {
  if (syncStatus() === 'live') return Promise.resolve()
  return new Promise((resolve) => {
    const stop = subscribeSync(() => {
      if (syncStatus() !== 'live') return
      stop()
      resolve()
    })
  })
}

/** The address without its `build=now`, as the page's own history entry. */
function forgetBuildNow(): void {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  url.searchParams.delete('build')
  window.history.replaceState(window.history.state, '', url)
}

/**
 * Whether this route is building the linked pattern now: true while a
 * signed-in build is on its way, so the route shows no wizard meanwhile.
 */
export function useBuildNow(search: {
  build?: 'now'
  chassis?: string | undefined
  pattern?: string | undefined
}): boolean {
  const { status } = useSync()
  // Only once the account answers: a write while signing in is refused.
  const live = status === 'live'
  const navigate = useNavigate()
  const started = useRef(false)
  // A refused build shows the route as it is, to build from by hand.
  const [failed, setFailed] = useState(false)
  const linked = search.build === 'now' ? bookPattern(search.chassis, search.pattern) : undefined
  const signedIn = status !== 'signedOut'
  useEffect(() => {
    if (linked === undefined || !live || started.current) return
    started.current = true
    forgetBuildNow()
    const { chassis, pattern } = linked
    // The replica hears `live` from the provider's own effect, which runs after
    // this one: wait for it, so the write is not refused as still signing in.
    whenLive()
      .then(() =>
        useUnits.getState().create('mech', mechFromBookPattern(chassis, pattern, mechNamesTaken()))
      )
      .then(
        (mech) => {
          builtToast(mech, !isStartingBookPattern(chassis, pattern))
          void navigate({ to: '/mechs/$id', params: { id: mech.id }, replace: true })
        },
        (err: unknown) => {
          toast.error(failureMessage(err, mechCopy('theMechCouldNotBe2')))
          setFailed(true)
        }
      )
  }, [linked, live, navigate])
  return linked !== undefined && signedIn && !failed && (live || status === 'syncing')
}
