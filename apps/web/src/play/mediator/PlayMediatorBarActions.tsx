/**
 * The end of the Mediator's Play bar (play.md §10), after the
 * channel button: **Tell the table** and ⋯.
 *
 *  - **Tell the table** opens its form (`TellTheTable`)
 *    in a dialog: one word to every player at once (`changeLog.broadcast`),
 *    which lands on each of their Feeds, with the last five sent under it.
 *  - **⋯**: the Game's own page, and the reference (the SRD Explorer,
 *    `SrdExplorer`) in an overlay over Play.
 *
 * Both Compact, as every control on the bar is (ruleset §4.7).
 */

import { useRouter } from '@tanstack/react-router'
import { gamePath } from 'game-domain/entityKinds'
import { useState } from 'react'
import { Button, HeaderMenu, ModalShell } from '../../components/index'
import { mediatorCopy } from '../../messages/play-mediator'
import { SrdExplorer } from './SrdExplorer'
import { TellTheTable } from './TellTheTable'
import type { PlayMediator } from './usePlayMediator'

export function PlayMediatorBarActions({ mediator }: { mediator: PlayMediator }) {
  const router = useRouter({ warn: false })
  const [telling, setTelling] = useState(false)
  const [reference, setReference] = useState(false)
  const gameHref = gamePath(mediator.gameId)

  return (
    <>
      <Button variant="ink" size="compact" onClick={() => setTelling(true)}>
        {mediatorCopy('tellTheTable')}
      </Button>
      <HeaderMenu
        variant="overflow"
        size="compact"
        label={mediatorCopy('more')}
        trigger={null}
        sections={[
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
