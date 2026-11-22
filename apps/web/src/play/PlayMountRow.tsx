/**
 * PlayMountRow — getting in and out of a mech, as a row of the Actions list
 * (play.md §3, §5): on foot, Board (the pilot's own mech first, the rest in a
 * menu); Boarded, Dismount and Eject. The writes are the seat's, through
 * `Play` (`board`, `assignAndBoard`, `setOnFoot`, `seat.eject`).
 *
 * ADR-007: Eject is behind a confirm, and so is assigning an unassigned spare.
 * A Mini one a line in the list (ruleset §1.3; `playLineModel`, Mount being
 * no reference entity), its controls in its chip group (C8); not on hand, the
 * need is its chip.
 */

import { pilotCallsign } from 'game-domain/pilotLabel'
import { useState } from 'react'
import { ConfirmDialog } from '../components/app'
import { Button, Entity, HeaderMenu } from '../components/index'
import { newMechForPilotHref } from '../lib/wizard/fromGame'
import { playCopy } from '../messages/play'
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
        {playCopy('dismount')}
      </Button>
      <Button size="mini" variant="primary" onClick={() => setEjecting(true)} disabled={off}>
        {playCopy('eject')}
      </Button>
    </>
  ) : (
    <>
      {main === undefined ? (
        <>
          {/* Said, never a disabled Board with a hover title a phone can't read. */}
          <NeedChip need={playCopy('noMechToBoard')} />
          {/* Replacing a lost Mech is one path: the Pilot and Game carried, back here after (r5 B17). */}
          {!off && (
            <Button
              size="mini"
              variant="primary"
              href={newMechForPilotHref(play.target.pilotId, play.target.gameId, true)}
            >
              {playCopy('buildANewMech')}
            </Button>
          )}
        </>
      ) : (
        // Boarding is what the line is for: rust, as every Use (§3.13).
        <Button size="mini" variant="primary" onClick={() => choose(main)} disabled={off}>
          {main.state === 'spare'
            ? playCopy('assignAndBoard2', { name: main.name })
            : playCopy('board2', { name: main.name })}
        </Button>
      )}
      {play.mechs.length > 1 && (
        <HeaderMenu
          variant="button"
          disabled={off}
          label={playCopy('boardChooseAMech')}
          // Its own words: Board is the rust act beside it and on a parked Mech (§3.14).
          trigger={playCopy('chooseWhichMech')}
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
        // Getting in and out of a mech wears the mech's tone, faded while
        // there is nothing it can do (with no Mech, it can build one).
        tint="mech"
        dim={away || off}
        // Which mech is the Situation switch's to say ("Boarded · Buzzard"):
        // the line carries only its controls.
        {...(away ? { state: <NeedChip need={need} /> } : { controls })}
      />
      <ConfirmDialog
        open={ejecting}
        onOpenChange={setEjecting}
        tone="danger"
        title={playCopy('eject2')}
        body={playCopy('ejectBody', {
          pilot: play.pilot ? pilotCallsign(play.pilot) : playCopy('yourPilotLeads'),
          mech: boardedName ?? playCopy('theMech'),
        })}
        confirmLabel={playCopy('eject')}
        onConfirm={() => {
          play.seat.eject()
          setEjecting(false)
        }}
      />
      <AssignAndBoardConfirm play={play} assigning={assigning} onClose={() => setAssigning(null)} />
    </li>
  )
}
