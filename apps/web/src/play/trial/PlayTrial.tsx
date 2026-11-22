/**
 * PlayTrial — a round of Play signed out (r6 F1): a book crew's pilot, and
 * the mech assigned to them, on the real Cockpit, held in this tab and saved
 * nowhere (ADR-034). `PlayGate` opens it for a signed-out visitor on a book
 * pilot's Play; `TRIAL_PLAY` switches it off, and the gate then asks for
 * sign-in as before.
 *
 * The tab's room (`trialRoom.model.ts`) stands in for the account room, and the
 * Cockpit's tree reads the sync status as live (`trial` set), so every pane
 * runs as it does solo: actions, rolls, Heat and the Feed. After the first
 * change the strip says once, as a line, that nothing is kept, with Sign in
 * beside it.
 */

import type { ReactNode } from 'react'
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { SignInControl } from '../../build/account/SignInControl'
import { playTrialCopy } from '../../messages/play-trial'
import type { SyncState } from '../../replica/syncContext'
import { SyncContext } from '../../replica/syncContext'
import { PlayCockpit } from '../PlayCockpit'
import { setScreenNotices } from '../tableStripSlot.model'
import type { TrialCrew } from './trialRoom.model'
import { openTrial, subscribeTrial, trialChanged, trialCrew } from './trialRoom.model'

/** The Cockpit's view of the connection during a trial: it writes, to the tab's room. */
const TRIAL_SYNC: SyncState = {
  status: 'live',
  canWrite: true,
  canEditOwn: true,
  outdated: false,
  trial: true,
}

/** The trial for the book pilot `id`, or `refusal` for any other pilot. */
export function PlayTrial({ id, refusal }: { id: string; refusal: ReactNode }) {
  const crew = useMemo(() => trialCrew(id), [id])
  return crew === null ? refusal : <TrialCockpit crew={crew} />
}

function TrialCockpit({ crew }: { crew: TrialCrew }) {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const close = openTrial(crew)
    setReady(true)
    return () => {
      setReady(false)
      close()
    }
  }, [crew])
  if (!ready) return null
  return (
    <>
      <SyncContext.Provider value={TRIAL_SYNC}>
        <PlayCockpit
          target={{ pilotId: crew.pilot.id, gameId: null, gameName: null, mediator: false }}
          trial
        />
      </SyncContext.Provider>
      <KeepThisLine pilotId={crew.pilot.id} />
    </>
  )
}

/**
 * "Sign in to keep this", once the first change is made: a line of the strip
 * under the bar (`setScreenNotices`), which the root draws signed out, so its
 * Sign in is the real one.
 */
function KeepThisLine({ pilotId }: { pilotId: string }) {
  const changed = useSyncExternalStore(subscribeTrial, trialChanged, () => false)
  const [dismissed, setDismissed] = useState(false)
  useEffect(() => {
    if (!changed || dismissed) {
      setScreenNotices('trial', [])
      return
    }
    const title = playTrialCopy('keepThis')
    setScreenNotices('trial', [
      {
        key: 'trial',
        kind: 'quiet',
        rank: 'quiet',
        ts: 0,
        dismissible: true,
        tone: 'pilot',
        title,
        body: playTrialCopy('keepThisBody'),
        actions: (
          <SignInControl
            label={playTrialCopy('keepThis')}
            redirectTo={`/starter/pilot/${pilotId}`}
          />
        ),
        dismiss: () => setDismissed(true),
        sig: title,
      },
    ])
  }, [changed, dismissed, pilotId])
  useEffect(() => () => setScreenNotices('trial', []), [])
  return null
}
