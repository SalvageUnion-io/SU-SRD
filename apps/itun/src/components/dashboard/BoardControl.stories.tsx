import { Caption } from 'component-lib/stories/harness'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import { InstrumentStage } from './_dashboardStage'
import { BoardControl, BoardMenuList } from './BoardControl'
import type { BoardMenu, BoardOption } from './boardMenu'
import type { BandOverlay } from './MajorFrame'
import { MajorFrame } from './MajorFrame'

export default { title: 'Compositions/Dashboard/Board Control' }

/*
 * The Pilot Major's Mount bay: the Board split button in each of its states,
 * and the ▾ menu with a mech in every state (plan D4). The bay sits in a Major
 * frame at the slot row's height, so the menu opens over it as it does in the
 * Dashboard. Presses are reported in a caption instead of written.
 */

const STACK: CSSProperties = { display: 'flex', flexDirection: 'column', gap: '16px' }

const HEIGHT: CSSProperties = { height: 208 }

function option(name: string, state: BoardOption['state'], note: string | null): BoardOption {
  return { mechId: name.toLowerCase(), serverId: `row-${name}`, name, state, note }
}

const THRESHER = option('Thresher', 'yours', null)
const MENU: BoardOption[] = [
  THRESHER,
  option('Scrapper', 'yours', null),
  option('Spare Mule', 'spare', 'Unclaimed spare'),
  option('Hauler', 'others', 'Another player’s mech'),
  option('Lancer', 'aboard', 'Vex is aboard'),
  option('Wreck', 'destroyed', 'Destroyed'),
]

type Prompt = { kind: 'menu' } | { kind: 'claim'; option: BoardOption } | null

/** The Mount bay with the menu and the claim confirm wired as `PilotMajor` wires them. */
function MountBay({ menu }: { menu: BoardMenu }) {
  const [prompt, setPrompt] = useState<Prompt>(null)
  const [said, setSaid] = useState<string | null>(null)
  const onBoard = (mechId: string) => {
    setPrompt(null)
    setSaid(`Board ${mechId}`)
  }
  const onClaim = (o: BoardOption) => setPrompt({ kind: 'claim', option: o })
  const onClose = () => setPrompt(null)

  const overlay: BandOverlay | null =
    prompt === null
      ? null
      : prompt.kind === 'menu'
        ? {
            title: 'Board a mech',
            onClose,
            body: <BoardMenuList options={menu.options} onBoard={onBoard} onClaim={onClaim} />,
          }
        : {
            title: 'Claim and board',
            onClose,
            body: (
              <p className="pc-resolve-log">
                {prompt.option.name} is an unclaimed spare. Claim it to make it yours in this Game,
                then board it. Boarding doesn’t assign it to Rook.
              </p>
            ),
            actions: [
              {
                label: `Claim and board ${prompt.option.name}`,
                onClick: () => {
                  setPrompt(null)
                  setSaid(`Claim, then board ${prompt.option.mechId}`)
                },
                variant: 'go',
              },
            ],
          }

  return (
    <>
      <div style={HEIGHT}>
        <MajorFrame
          view={{
            fam: 'pilot',
            stampLabel: 'On Foot',
            bays: [
              { label: 'Vitals', lines: [{ text: 'HP 7/10 · AP 3/5' }], buttons: [] },
              {
                label: 'Mount',
                buttons: [],
                control: (
                  <BoardControl
                    menu={menu}
                    onBoard={onBoard}
                    onClaim={onClaim}
                    onOpenMenu={() => setPrompt({ kind: 'menu' })}
                  />
                ),
              },
            ],
            overlay,
          }}
        />
      </div>
      {said ? <Caption>{said}.</Caption> : null}
    </>
  )
}

/**
 * The pilot's assigned mech on the main half; ▾ lists the crawler's mechs:
 * yours, a spare, and one disabled row per reason.
 */
export const SplitButton = () => (
  <div style={STACK}>
    <Caption>
      ▶ Board the assigned mech, or ▾ for every mech on the crawler. Choosing the spare asks before
      it claims anything.
    </Caption>
    <InstrumentStage width={720} mount="pilot">
      <MountBay menu={{ main: THRESHER, options: MENU }} />
    </InstrumentStage>
  </div>
)

/** The assigned mech is destroyed: the main half says why, ▾ still offers the spare. */
export const AssignedDestroyed = () => {
  const wreck = option('Thresher', 'destroyed', 'Destroyed')
  return (
    <div style={STACK}>
      <Caption>Assigned mech destroyed — the main half is disabled with the reason.</Caption>
      <InstrumentStage width={720} mount="pilot">
        <MountBay menu={{ main: wreck, options: [wreck, ...MENU.slice(2)] }} />
      </InstrumentStage>
    </div>
  )
}

/** Someone else is aboard the assigned mech. */
export const AssignedAboard = () => {
  const taken = option('Thresher', 'aboard', 'Vex is aboard')
  return (
    <div style={STACK}>
      <Caption>Another seat is aboard the assigned mech.</Caption>
      <InstrumentStage width={720} mount="pilot">
        <MountBay menu={{ main: taken, options: [taken] }} />
      </InstrumentStage>
    </div>
  )
}

/** No assigned mech: one button, which opens the menu. */
export const NoAssignedMech = () => (
  <div style={STACK}>
    <Caption>No assigned mech — “Board a mech ▾”.</Caption>
    <InstrumentStage width={720} mount="pilot">
      <MountBay menu={{ main: null, options: MENU.slice(2) }} />
    </InstrumentStage>
  </div>
)

/** No crawler and no mech of your own: the menu says there is nothing to board. */
export const NothingToBoard = () => (
  <div style={STACK}>
    <Caption>No crawler, no mechs of your own.</Caption>
    <InstrumentStage width={720} mount="pilot">
      <MountBay menu={{ main: null, options: [] }} />
    </InstrumentStage>
  </div>
)
