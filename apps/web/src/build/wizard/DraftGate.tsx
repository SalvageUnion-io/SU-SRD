/**
 * DraftGate — the question a "Build with this" link asks when this tab keeps
 * a draft built on another pick ("Resume your Hacker pilot draft, or start a
 * new Scout pilot?"). A link never reopens an old draft silently and never
 * discards one: Resume opens the draft and drops the link's pick from the
 * address; Start new discards the draft and opens the wizard on the link's.
 * Asked once, as the wizard would open; with nothing to choose between, the
 * wizard opens as it always did (`draftConflict`).
 */

import type { SheetKind } from 'game-domain/entityKinds'
import type { CSSProperties, ReactNode } from 'react'
import { useState } from 'react'
import { Button, ChapterBand, TitledBox, tokens } from '../../components/index'
import type { DraftLinkPicks } from '../../lib/wizard/draftSummary'
import { draftConflict } from '../../lib/wizard/draftSummary'
import { clearWizardDraft, wizardDraftKey } from '../../lib/wizard/wizardDraft'
import { buildWizardCopy } from '../../messages/build-wizard'
import '../../styles/build/wizard.css'

const KIND_LABEL: Record<SheetKind, string> = { pilot: 'Pilot', mech: 'Mech', crawler: 'Crawler' }

/** The chooser's measure and padding (`.su-wiz-chooser-body`): this stands where it would. */
const MEASURE = '56rem'
const BODY = { marginInline: 'auto', maxWidth: MEASURE, width: '100%' } satisfies CSSProperties
const NOTE = { margin: 0 } satisfies CSSProperties
const ACTS = { display: 'flex', flexWrap: 'wrap', gap: tokens.space[8] } satisfies CSSProperties

export function DraftGate({
  kind,
  picks,
  onResume,
  children,
}: {
  kind: SheetKind
  /** The link's picks, as the route parsed them. */
  picks: DraftLinkPicks
  /** Resume chosen: drop the link's pick from the address. */
  onResume: () => void
  /** The wizard, mounted once there is nothing left to ask. */
  children: ReactNode
}) {
  // Read once, as the wizard would open: the draft is this tab's session's.
  const [asking, setAsking] = useState(() => draftConflict(kind, picks))
  // Resume holds the wizard back until the link's pick has left the address:
  // mounted with it, the wizard would lay the pick over the draft it restores.
  const [resuming, setResuming] = useState(false)
  if (resuming) return draftConflict(kind, picks) === null ? children : null
  if (asking === null) return children
  const question = buildWizardCopy('resumeOrStartNew', asking)
  return (
    <section className={`su-sheet--${kind}`} aria-label={question}>
      <ChapterBand tone={kind} measure={MEASURE}>
        {buildWizardCopy('new', { label: KIND_LABEL[kind] })}
      </ChapterBand>
      <div className="su-wiz-chooser-body" style={BODY}>
        <TitledBox title={question} titleAs="h2" tone={kind}>
          <p style={NOTE}>{buildWizardCopy('resumeOrStartNewNote')}</p>
          <div style={ACTS}>
            <Button
              variant="primary"
              onClick={() => {
                setResuming(true)
                onResume()
              }}
            >
              {buildWizardCopy('resumeDraft', { draft: asking.draft })}
            </Button>
            <Button
              onClick={() => {
                clearWizardDraft(wizardDraftKey(kind))
                setAsking(null)
              }}
            >
              {buildWizardCopy('startNew', { fresh: asking.fresh })}
            </Button>
          </div>
        </TitledBox>
      </div>
    </section>
  )
}
