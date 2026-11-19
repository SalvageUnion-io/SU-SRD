/**
 * CreateModeChooser — the "which door?" screen every /new opens on.
 *
 * Doors under the page's ChapterBand, each the house `TitledBox`. A mech's
 * first door is FROM A PATTERN (ADR-066 §4: chassis, then a pattern, then a
 * mech): your saved patterns, each with its Build With This. Then GUIDED
 * (primary — the existing step wizard), headed in the kind's tone, and BLANK
 * (the escape hatch — an empty sheet, no steps, no limits), headed in ink.
 * A mech built for a pilot (`?pilot=`) says so above the doors.
 *
 * The title is the ChapterBand every page wears.
 */

import type { SheetKind } from 'game-domain/entityKinds'
import type { CSSProperties } from 'react'
import { Button, ChapterBand, Text, TitledBox, tokens } from '../../components/index'
import { PatternList } from '../mech/Pattern/PatternList'
import { WizardGameChip } from './WizardGameChip'
import '../../styles/build/wizard.css'
import { buildWizardCopy } from '../../messages/build-wizard'

type CreateModeChooserProps = {
  kind: SheetKind
  /** Chosen the Guided door — navigate to ?mode=guided. */
  onGuided: () => void
  /** Chosen the Blank door — navigate to ?mode=blank. */
  onBlank: () => void
  /** A mech built From a pattern: its id. */
  onBuilt: (id: string) => void
  /** A mech built for a pilot: that pilot's name. */
  forPilot?: string | undefined
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
/** The pattern door: its own row, above Guided and Blank. */
const patternDoor = { flexBasis: '100%' } satisfies CSSProperties
/** The pilot line, above the doors. */
const pilotNote = { marginBottom: tokens.space[12] } satisfies CSSProperties

export function CreateModeChooser({
  kind,
  onGuided,
  onBlank,
  onBuilt,
  gameId,
  forPilot,
}: CreateModeChooserProps) {
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
        {forPilot !== undefined && (
          <Text variant="note" style={pilotNote}>
            {buildWizardCopy('forPilot', { name: forPilot })}
          </Text>
        )}
        <div className="su-wiz-chooser-doors">
          {kind === 'mech' && (
            <div style={patternDoor}>
              <TitledBox title={buildWizardCopy('fromAPattern')} tone="mech">
                <p style={doorText}>{buildWizardCopy('aPatternIsYourPlan')}</p>
                <PatternList onInstantiated={onBuilt} gameId={gameId} />
              </TitledBox>
            </div>
          )}
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
      </div>
    </section>
  )
}
