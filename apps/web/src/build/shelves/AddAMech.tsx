/**
 * AddAMech — a mech-less pilot line's "+ Add a Mech" in the Training Bay.
 *
 * A pilot with a mech of yours standing unassigned beside them is offered
 * that mech first: the pick dialog lists your unassigned mechs in the pilot's
 * own container (an assignment never straddles two, ADR-037), and Assign
 * draws the link. Building a new one stays one press away, in the same
 * dialog. With no such mech the control is the plain link to the mech wizard,
 * its mech assigned to this pilot.
 */

import type { Mech } from 'game-domain/schemas/mech'
import { useState } from 'react'
import { PickDialog } from '../../components/app'
import { Button, InlineRef, toast } from '../../components/index'
import { failureMessage } from '../../lib/connection/useServerAction'
import { assignLink } from '../../lib/links/assignLink'
import { chassisFact } from '../../lib/shelves/shelfItems'
import { unitRowModel } from '../../lib/units/unitModel'
import { buildShelvesCopy } from '../../messages/build-shelves'
import { ShelfLink } from './ShelfLedger'

type AddAMechProps = {
  pilot: { id: string; name: string }
  /** Your unassigned mechs in the pilot's container, the ones it could fly now. */
  spares: readonly Mech[]
  /** The mech wizard, its mech assigned to this pilot. */
  newHref: string
}

export function AddAMech({ pilot, spares, newHref }: AddAMechProps) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  if (spares.length === 0) {
    return <ShelfLink href={newHref}>{buildShelvesCopy('addAMech')}</ShelfLink>
  }

  const chosen = spares.find((m) => m.id === selected) ?? null

  async function assign(mech: Mech) {
    setPending(true)
    try {
      await assignLink({ type: 'mech', id: mech.id }, { type: 'pilot', id: pilot.id })
      setOpen(false)
      toast.success(buildShelvesCopy('mechAssignedTo', { mech: mech.name, pilot: pilot.name }))
    } catch (err) {
      toast.error(failureMessage(err, buildShelvesCopy('mechNotAssigned', { mech: mech.name })))
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <InlineRef
        onOpen={() => {
          setSelected(null)
          setOpen(true)
        }}
        aria-label={buildShelvesCopy('addAMechTo', { name: pilot.name })}
      >
        {buildShelvesCopy('addAMech')}
      </InlineRef>
      <PickDialog
        open={open}
        onOpenChange={setOpen}
        title={buildShelvesCopy('addAMechTo', { name: pilot.name })}
        groups={[
          {
            key: 'spares',
            title: buildShelvesCopy('yourUnassignedMechs'),
            choices: spares.map((m) => ({
              id: m.id,
              label: m.name,
              model: unitRowModel({ kind: 'mech', name: m.name, note: chassisFact(m.chassisRef) }),
            })),
          },
        ]}
        empty={buildShelvesCopy('everyMechHasItsPilot')}
        selected={selected}
        onSelect={setSelected}
        doors={
          <Button href={newHref} variant="default" size="compact">
            {buildShelvesCopy('buildANewMech')}
          </Button>
        }
        confirmLabel={buildShelvesCopy('assign')}
        confirm={chosen === null ? undefined : () => void assign(chosen)}
        pending={pending}
      />
    </>
  )
}
