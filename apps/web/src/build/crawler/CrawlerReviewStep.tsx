import type { CSSProperties } from 'react'
import type { RefCrawler, RefMetaCrawlerTechLevel, RefSystem } from 'salvageunion-reference'
import { crawlerMaxSPParts } from 'salvageunion-reference/rules'
import { FieldError } from '../../components/app'
import { Box, Callout, ReferenceEntityCard, Stat, tokens } from '../../components/index'
import { resolveCrawlerTypeAbilities } from '../../lib/crawlerRefs'
import { unitRowModel } from '../../lib/units/unitModel'
import type { CrawlerWizardFormState } from '../../lib/wizard/crawlerFormState'
import { toScrapPoolPatch } from '../../lib/wizard/crawlerFormState'
import { crawlerCopy } from '../../messages/build-crawler'
import { weaponColumns } from '../wizard/pickColumns'
import { ReviewLedger } from '../wizard/ReviewLedger'
import { Recap, RecapEntity, RecapMinis, RecapStat } from '../wizard/ReviewRecap'

const WEAPON_COLUMNS = weaponColumns<RefSystem>()

/** The Augmented reminder's body copy. */
const REMINDER = { display: 'block', fontFamily: tokens.font.body } satisfies CSSProperties

/** A recap value's chips and Minis, on one wrapping line. */
const CHIPS = {
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  gap: tokens.space[6],
} satisfies CSSProperties

type CrawlerReviewStepProps = {
  form: CrawlerWizardFormState
  /** Resolved tech-level entity for the form's chosen level. */
  techLevel: RefMetaCrawlerTechLevel | undefined
  /** The chosen crawler type, resolved. */
  selectedType: RefCrawler | undefined
  /** Chosen systems resolved from the form's system ids. */
  systems: RefSystem[]
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
    <Stat key={bucket} label={crawlerCopy('t', { slice: bucket.slice(2) })} value={qty} />
  ))

  // A crawler starts at full: `SP | 20/20`, the type bonus in its hover.
  const sp = techLevel
    ? crawlerMaxSPParts({
        techLevel: techLevel.techLevel,
        type: form.type ?? undefined,
      })
    : undefined
  const spChip = sp ? (
    <Stat
      label={crawlerCopy('sp')}
      value={sp.total}
      max={sp.total}
      hoverText={
        sp.typeBonus > 0
          ? crawlerCopy('typeBonusStartsAtFull', {
              base: sp.base,
              typeBonus: sp.typeBonus,
              total: sp.total,
            })
          : crawlerCopy('startsAtFull')
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
    // The review's one form: the recap and the weapons as a Ledger down the
    // main column, the type as its card beside them.
    <div className="su-wiz-compare-layout su-wiz-compare-layout--wide">
      <div className="su-wiz-compare-main">
        <Box bodyClassName="su-wiz-review-panel">
          {/* The recap: Stats, the type as its chip, the rest as Minis. */}
          <Recap>
            <RecapStat label={crawlerCopy('name')} value={form.name.trim()} required />
            <RecapEntity label={crawlerCopy('type')} entity={selectedType} required />
            <RecapStat label={crawlerCopy('tl')} value={techLevel?.techLevel} required />
            {spChip ?? <RecapStat label={crawlerCopy('sp')} value={null} required />}
            <RecapStat label={crawlerCopy('bays')} value={crawlerCopy('fullBaseSetAllIntact')} />
            {scrapChips.length > 0 && <span style={CHIPS}>{scrapChips}</span>}
            <RecapMinis label={crawlerCopy('ability')} entities={abilities} />
            <RecapMinis
              label={crawlerCopy('crew')}
              models={crew}
              empty={crawlerCopy('unnamedFillInDuringPlay')}
            />
          </Recap>
          {submitError && <FieldError>{submitError}</FieldError>}
        </Box>
        <ReviewLedger
          title={crawlerCopy('weapons')}
          entities={systems}
          columns={WEAPON_COLUMNS}
          empty={crawlerCopy('noWeaponsMounted')}
        />
        {isAugmented && (
          <Callout tone="crawler">
            <span style={REMINDER}>
              {crawlerCopy('everyPilotGains')} <strong>{crawlerCopy('n1TrainingPoint')}</strong>{' '}
              {crawlerCopy('augmentOnlyApplyItYourself')}
            </span>
          </Callout>
        )}
      </div>

      <div className="su-wiz-compare-detail">
        {selectedType && (
          <ReferenceEntityCard data={selectedType} size="compact" hide={{ choices: true }} />
        )}
      </div>
    </div>
  )
}
