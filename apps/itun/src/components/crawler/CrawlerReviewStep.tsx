import { Callout, FieldError, Panel, ReferenceEntityCard, Stat, tokens } from 'component-lib'
import type { CSSProperties } from 'react'
import type { SURefCrawler, SURefMetaCrawlerTechLevel, SURefSystem } from 'salvageunion-reference'
import { crawlerMaxSPParts } from 'salvageunion-reference/rules'
import { resolveCrawlerTypeAbilities } from '../../lib/crawlerRefs'
import { unitRowModel } from '../../lib/units/unitModel'
import type { CrawlerWizardFormState } from '../../lib/wizard/crawlerFormState'
import { toScrapPoolPatch } from '../../lib/wizard/crawlerFormState'
import '../../styles/wizard.css'
import { Recap, RecapEntity, RecapStat, RecapTokens } from '../wizard/ReviewRecap'

/** Recap and cards; the column split is `.wiz-review-grid`. */
const REVIEW_GRID = { display: 'grid', gap: tokens.space[24] } satisfies CSSProperties

/** The recap column sits at the top of its row. */
const RECAP = { alignSelf: 'start' } satisfies CSSProperties

/** The Augmented reminder's body copy. */
const REMINDER = { display: 'block', fontFamily: tokens.font.body } satisfies CSSProperties

/** A recap value's chips and Tokens, on one wrapping line. */
const CHIPS = {
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  gap: tokens.space[6],
} satisfies CSSProperties

/** The empty-weapons line, in the surrounding text colour. */
const EMPTY_LINE = {
  margin: 0,
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.sm,
  lineHeight: 'calc(1.25 / 0.875)',
  color: 'currentcolor',
} satisfies CSSProperties

type CrawlerReviewStepProps = {
  form: CrawlerWizardFormState
  /** Resolved tech-level entity for the form's chosen level. */
  techLevel: SURefMetaCrawlerTechLevel | undefined
  /** The chosen crawler type, resolved. */
  selectedType: SURefCrawler | undefined
  /** Chosen systems resolved from the form's system ids. */
  systems: SURefSystem[]
  submitError: string | null
}

/**
 * Review (Union Crawler pp.212–213): recap
 * of type / ability / weapon(s) / stat block / scrap pool / crew on the left;
 * the chosen type and weapon entity cards stacked on the right (the universal
 * entity-card rule — fresh weapons carry an 'Intact' badge). The recap is
 * label-first chips: the type opens and Peeks it, `TL | 1`, Structure
 * (`SP | 25/25`, the derived-at-read `20 + 5 type bonus` in its hover) and
 * each Scrap tier (`T1 | 3`). The Augmented type re-surfaces its +1 Training
 * Point reminder —
 * TEXT ONLY, never a cross-pilot write (ADR-007).
 */
export function CrawlerReviewStep({
  form,
  techLevel,
  selectedType,
  systems,
  submitError,
}: CrawlerReviewStepProps) {
  // Label-first chips (ruleset §3.7): each Scrap tier as `T1 | 3`, the
  // crawler sheet's storage labels.
  const scrap = toScrapPoolPatch(form.scrapPool)
  const scrapChips = Object.entries(scrap).map(([bucket, qty]) => (
    <Stat key={bucket} label={`T${bucket.slice(2)}`} value={qty} orientation="horizontal" />
  ))

  // A crawler starts at full: `SP | 20/20`, the type bonus in its hover.
  const sp = techLevel
    ? crawlerMaxSPParts({ techLevel: `tech-${techLevel.techLevel}`, type: form.type ?? undefined })
    : undefined
  const spChip = sp ? (
    <Stat
      label="SP"
      value={sp.total}
      max={sp.total}
      orientation="horizontal"
      hoverText={
        sp.typeBonus > 0
          ? `${sp.base} + ${sp.typeBonus} type bonus = ${sp.total}; starts at full`
          : 'Starts at full'
      }
    />
  ) : null

  const crewNames = Object.values(form.crew)
    .map((entry) => entry.name?.trim())
    .filter((name): name is string => !!name && name.length > 0)

  const isAugmented = selectedType?.name === 'Augmented'
  const abilities = resolveCrawlerTypeAbilities(form.type ?? undefined)
  const crew = crewNames.map((name) => unitRowModel({ kind: 'npc', name }))

  return (
    <div className="wiz-review-grid" style={REVIEW_GRID}>
      <div className="wiz-stack wiz-stack--12" style={RECAP}>
        <Panel className="wiz-review-panel">
          {/* The recap: Stats, the type as its chip, the rest as Tokens. */}
          <Recap>
            <RecapStat label="Name" value={form.name.trim()} required />
            <RecapEntity label="Type" entity={selectedType} required />
            <RecapStat label="TL" value={techLevel?.techLevel} required />
            {spChip ?? <RecapStat label="SP" value={null} required />}
            <RecapStat label="Bays" value="Full base set, seeded automatically · all Intact" />
            {scrapChips.length > 0 && <span style={CHIPS}>{scrapChips}</span>}
            <RecapTokens label="Ability" entities={abilities} />
            <RecapTokens label="Weapons" entities={systems} empty="Required" />
            <RecapTokens label="Crew" models={crew} empty="Unnamed — fill in during play" />
          </Recap>
          {submitError && <FieldError className="wiz-review-error">{submitError}</FieldError>}
        </Panel>
        {isAugmented && (
          <Callout label="Reminder" tone="crawler">
            <span style={REMINDER}>
              Every Pilot gains <strong>+1 Training Point</strong> (Augment ability tree only).
              Apply it on each Pilot&rsquo;s sheet yourself.
            </span>
          </Callout>
        )}
      </div>

      {/* chosen cards */}
      <div className="wiz-stack wiz-stack--12">
        {selectedType && (
          <ReferenceEntityCard data={selectedType} size="medium" hide={{ choices: true }} />
        )}
        {systems.map((system) => (
          <ReferenceEntityCard
            key={system.id}
            data={system}
            size="medium"
            status="intact"
            hide={{ actions: true, choices: true }}
          />
        ))}
        {systems.length === 0 && <p style={EMPTY_LINE}>No weapons mounted.</p>}
      </div>
    </div>
  )
}
