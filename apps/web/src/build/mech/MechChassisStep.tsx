import { useId, useMemo } from 'react'
import type { BookCite, RefChassis } from 'salvageunion-reference'
import {
  getAssetUrl,
  nameToSlug,
  normalizePatternName,
  SalvageUnionReference,
  visiblePatterns,
} from 'salvageunion-reference'
import { isLegalCreationChassis, legalStartingPatterns } from 'salvageunion-reference/rules'
import {
  assetSrcSetFor,
  capsLabel,
  EmptyState,
  PictureRadio,
  ReferenceEntityCard,
} from '../../components/index'
import { cn } from '../../lib/cn'
import { chassisFitsCreationBudget } from '../../lib/rules/creation'
import { mechCopy } from '../../messages/build-mech'
import { PickList } from '../wizard/PickList'
import type { PickColumn } from '../wizard/pickLedger.model'

/** A caps label: the condensed face in capitals (ruleset §3.12). */
const CAPS = capsLabel({ weight: 'inherit', tracking: 'inherit' })

/** A canonical chassis pattern as stored on the reference chassis record. */
export type ChassisPattern = RefChassis['patterns'][number]

/**
 * A chassis's stats in the one column order (ruleset §2.6): its Salvage Value
 * in place, then its points and slots. What it costs is said once, on the foot.
 * A phone keeps two figures (L8); the pick's card under its list has the rest.
 */
const CHASSIS_COLUMNS: readonly PickColumn<RefChassis>[] = [
  {
    key: 'sv',
    label: mechCopy('sv'),
    title: mechCopy('salvageValueItsCost'),
    phone: true,
    value: (c) => c.salvageValue,
  },
  {
    key: 'sp',
    label: mechCopy('sp'),
    title: mechCopy('structurePoints'),
    phone: true,
    value: (c) => c.structurePoints,
  },
  {
    key: 'ep',
    label: mechCopy('ep'),
    title: mechCopy('energyPoints'),
    value: (c) => c.energyPoints,
  },
  {
    key: 'sys',
    label: mechCopy('sys'),
    title: mechCopy('systemSlots'),
    value: (c) => c.systemSlots,
  },
  {
    key: 'mod',
    label: mechCopy('mod'),
    title: mechCopy('moduleSlots'),
    value: (c) => c.moduleSlots,
  },
  {
    key: 'heat',
    label: mechCopy('heat'),
    title: mechCopy('heatCapacity'),
    value: (c) => c.heatCapacity,
  },
  {
    key: 'cargo',
    label: mechCopy('cargo'),
    title: mechCopy('cargoCapacity'),
    value: (c) => c.cargoCapacity,
  },
]

/** A starting-pattern row: a book pattern, or the custom build. */
type PatternRow = { key: string; name: string; line: string; pattern?: ChassisPattern }

const PATTERN_COLUMNS: readonly PickColumn<PatternRow>[] = [
  { key: 'loadout', label: mechCopy('loadout'), kind: 'line', value: (row) => row.line },
]

const CUSTOM_KEY = 'custom-build'

/** A pattern's loadout as one line, its systems then its modules. */
function loadoutLine(pattern: ChassisPattern): string {
  const names = (list: readonly { name: string; count?: number | undefined }[]) =>
    list.map((entry) =>
      entry.count && entry.count > 1 ? `${entry.name} ×${entry.count}` : entry.name
    )
  return [...names(pattern.systems ?? []), ...names(pattern.modules ?? [])].join(', ')
}

type MechChassisStepProps = {
  /** Chassis slug ref ('' while unchosen). */
  chassisName: string
  /** Current pattern name — drives the strip's radio state. */
  patternName: string
  /** Radio semantics — a new chassis replaces the old (refund + wipe). */
  onSelectChassis: (chassisSlug: string) => void
  /** Prefill step 2 from a canonical pattern (debits the budget). */
  onSelectPattern: (pattern: ChassisPattern) => void
  /** Custom build — no prefill; craft manually in step 2. */
  onSelectCustom: () => void
  /** Where the book prints the step's rule, on the chassis list's foot. */
  cite: BookCite
}

/**
 * Step 1 · Chassis (Workshop Manual p.94). The Tech 1 chassis are the rows of
 * one picker (`PickList`, ledger.md L7): a line a chassis with its seven
 * figures in fixed columns, exactly one picked (radio). The pick stands beside
 * the lists as its contentful card (its art, its ability as a contentful
 * Mini: N3, E19). "Or start from a pattern" is the same picker: the chassis's
 * `legalStarting` patterns and Custom build, a name and a loadout line each.
 * Only Tech 1 chassis the 20 Scrap can buy render, a chassis costs its Salvage
 * Value, and a pattern prefills step 2 and debits the same pool.
 */
