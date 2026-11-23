/**
 * The end of the Mediator's Play bar (play.md §10), after the
 * channel button: **Start / End group session**, **Tell the table** and ⋯,
 * on a phone's bar too (r8 B10): the live moves are never in a menu.
 *
 *  - **Plan** (a phone's ⋯; from `lg` a pane) opens the session plan and Game notes (`MediatorPlan`, r6 B7)
 *  - **Tell the table** opens its form (`TellTheTable`)
 *    in a dialog: one word to every player at once (`changeLog.broadcast`),
 *    which lands on each of their Feeds, with the last five sent under it.
 *  - **Start / End group session** (`SessionControl`, play.md §10): a bar
 *    button; End asks first.
 *  - **⋯**: Undo last change while an Opposition vital's change can be
 *    undone (r8 B4), the
 *    Game's own page, the reference (the SRD Explorer, `SrdExplorer`) in
 *    an overlay over Play, and the Discord channel while none is bound.
 *
 * Both Compact, as every control on the bar is (ruleset §4.7).
 */

import { useRouter } from '@tanstack/react-router'
import { gamePath } from 'game-domain/entityKinds'
import { lazy, Suspense, useCallback, useRef, useState } from 'react'
import type { HeaderMenuItem } from '../../components/index'
import { Button, HeaderMenu, ModalShell } from '../../components/index'
import { playCopy } from '../../messages/play'
import { mediatorCopy } from '../../messages/play-mediator'
import { SessionControl } from '../SessionControl'
import { useGameSession } from '../useGameSession'
import { undoLastChange, useLastChange } from './oppositionUndo.model'
import { SrdExplorer } from './SrdExplorer'
import { TellTheTable } from './TellTheTable'
import { useMediatorKeys } from './useMediatorKeys'
import type { PlayMediator } from './usePlayMediator'

/** Only needed once opened: its own file (the app's bundle budget). */
const MediatorPlan = lazy(() => import('./MediatorPlan').then((m) => ({ default: m.MediatorPlan })))

/** Only once "?" is pressed (`useMediatorKeys`). */
const PlayKeysSheet = lazy(() =>
  import('../PlayKeysSheet').then(({ PlayKeysSheet }) => ({ default: PlayKeysSheet }))
)

export function PlayMediatorBarActions({
  mediator,
  wide = true,
  channel = null,
}: {
  mediator: PlayMediator
  /** The "Discord channel" row while none is bound (`usePlayChannelControls`). */
  channel?: HeaderMenuItem | null
  /** From `lg`: the Rules and the Plan are panes; below it, the ⋯'s items. */
  wide?: boolean
}) {
  const router = useRouter({ warn: false })
  const [telling, setTelling] = useState(false)
  // Typing starts in the alert, never on Close (MD2-04).
  const alertField = useRef<HTMLInputElement | null>(null)
  const [reference, setReference] = useState(false)
  const [planning, setPlanning] = useState(false)
  const gameHref = gamePath(mediator.gameId)
  const session = useGameSession(mediator.gameId)
  // The last Opposition vital changed, undoable after its toast has gone (r8 B4).
  const lastChange = useLastChange(mediator.gameId)
  // T, R, N and "?" (r8 B10).
  const tell = useCallback(() => setTelling(true), [])
  const { keysOpen, closeKeys } = useMediatorKeys(tell)

  return (
    <>
      {/* On the board, never in a menu, a phone's bar too (r8 B10): the table's own switch, and its word. */}
      <SessionControl session={session} inBar stay />
      <Button variant="ink" size="compact" onClick={() => setTelling(true)}>
        {mediatorCopy('tellTheTable')}
      </Button>
      <HeaderMenu
        variant="overflow"
        size="compact"
        label={mediatorCopy('more')}
        trigger={null}
        sections={[
          lastChange
            ? [
                {
                  id: 'undo',
                  label: mediatorCopy('undoLastChange'),
                  hint: lastChange.label,
                  onSelect: () => void undoLastChange(mediator.gameId),
                },
              ]
            : [],
          [
            {
              id: 'game',
              label: mediatorCopy('gamePage'),
              hint: mediator.gameName,
              onSelect: () => {
                if (router) {
                  void router.navigate({
                    to: '/games/$gameId',
                    params: { gameId: mediator.gameId },
                  })
                } else window.location.assign(gameHref)
              },
            },
            // From `lg` the Rules are a pane beside the board (`mediatorPanes`).
            ...(wide
              ? []
              : [
                  {
                    id: 'reference',
                    label: playCopy('rules'),
                    onSelect: () => setReference(true),
                  },
                  // From `lg` the Plan is a pane of the end column (r6 B7).
                  { id: 'plan', label: mediatorCopy('plan'), onSelect: () => setPlanning(true) },
                ]),
          ],
          channel ? [channel] : [],
        ]}
      />
      {keysOpen && (
        <Suspense fallback={null}>
          <PlayKeysSheet mediator onClose={closeKeys} />
        </Suspense>
      )}
      <ModalShell
        open={telling}
        onOpenChange={setTelling}
        title={mediatorCopy('tellTheTable')}
        width="default"
        initialFocus={alertField}
      >
        <TellTheTable
          field={alertField}
          gameId={mediator.gameId}
          alerts={mediator.alerts}
          now={mediator.now}
          canWrite={mediator.canWrite}
          onSend={mediator.broadcast}
          onWithdraw={mediator.withdrawAlert}
          onSent={() => setTelling(false)}
        />
      </ModalShell>
      {!wide && (
        <ModalShell
          open={planning}
          onOpenChange={setPlanning}
          title={mediatorCopy('plan')}
          width="default"
        >
          <Suspense fallback={null}>
            <MediatorPlan gameId={mediator.gameId} canWrite={mediator.canWrite} />
          </Suspense>
        </ModalShell>
      )}
      {/* Bare: the explorer wears the dialog's head, so a category's search
          and filters sit under it rather than in a second titled box. */}
      <ModalShell open={reference} onOpenChange={setReference} title={playCopy('rules')} bare>
        <SrdExplorer onClose={() => setReference(false)} />
      </ModalShell>
    </>
  )
}
