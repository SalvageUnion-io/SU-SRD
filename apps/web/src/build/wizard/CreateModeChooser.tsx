/**
 * CreateModeChooser — the "which door?" screen every /new opens on.
 *
 * Two doors under the page's ChapterBand, each the house `TitledBox` with its
 * one act: GUIDED (primary — the existing step wizard), headed in the kind's
 * tone, and BLANK (the escape hatch — an empty sheet, no steps, no limits),
 * headed in ink. Solid, both: neither is user-made (ruleset §3.9). For mechs a
 * line under them links to the /patterns/ flow: Instantiate from Pattern.
 *
 * The title is the ChapterBand every page wears.
 */

import type { SheetKind } from 'game-domain/entityKinds'
import type { CSSProperties } from 'react'
import { Button, ChapterBand, InlineRef, Text, TitledBox, tokens } from '../../components/index'
import { WizardGameChip } from './WizardGameChip'
import '../../styles/build/wizard.css'
import { buildWizardCopy } from '../../messages/build-wizard'

type CreateModeChooserProps = {
  kind: SheetKind
  /** Chosen the Guided door — navigate to ?mode=guided. */
  onGuided: () => void
  /** Chosen the Blank door — navigate to ?mode=blank. */
  onBlank: () => void
  /** The Game the build was started for (`?game=<id>`): its chip on the band. */
  gameId?: string | undefined
}

const KIND_LABEL: Record<SheetKind, string> = {
  pilot: 'Pilot',
  mech: 'Mech',
  crawler: 'Crawler',
}

/** Guided-door copy + Core Book citation per kind. */
const GUIDED_COPY: Record<SheetKind, { body: string; cite: string }> = {
  pilot: {
    body: buildWizardCopy('stepThroughThePilotBay'),
    cite: 'The Pilot Bay begins on p. 18.',
  },
  mech: {
    body: buildWizardCopy('stepThroughTheMechBay'),
    cite: 'The Mech Bay begins on p. 94.',
  },
  crawler: {
    body: buildWizardCopy('stepThroughCrawlerCreationOne'),
    cite: 'Union Crawlers begin on p. 212.',
  },
}

const screenStyle = { minHeight: '100dvh' } satisfies CSSProperties

/** A door's copy: body text, then its page citation in bold. */
const doorText = { margin: 0 } satisfies CSSProperties
const doorCite = { fontWeight: tokens.weight.bold, margin: 0 } satisfies CSSProperties
/** A door's act, at its own width under the copy. */
const doorAct = { alignSelf: 'flex-start' } satisfies CSSProperties

/** Its padding grows at `sm` (`.su-wiz-chooser-body`). */
const MEASURE = '56rem'
const bodyStyle = { marginInline: 'auto', maxWidth: MEASURE, width: '100%' } satisfies CSSProperties
/** The pattern door's line, under the doors. */
const patternNote = { marginTop: tokens.space[16] } satisfies CSSProperties

export function CreateModeChooser({ kind, onGuided, onBlank, gameId }: CreateModeChooserProps) {
  const label = KIND_LABEL[kind]
  const guided = GUIDED_COPY[kind]

  return (
    <section
      className={`su-sheet--${kind}`}
      style={screenStyle}
      aria-label={buildWizardCopy('newChooseHowToCreate', { lowerCase: label.toLowerCase() })}
    >
      {/* The page title as every other page sets it: the notched ChapterBand
          in the kind's chapter colour, and beside it the Game the build was
          started for, as the wizard's own band shows it. */}
      <ChapterBand
        tone={kind}
        measure={MEASURE}
        asideAt="notch"
        aside={gameId === undefined ? undefined : <WizardGameChip gameId={gameId} />}
      >
        {buildWizardCopy('new', { label })}
      </ChapterBand>

      <div className="su-wiz-chooser-body" style={bodyStyle}>
        {/* The two doors. */}
        <div className="su-wiz-chooser-doors">
          <TitledBox title={buildWizardCopy('guided')} tone={kind}>
            <p style={doorText}>{guided.body}</p>
            <p style={doorCite}>{guided.cite}</p>
            <Button variant="primary" style={doorAct} onClick={onGuided}>
              {buildWizardCopy('startGuided')}
            </Button>
          </TitledBox>

          <TitledBox title={buildWizardCopy('blank2')}>
            <p style={doorText}>{buildWizardCopy('anEmptySheetNoSteps2')}</p>
            <p style={doorCite}>{buildWizardCopy('forVeteransImportsAndHomebrew')}</p>
            <Button variant="ghost" style={doorAct} onClick={onBlank}>
              {buildWizardCopy('startBlank')}
            </Button>
          </TitledBox>
        </div>

        {/* Mech only: the pattern door, a link to the /patterns/ flow. */}
        {kind === 'mech' && (
          <Text variant="note" style={patternNote}>
            {buildWizardCopy('orBuildFromASavedPattern')}{' '}
            <InlineRef href="/patterns/">{buildWizardCopy('instantiateFromPattern')}</InlineRef>
          </Text>
        )}
      </div>
    </section>
  )
}
