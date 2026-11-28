/**
 * WizStarts — what a unit's wizard says under its first step's title, now that
 * it opens on that step with no chooser before it (r6 F2):
 *
 *  - the other ways to start, as links: "Start blank", and a mech's "From a
 *    pattern", with the shell's own line after them on the same line (signed
 *    out: "Saving needs a free sign-in.", said once, r7 F5);
 *  - a kept draft (r6 F6): "Continue your draft · Discard", on the step the
 *    wizard reopened on, until answered;
 *  - who the build is for (a mech built for a pilot), as the chooser said it.
 *
 * `NewEntityScreen` provides it around the wizard (`wizStarts.model.ts`); a
 * wizard with none (the NPC designer, a redesign) shows neither.
 */

import type { CSSProperties } from 'react'
import { useContext, useState } from 'react'
import { Button, InlineRef, tokens } from '../../components/index'
import { readWizardDraft, wizardDraftKey } from '../../lib/wizard/wizardDraft'
import { buildWizardCopy } from '../../messages/build-wizard'
import { tryNoteStyle } from './wizShellStyles.model'
import { WizStartsContext } from './wizStarts.model'

const LINE = {
  ...tryNoteStyle,
  display: 'flex',
  flexWrap: 'wrap',
  gap: tokens.space[8],
} satisfies CSSProperties
const ACTS = {
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  gap: tokens.space[8],
} satisfies CSSProperties

/**
 * Under the step's title: `active` is the step's index, `tryNote` the shell's
 * own line (signed out: saving needs a sign-in), said last: on the first step
 * it ends the starts' line rather than standing as a second. A redesign shows
 * only that line.
 */
export function WizStartLines({
  active,
  tryNote,
  redesign,
}: {
  active: number
  tryNote?: string | undefined
  redesign: boolean
}) {
  const starts = useContext(WizStartsContext)
  // Read as the wizard opens: a draft it restored, offered on the step it
  // reopened on until answered or left.
  const [openedOn] = useState(active)
  const [draft, setDraft] = useState(
    () => starts !== null && readWizardDraft(wizardDraftKey(starts.kind)) !== null
  )
  const note = tryNote ? <p style={tryNoteStyle}>{tryNote}</p> : null
  if (starts === null || redesign) return note
  return (
    <>
      {draft && active === openedOn && (
        <div style={ACTS}>
          <Button size="compact" variant="primary" onClick={() => setDraft(false)}>
            {buildWizardCopy('continueYourDraft')}
          </Button>
          <Button
            size="compact"
            variant="ghost"
            onClick={() => {
              setDraft(false)
              starts.onDiscard()
            }}
          >
            {buildWizardCopy('discard')}
          </Button>
        </div>
      )}
      {active === 0 && starts.forLine !== undefined && <p style={tryNoteStyle}>{starts.forLine}</p>}
      {active === 0 && (
        <p style={LINE}>
          <span>{buildWizardCopy('orStart')}</span>
          <InlineRef onOpen={() => starts.onStart('blank')}>
            {buildWizardCopy('startBlank')}
          </InlineRef>
          {starts.kind === 'mech' && (
            <>
              <span aria-hidden="true">·</span>
              <InlineRef onOpen={() => starts.onStart('pattern')}>
                {buildWizardCopy('fromAPattern')}
              </InlineRef>
            </>
          )}
          {tryNote && <span>{tryNote}</span>}
        </p>
      )}
      {active !== 0 && note}
    </>
  )
}
