/**
 * CreateModeChooser — the "which door?" screen every /new opens on.
 *
 * Doors under the page's ChapterBand, each the house `TitledBox` headed h2. A
 * mech's first door is FROM A PATTERN (ADR-066 §4: chassis, then a pattern,
 * then a mech): your saved patterns, each with its Build With This; with none
 * saved yet it is the last door, its empty state under the other two. Then GUIDED
 * (primary — the existing step wizard), headed in the kind's tone, and BLANK
 * (the escape hatch — an empty sheet, no steps, no limits), headed in ink.
 * A mech built for a pilot (`?pilot=`) says so above the doors.
 *
 * The title is the ChapterBand every page wears.
 */

import type { SheetKind } from 'game-domain/entityKinds'
import type { CSSProperties } from 'react'
import { Button, ChapterBand, Slab, Text, TitledBox, tokens } from '../../components/index'
import { clearWizardDraft, readWizardDraft, wizardDraftKey } from '../../lib/wizard/wizardDraft'
import { usePatterns } from '../../replica/collections'
import { BookPatternBuild } from '../mech/Pattern/BookPatternBuild'
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
  /** A Reference pattern page's Build With This: the book pattern to open on, as slugs. */
  book?: { chassis?: string | undefined; pattern?: string | undefined } | undefined
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

const screenStyle = {} satisfies CSSProperties

/** A door's copy: body text, then its page citation in bold. */
const doorText = { margin: 0 } satisfies CSSProperties
const doorCite = { fontWeight: tokens.weight.bold, margin: 0 } satisfies CSSProperties
/** A door's act, at its own width under the copy. */
const doorAct = { alignSelf: 'flex-start' } satisfies CSSProperties
const doorActs = { display: 'flex', flexWrap: 'wrap', gap: tokens.space[8] } satisfies CSSProperties

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
  book,
}: CreateModeChooserProps) {
  const label = KIND_LABEL[kind]
  const guided = GUIDED_COPY[kind]
  // With no pattern saved yet, the pattern door's empty state waits under the
  // other two rather than push Guided below the fold.
  // Read as the chooser draws: the draft is this tab's session's.
  const hasDraft = readWizardDraft(wizardDraftKey(kind)) !== null
  const hasPatterns = usePatterns((s) => s.hydrated && s.mechPatterns.length > 0)
  const patterns = kind === 'mech' && (
    <div style={patternDoor}>
      <TitledBox title={buildWizardCopy('fromAPattern')} titleAs="h2" tone="mech">
        <p style={doorText}>{buildWizardCopy('aPatternIsYourPlan')}</p>
        <BookPatternBuild
          chassis={book?.chassis}
          pattern={book?.pattern}
          onBuilt={onBuilt}
          gameId={gameId}
        />
        {/* A section head is the one Slab (R53). */}
        <Slab as="h3" label={buildWizardCopy('yourPatterns')} />
        <PatternList onInstantiated={onBuilt} gameId={gameId} />
      </TitledBox>
    </div>
  )

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
          {(hasPatterns || book?.pattern !== undefined) && patterns}
          <TitledBox title={buildWizardCopy('guided')} titleAs="h2" tone={kind}>
            <p style={doorText}>{guided.body}</p>
            <p style={doorCite}>{guided.cite}</p>
            {/* A draft left mid-build is said here: resume it, or start again. */}
            <div style={doorActs}>
              <Button variant="primary" onClick={onGuided}>
                {hasDraft ? buildWizardCopy('resumeYourDraft') : buildWizardCopy('startGuided')}
              </Button>
              {hasDraft && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    clearWizardDraft(wizardDraftKey(kind))
                    onGuided()
                  }}
                >
                  {buildWizardCopy('startOver')}
                </Button>
              )}
            </div>
          </TitledBox>

          <TitledBox title={buildWizardCopy('blank2')} titleAs="h2">
            <p style={doorText}>{buildWizardCopy('anEmptySheetNoSteps2')}</p>
            <p style={doorCite}>{buildWizardCopy('forVeteransImportsAndHomebrew')}</p>
            <Button variant="ghost" style={doorAct} onClick={onBlank}>
              {buildWizardCopy('startBlank')}
            </Button>
          </TitledBox>
          {!hasPatterns && book?.pattern === undefined && patterns}
        </div>
      </div>
    </section>
  )
}
