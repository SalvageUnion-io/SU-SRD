/**
 * CreateModeChooser — the "which door?" screen every /new opens on
 * (mockup Screen 04).
 *
 * Two manual-style doors under the page's ChapterBand: GUIDED (primary — the existing
 * step wizard) and BLANK (the escape hatch — an empty sheet, no steps, no
 * limits). For mechs a third door joins the Blank family: Instantiate from
 * Pattern, which links to the existing /mechs/patterns flow.
 *
 * The title is the ChapterBand every page wears; the `.su-sheet--{kind}` tone
 * context colours the Guided door.
 */

import { ChapterBand, ModeDoor, tokens } from 'component-lib'
import type { CSSProperties } from 'react'
import type { BlankCreateKind } from '../../lib/wizard/blankCreate'
import { AppLink } from '../shared/AppLink'
import '../../styles/wizard.css'

type CreateModeChooserProps = {
  kind: BlankCreateKind
  /** Chosen the Guided door — navigate to ?mode=guided. */
  onGuided: () => void
  /** Chosen the Blank door — navigate to ?mode=blank. */
  onBlank: () => void
}

const KIND_LABEL: Record<BlankCreateKind, string> = {
  pilot: 'Pilot',
  mech: 'Mech',
  crawler: 'Crawler',
}

/** Guided-door copy + Core Book citation per kind (mockup Screen 04). */
const GUIDED_COPY: Record<BlankCreateKind, { body: string; cite: string }> = {
  pilot: {
    body: 'Step through the Pilot Bay rules, one card at a time — class, abilities, equipment, identity.',
    cite: 'The Pilot Bay begins on p. 18.',
  },
  mech: {
    body: 'Step through the Mech Bay rules, one card at a time — chassis, pattern, systems and modules.',
    cite: 'The Mech Bay begins on p. 94.',
  },
  crawler: {
    body: 'Step through crawler creation, one card at a time — type, armament, crew, identity.',
    cite: 'Union Crawlers begin on p. 212.',
  },
}

const screenStyle = { minHeight: '100dvh' } satisfies CSSProperties

/** Its padding grows at `sm` (`.su-wiz-chooser-body`). */
const bodyStyle: CSSProperties = { marginInline: 'auto', maxWidth: '56rem', width: '100%' }

/** Its fill dims on hover, so the background is `.su-wiz-chooser-pattern`'s. */
const patternLinkStyle: CSSProperties = {
  borderRadius: tokens.radius.badge,
  color: tokens.color.paper,
  display: 'block',
  fontFamily: tokens.font.cond,
  fontSize: tokens.fontSize.badge,
  fontWeight: tokens.weight.bold,
  letterSpacing: '0.1em',
  lineHeight: 1.625,
  marginInline: 'auto',
  marginTop: tokens.space[24],
  maxWidth: '92%',
  padding: `${tokens.space[8]} ${tokens.space[16]}`,
  textAlign: 'center',
  textDecorationLine: 'none',
  textTransform: 'uppercase',
  width: 'fit-content',
}

const patternAccentStyle: CSSProperties = { color: tokens.color.pilot }

export function CreateModeChooser({ kind, onGuided, onBlank }: CreateModeChooserProps) {
  const label = KIND_LABEL[kind]
  const guided = GUIDED_COPY[kind]

  return (
    <section
      className={`su-sheet--${kind}`}
      style={screenStyle}
      aria-label={`New ${label.toLowerCase()} — choose how to create`}
    >
      {/* The page title as every other page sets it: the notched ChapterBand
          in the kind's chapter colour. */}
      <ChapterBand tone={kind}>New {label}</ChapterBand>

      <div className="su-wiz-chooser-body" style={bodyStyle}>
        {/* The two doors (mockup `.choosegrid`). */}
        <div className="su-wiz-chooser-doors">
          <ModeDoor
            variant="guided"
            tab="▶"
            headline="Guided"
            cite={guided.cite}
            onSelect={onGuided}
          >
            {guided.body}
          </ModeDoor>

          <ModeDoor
            variant="blank"
            tab="✎"
            headline="Blank"
            cite="For veterans, imports, and homebrew."
            onSelect={onBlank}
          >
            An empty sheet. No steps, no limits. Fill it in on the live sheet.
          </ModeDoor>
        </div>

        {/* Mech only: the third Blank-family door — Instantiate from Pattern
            (mockup `.thirdnote`, made actionable: links to the existing
            /mechs/patterns flow). */}
        {kind === 'mech' && (
          <AppLink
            href="/mechs/patterns"
            className="su-wiz-chooser-pattern"
            style={patternLinkStyle}
          >
            A third door in the Blank family —{' '}
            <span style={patternAccentStyle}>Instantiate from Pattern</span> · stamp a saved
            pattern, then edit freely
          </AppLink>
        )}
      </div>
    </section>
  )
}
