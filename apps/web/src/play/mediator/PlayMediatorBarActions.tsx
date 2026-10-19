/**
 * The end of the Mediator's Play bar (play.md §10, wireframe pin 1), after the
 * channel button: **Tell the table** and ⋯.
 *
 *  - **Tell the table** opens its form (`TellTheTable`)
 *    in a dialog: one word to every player at once (`proposals.broadcast`),
 *    which lands on each of their Feeds, with the last five sent under it.
 *  - **⋯**: the Game's own page, and the reference (the SRD Explorer,
 *    `SrdExplorer`) in an overlay over Play.
 *
 * Both Compact, as every control on the bar is (ruleset §4.7).
 */

import { useRouter } from '@tanstack/react-router'
import { gamePath } from 'game-domain/entityKinds'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import { Button, HeaderMenu, ModalShell } from '../../components/index'
import { SrdExplorer } from './SrdExplorer'
import { TellTheTable } from './TellTheTable'
import type { PlayMediator } from './usePlayMediator'

/** The reference overlay: room for the catalog, scrolling inside itself. */
const SRD = { height: '70vh', minHeight: 0, overflowY: 'auto' } satisfies CSSProperties

export function PlayMediatorBarActions({ mediator }: { mediator: PlayMediator }) {
  const router = useRouter({ warn: false })
  const [telling, setTelling] = useState(false)
  const [reference, setReference] = useState(false)
  const gameHref = gamePath(mediator.gameId)

  return (
    <>
      <Button variant="ink" size="compact" onClick={() => setTelling(true)}>
        Tell the table
      </Button>
      <HeaderMenu
        variant="overflow"
        size="compact"
        label="More"
        trigger={null}
        sections={[
          [
            {
              id: 'game',
              label: 'Game page',
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
            { id: 'reference', label: 'Reference', onSelect: () => setReference(true) },
          ],
        ]}
      />
      <ModalShell open={telling} onOpenChange={setTelling} title="Tell the table" width="default">
        <TellTheTable
          alerts={mediator.alerts}
          now={mediator.now}
          canWrite={mediator.canWrite}
          onSend={mediator.broadcast}
        />
      </ModalShell>
      <ModalShell open={reference} onOpenChange={setReference} title="Reference">
        <div style={SRD}>
          <SrdExplorer />
        </div>
      </ModalShell>
    </>
  )
}
