/**
 * WizStarts — what a unit's wizard says under its first step's title, now that
 * it opens on that step with no chooser before it (r6 F2):
 *
 *  - the other ways to start, as links: "Start blank", and a mech's "From a
 *    pattern". Each saves at once, so signed out each says it needs a sign-in;
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

/** Under the step's title: `active` is the step's index. */
export function WizStartLines({ active }: { active: number }) {
  const starts = useContext(WizStartsContext)
  // Read as the wizard opens: a draft it restored, offered on the step it
  // reopened on until answered or left.
  const [openedOn] = useState(active)
  const [draft, setDraft] = useState(
    () => starts !== null && readWizardDraft(wizardDraftKey(starts.kind)) !== null
  )
  if (starts === null) return null
  const needs = (label: string) =>
    starts.signedOut ? buildWizardCopy('startNeedsSignIn', { label }) : label
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
            {needs(buildWizardCopy('startBlank'))}
          </InlineRef>
          {starts.kind === 'mech' && (
            <>
              <span aria-hidden="true">·</span>
              <InlineRef onOpen={() => starts.onStart('pattern')}>
                {needs(buildWizardCopy('fromAPattern'))}
              </InlineRef>
            </>
          )}
          {starts.signedOut && <span>{buildWizardCopy('startsSaveAtOnce')}</span>}
        </p>
      )}
    </>
  )
}