export function MechChassisStep({
  chassisName,
  patternName,
  onSelectChassis,
  onSelectPattern,
  onSelectCustom,
  cite: _cite, // MOCK: the gallery drops the pick list's cite foot
}: MechChassisStepProps) {
  const chassisPool = useMemo(
    () =>
      SalvageUnionReference.Chassis.all()
        .filter((c) => isLegalCreationChassis(c.techLevel))
        .sort((a, b) => a.name.localeCompare(b.name)),
    []
  )

  const selectedChassis = chassisName
    ? chassisPool.find((c) => nameToSlug(c.name) === chassisName)
    : undefined

  const patternPool: ChassisPattern[] = selectedChassis
    ? legalStartingPatterns(visiblePatterns(selectedChassis.patterns))
    : []

  // Compare NORMALIZED: mechs saved before the data dropped the " Pattern"
  // suffix still store e.g. "Hauler Pattern", which must keep matching the
  // renamed "Hauler" rather than silently reading as a Custom pattern.
  const isCustom = !patternPool.some(
    (p) => normalizePatternName(p.name) === normalizePatternName(patternName)
  )

  const patternRows: PatternRow[] = [
    ...patternPool.map((pattern) => ({
      key: pattern.name,
      name: pattern.name,
      line: loadoutLine(pattern),
      pattern,
    })),
    {
      key: CUSTOM_KEY,
      name: mechCopy('customBuild'),
      line: mechCopy('noPrefillCraftYourSystems'),
    },
  ]
  const selectedPatternKey = isCustom
    ? CUSTOM_KEY
    : patternPool.find((p) => normalizePatternName(p.name) === normalizePatternName(patternName))
        ?.name

  return (
    <div className="su-wiz-compare-layout">
      <div className="su-wiz-compare-main">
        <div>
          <ChassisGallery
            title={mechCopy('tech1Chassis')}
            note={mechCopy('choose1')}
            pool={chassisPool.filter((c) => chassisFitsCreationBudget(c.salvageValue))}
            selected={chassisName || undefined}
            onSelect={onSelectChassis}
          />
        </div>
        {selectedChassis !== undefined && (
          <div>
            <PickList
              title={mechCopy('orStartFromAPattern')}
              note={mechCopy('optional')}
              rows={patternRows}
              rowKey={(row) => row.key}
              rowName={(row) => row.name}
              columns={PATTERN_COLUMNS}
              selected={selectedPatternKey}
              onSelect={(key) => {
                const row = patternRows.find((r) => r.key === key)
                if (row?.pattern) onSelectPattern(row.pattern)
                else onSelectCustom()
              }}
            />
          </div>
        )}
      </div>

      <div className="su-wiz-compare-detail su-wiz-compare-detail--sticky">
        {selectedChassis === undefined ? (
          <EmptyState variant="quiet" body={mechCopy('pickAChassisToReveal')} bodyInk="inherit" />
        ) : (
          <ReferenceEntityCard
            data={selectedChassis}
            size="compact"
            hide={{ actions: true, choices: true, patterns: true }}
            // Choosing a chassis needs its ability: nested in the pick, a
            // contentful Mini (N3, E19).
            showChassisAbility
          />
        )}
      </div>
    </div>
  )
}

/**
 * The chassis pick as a gallery.
 * A chassis is chosen by its picture first (the owner: "huge draw"), so each
 * is a plate: its art, its name, its cost (Salvage Value), and the same six
 * figures the pick list printed, under their labels. One radio group; the
 * picked plate takes the ink frame. The step's cite would ride the foot as
 * the pick list's did; the mock drops it.
 */
function ChassisGallery({
  title,
  note,
  pool,
  selected,
  onSelect,
}: {
  title: string
  note: string
  pool: readonly RefChassis[]
  selected: string | undefined
  onSelect: (slug: string) => void
}) {
  const figures = CHASSIS_COLUMNS.filter((column) => column.key !== 'sv')
  const plateId = useId()
  return (
    <section className="su-chassis-gallery">
      <header className="su-rule-head">
        <h2 className={cn('su-rule-head__label', CAPS, CAPS)}>{title}</h2>
        <span className={cn('su-rule-head__note', CAPS, CAPS)}>{note}</span>
      </header>
      <div className="su-grid su-chassis-gallery__grid" role="radiogroup" aria-label={title}>
        {pool.map((chassis) => {
          const slug = nameToSlug(chassis.name)
          const art = getAssetUrl(chassis)
          const picked = slug === selected
          return (
            <PictureRadio
              key={slug}
              checked={picked}
              className="su-chassis-plate"
              data-picked={picked || undefined}
              aria-labelledby={`${plateId}-${slug}`}
              aria-describedby={`${plateId}-${slug}-figures`}
              onClick={() => onSelect(slug)}
            >
              <span className="su-chassis-plate__art">
                {art && (
                  <img src={art} srcSet={assetSrcSetFor(art)} sizes="240px" alt="" loading="lazy" />
                )}
              </span>
              <span className={cn('su-chassis-plate__name', CAPS, CAPS)}>
                <b id={`${plateId}-${slug}`}>{chassis.name}</b>
                <span className="su-chassis-plate__cost">
                  <small>{mechCopy('sv')}</small> {chassis.salvageValue}
                </span>
              </span>
              <span id={`${plateId}-${slug}-figures`} className="su-chassis-plate__figures">
                {figures.map((column) => (
                  <span key={column.key} title={column.title}>
                    <small>{column.label}</small>
                    <b>{column.value(chassis)}</b>
                  </span>
                ))}
              </span>
            </PictureRadio>
          )
        })}
      </div>
    </section>
  )
}
