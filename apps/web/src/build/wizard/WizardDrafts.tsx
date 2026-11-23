/**
 * WizardDrafts — the Training Bay's lines for the builds this browser keeps as
 * drafts ("Draft: Hacker pilot · Resume"), signed in or out: a build left
 * mid-wizard is said where the reader lands, not only behind + New again.
 * Nothing with no draft. A draft is the browser's (`wizardDraft.ts`),
 * read as the page draws.
 */

import type { SheetKind } from 'game-domain/entityKinds'
import type { CSSProperties } from 'react'
import { Button, Callout, tokens } from '../../components/index'
import { useGo } from '../../components/shared/useGo'
import { wizardDrafts } from '../../lib/wizard/draftSummary'
import { DRAFT_SCOPE } from '../../lib/wizard/wizardDraft'
import { buildWizardCopy } from '../../messages/build-wizard'

const NEW_PATH: Record<SheetKind, string> = {
  pilot: '/pilots/new',
  mech: '/mechs/new',
  crawler: '/crawlers/new',
}

const LIST = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[8],
  listStyle: 'none',
  margin: 0,
  padding: 0,
} satisfies CSSProperties

const LINE = {
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  gap: tokens.space[12],
  justifyContent: 'space-between',
} satisfies CSSProperties

export function WizardDrafts() {
  const go = useGo()
  const drafts = wizardDrafts()
  if (drafts.length === 0) return null
  return (
    <Callout tone="ink">
      <ul
        aria-label={buildWizardCopy(
          DRAFT_SCOPE === 'tab' ? 'draftsInThisTab' : 'draftsInThisBrowser'
        )}
        style={LIST}
      >
        {drafts.map((draft) => (
          <li key={draft.kind} style={LINE}>
            <span>{buildWizardCopy('draftLine', { label: draft.label })}</span>
            <Button
              size="compact"
              aria-label={`${buildWizardCopy('resume')}: ${draft.label}`}
              onClick={() => go(NEW_PATH[draft.kind], { mode: 'guided' })}
            >
              {buildWizardCopy('resume')}
            </Button>
          </li>
        ))}
      </ul>
    </Callout>
  )
}
