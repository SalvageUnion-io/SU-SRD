/**
 * SalvagePickDialog — a crewmate's own pick of a wreck's salvage (r7 D8):
 * the parts the Mediator's roll allows, the Mediator's pick pressed, and Take
 * these, which answers the offer with what is pressed (`ops.accept`'s
 * `picked`). Imported lazily: the root's notices open it after a press.
 */

import type { SalvageOffer } from 'game-domain/games/proposals'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import { ConfirmDialog } from '../components/app'
import { Toggle, tokens } from '../components/index'
import { playCopy } from '../messages/play'
import { offerChoices, togglePick } from './salvageOffer.model'

const ROW = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: tokens.space[4],
} satisfies CSSProperties

type SalvagePickDialogProps = {
  offer: SalvageOffer
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Answer the offer with this pick; a rejection stays on the dialog. */
  onTake: (picked: string[]) => Promise<void>
}

export function SalvagePickDialog({ offer, open, onOpenChange, onTake }: SalvagePickDialogProps) {
  const [picked, setPicked] = useState<string[]>(offer.picked)
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={playCopy('salvageChangeTitle')}
      body={
        <>
          <span>{playCopy('salvageChangeBody')}</span>
          <span style={ROW}>
            {offerChoices(offer, picked).map((choice) => (
              <Toggle
                key={choice.part.key}
                size="mini"
                pressed={choice.pressed}
                disabled={!choice.enabled}
                onClick={() => setPicked((now) => togglePick(now, choice.part.key))}
              >
                {choice.label}
              </Toggle>
            ))}
          </span>
        </>
      }
      confirmLabel={playCopy('salvageTakeThese')}
      describeError={(error) =>
        error instanceof Error && error.message !== '' ? error.message : playCopy('salvagePickNone')
      }
      onConfirm={async () => {
        if (picked.length === 0) throw new Error(playCopy('salvagePickNone'))
        await onTake(picked)
      }}
    />
  )
}
