/**
 * PlayMountRow — getting in and out of a mech, as a row of the Actions list
 * (play.md §3, §5): on foot, Board (the pilot's own mech first, the rest in a
 * menu); Boarded, Dismount and Eject. The writes are the seat's, through
 * `Play` (`board`, `assignAndBoard`, `setOnFoot`, `seat.eject`).
 *
 * ADR-007: Eject is behind a confirm, and so is assigning an unassigned spare.
 * A Mini one a line in the list (ruleset §1.3; `playLineModel`, Mount being
 * no reference entity), its controls in its chip group (R6); not on hand, the
 * need is its chip.
 */

import { useState } from 'react'
import { Button, ConfirmDialog, Entity, HeaderMenu } from '../components/index'
import { AssignAndBoardConfirm } from './AssignAndBoardConfirm'
import type { BoardOption } from './boardMenu.model'
import { boardable, boardedMechName, boardMenuSections } from './boardMenu.model'
import { NeedChip } from './PlayActionRow'
import { playLineModel } from './playLine.model'
import type { Play } from './situation.model'

const MODEL = playLineModel({ name: 'Mount', key: 'mount' })

type PlayMountRowProps = {
  play: Play
  /** Why it is not on hand ("after Downtime"), or null when it is. */
  need: string | null
}

export function PlayMountRow({ play, need }: PlayMountRowProps) {
  const [ejecting, setEjecting] = useState(false)
  const [assigning, setAssigning] = useState<BoardOption | null>(null)
  const away = need !== null
  const off = !play.canWrite
  const boarded = play.situation === 'boarded' || play.boardedMechId !== null
  const boardedName = boardedMechName(play)

  function choose(option: BoardOption) {
    if (option.state === 'spare') setAssigning(option)
    else play.board(option.mechId)
  }

  const main = play.mechs.find(boardable)

  const controls = away ? undefined : boarded ? (
    <>
      <Button size="mini" onClick={play.setOnFoot} disabled={off}>
        Dismount
      </Button>
      <Button size="mini" variant="primary" onClick={() => setEjecting(true)} disabled={off}>
        Eject
      </Button>
    </>
  ) : (
    <>
      {main === undefined ? (
        <Button size="mini" disabled title="No Mech to board">
          Board
        </Button>
      ) : (
        // The outlined Button reads on the Mini's pill (R19),
        // beside the Use and Eject a filled one draws.
        <Button size="mini" onClick={() => choose(main)} disabled={off}>
          {main.state === 'spare' ? `Assign and board ${main.name}` : `Board ${main.name}`}
        </Button>
      )}
      {play.mechs.length > 1 && (
        <HeaderMenu
          variant="button"
          disabled={off}
          label="Board, choose a Mech"
          trigger="Board"
          sections={boardMenuSections(play.mechs, choose)}
        />
      )}
    </>
  )

  return (
    <li className="su-play-act" data-away={away || undefined} data-action-key="mount">
      <Entity
        size="mini"
        context="play"
        model={MODEL}
        // Getting in and out of a mech wears the mech's tone,
        // faded while there is nothing it can do.
        tint="mech"
        dim={away || off || (!boarded && main === undefined)}
        // Which mech is the Situation switch's to say ("Boarded · Buzzard"):
        // the line carries only its controls.
        {...(away ? { state: <NeedChip need={need} /> } : { controls })}
      />
      <ConfirmDialog
        open={ejecting}
        onOpenChange={setEjecting}
        tone="danger"
        title="Eject?"
        body={`${play.pilot?.name ?? 'Your Pilot'} leaves ${boardedName ?? 'the Mech'} at once, wherever it is. The Mech stays where it stands.`}
        confirmLabel="Eject"
        onConfirm={() => {
          play.seat.eject()
          setEjecting(false)
        }}
      />
      <AssignAndBoardConfirm play={play} assigning={assigning} onClose={() => setAssigning(null)} />
    </li>
  )
}
