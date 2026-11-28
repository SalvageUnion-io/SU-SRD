/**
 * PatternStart — `/mechs/new?mode=pattern`: the New Mech page with only its
 * patterns (`PatternDoor`), reached from the wizard's "From a pattern" link
 * now that no chooser stands before the wizard (r6 F2). The way back is the
 * guided build, the link under the band.
 */

import type { CSSProperties } from 'react'
import { ChapterBand, InlineRef, tokens } from '../../components/index'
import { buildWizardCopy } from '../../messages/build-wizard'
import { PatternDoor } from './CreateModeChooser'
import { WizardGameChip } from './WizardGameChip'
import '../../styles/build/wizard.css'

/** The chooser's measure and padding (`.su-wiz-chooser-body`). */
const MEASURE = '56rem'
const BODY = { marginInline: 'auto', maxWidth: MEASURE, width: '100%' } satisfies CSSProperties
const BACK = { margin: `0 0 ${tokens.space[12]}` } satisfies CSSProperties

export function PatternStart({
  onBuilt,
  onGuided,
  gameId,
  book,
  forLine,
}: {
  /** Who the mech is for ("For Nia Vale: …"). */
  forLine?: string | undefined
  onBuilt: (id: string) => void
  /** Back to the guided build. */
  onGuided: () => void
  gameId?: string | undefined
  book?: { chassis?: string | undefined; pattern?: string | undefined } | undefined
}) {
  const label = buildWizardCopy('new', { label: 'Mech' })
  return (
    <section className="su-sheet--mech" aria-label={label}>
      <ChapterBand
        tone="mech"
        measure={MEASURE}
        asideAt="notch"
        aside={gameId === undefined ? undefined : <WizardGameChip gameId={gameId} />}
      >
        {label}
      </ChapterBand>
      <div className="su-wiz-chooser-body" style={BODY}>
        {forLine !== undefined && <p style={BACK}>{forLine}</p>}
        <p style={BACK}>
          <InlineRef onOpen={onGuided}>{buildWizardCopy('orBuildItGuided')}</InlineRef>
        </p>
        <PatternDoor book={book} onBuilt={onBuilt} gameId={gameId} />
      </div>
    </section>
  )
}
