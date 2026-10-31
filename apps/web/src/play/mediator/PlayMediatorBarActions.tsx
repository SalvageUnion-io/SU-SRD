/**
 * The end of the Mediator's Play bar (play.md §10), after the
 * channel button: **Tell the table** and ⋯. On a phone the bar is one line, so
 * Tell the table is the ⋯'s first item.
 *
 *  - **Tell the table** opens its form (`TellTheTable`)
 *    in a dialog: one word to every player at once (`changeLog.broadcast`),
 *    which lands on each of their Feeds, with the last five sent under it.
 *  - **⋯**: Start or End group session (`useGameSession`, play.md §10), the
 *    Game's own page, and the reference (the SRD Explorer, `SrdExplorer`) in
 *    an overlay over Play.
 *
 * Both Compact, as every control on the bar is (ruleset §4.7).
 */

import { useRouter } from '@tanstack/react-router'
import { gamePath } from 'game-domain/entityKinds'
import { useState } from 'react'
import { Button, HeaderMenu, ModalShell } from '../../components/index'
import { playCopy } from '../../messages/play'
import { mediatorCopy } from '../../messages/play-mediator'
import { useGameSession } from '../useGameSession'
import { SrdExplorer } from './SrdExplorer'
import { TellTheTable } from './TellTheTable'
import type { PlayMediator } from './usePlayMediator'

export function PlayMediatorBarActions({
  mediator,
  wide = true,
}: {
  mediator: PlayMediator
  /** From `lg`: Tell the table is a bar button; below it, the ⋯'s first item. */
  wide?: boolean
}) {
  const router = useRouter({ warn: false })
  const [telling, setTelling] = useState(false)
  const [reference, setReference] = useState(false)
  const gameHref = gamePath(mediator.gameId)
  const session = useGameSession(mediator.gameId)
  const mayRun = session?.canWrite && !session.pending

  return (
    <>
      {wide && (
        <Button variant="ink" size="compact" onClick={() => setTelling(true)}>
          {mediatorCopy('tellTheTable')}
        </Button>
      )}
      <HeaderMenu
        variant="overflow"
        size="compact"
        label={mediatorCopy('more')}
        trigger={null}
        sections={[
          ...(wide
            ? []
            : [
                [
                  {
                    id: 'tell',
                    label: mediatorCopy('tellTheTable'),
                    onSelect: () => setTelling(true),
                  },
                ],
              ]),
          [
            {
              id: 'session',
              label: session?.live ? playCopy('endGroupSession') : playCopy('startGroupSession'),
              ...(mayRun
                ? {
                    onSelect: () => {
                      if (session.live) session.end()
                      else void session.start()
                    },
                  }
                : {}),
            },
          ],
          [
            {
              id: 'game',
              label: mediatorCopy('gamePage'),
              hint: mediator.gameName,
              onSelect: () => {
                if (router) {
                  void router.navigate({
                    to: '/play/games/$gameId',
                    params: { gameId: mediator.gameId },
                  })
                } else window.location.assign(gameHref)
              },
            },
            {
              id: 'reference',
              label: mediatorCopy('reference'),
              onSelect: () => setReference(true),
            },
          ],
        ]}
      />
      <ModalShell
        open={telling}
        onOpenChange={setTelling}
        title={mediatorCopy('tellTheTable')}
        width="default"
      >
        <TellTheTable
          alerts={mediator.alerts}
          now={mediator.now}
          canWrite={mediator.canWrite}
          onSend={mediator.broadcast}
        />
      </ModalShell>
      {/* Bare: the explorer wears the dialog's head, so a category's search
          and filters sit under it rather than in a second titled box. */}
      <ModalShell
        open={reference}
        onOpenChange={setReference}
        title={mediatorCopy('reference')}
        bare
      >
        <SrdExplorer onClose={() => setReference(false)} />
      </ModalShell>
    </>
  )
}
