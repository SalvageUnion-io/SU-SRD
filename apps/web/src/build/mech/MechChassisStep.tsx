import type { CSSProperties, KeyboardEvent } from 'react'
import { useId, useMemo, useState } from 'react'
import type { RefChassis } from 'salvageunion-reference'
import {
  getAssetUrl,
  nameToSlug,
  normalizePatternName,
  SalvageUnionReference,
  visiblePatterns,
} from 'salvageunion-reference'
import { isLegalCreationChassis, legalStartingPatterns } from 'salvageunion-reference/rules'
import { PictureRadio } from '../../components/app'
import {
  assetSrcSetFor,
  capsLabel,
  EmptyState,
  InlineRef,
  ReferenceEntityCard,
  Text,
} from '../../components/index'
import { cn } from '../../lib/cn'
import { chassisFitsCreationBudget } from '../../lib/rules/creation'
import { newInGameHref } from '../../lib/wizard/fromGame'
import { mechCopy } from '../../messages/build-mech'
import { ChassisLegend } from '../wizard/ChassisLegend'
import { PickList } from '../wizard/PickList'
import type { PickColumn } from '../wizard/pickLedger.model'
import { SkipToNext } from '../wizard/SkipToNext'
import { CHASSIS_COLUMNS, PATTERN_STRIP_ID } from './chassisColumns.model'

/** A caps label: the condensed face in capitals (ruleset §3.12). */
const CAPS = capsLabel({ weight: 'inherit', tracking: 'inherit' })

/** A canonical chassis pattern as stored on the reference chassis record. */
export type ChassisPattern = RefChassis['patterns'][number]

/** A starting-pattern row: a book pattern, or the custom build. */
type PatternRow = {
  key: string
  name: string
  line: string
  pattern?: ChassisPattern
  /** A printed pattern past the starting budget: listed, not picked here. */
  beyond?: boolean
}

const PATTERN_COLUMNS: readonly PickColumn<PatternRow>[] = [
  { key: 'loadout', label: mechCopy('loadout'), kind: 'line', value: (row) => row.line },
]

/** The hint's link keeps to one line. */
const NO_WRAP = { whiteSpace: 'nowrap' } satisfies CSSProperties

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
  /** The Game this mech is being built in: the step's own links keep it (r3 L4). */
  gameId?: string | undefined
}

/**
 * Step 1 · Chassis (Workshop Manual p.94). The Tech 1 chassis are the rows of
 * one picker (`PickList`, ledger.md L7): a line a chassis with its seven
 * figures in fixed columns, exactly one picked (radio). The pick stands beside
 * the lists as its contentful card (its art, its ability as a contentful
 * Mini: N3, E19). "Or start from a pattern" is the same picker: the chassis's
 * `legalStarting` patterns and Custom build, a name and a loadout line each,
 * then the rest it prints, dimmed (built as printed from New Mech).
 * Only Tech 1 chassis the 20 Scrap can buy render, a chassis costs its Salvage
 * Value, and a pattern prefills step 2 and debits the same pool.
 */
export function MechChassisStep({
  chassisName,
  patternName,
  onSelectChassis,
  onSelectPattern,
  onSelectCustom,
  gameId,
}: MechChassisStepProps) {
  // Both links start the wizard again: in a Game, in that Game still.
  const inGame = gameId === undefined ? '' : `&game=${encodeURIComponent(gameId)}`
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
  // The dimmed pattern last pressed: its reason is said under the list (r2 D5).
  const [pressed, setPressed] = useState<{ chassis: string; pattern: string } | null>(null)
  const asked = pressed?.chassis === chassisName ? pressed.pattern : undefined

  // Every pattern the chassis prints is listed; only a `legalStarting` one
  // can be picked here, the rest are built as printed from New Mech.
  const printed: ChassisPattern[] = selectedChassis ? visiblePatterns(selectedChassis.patterns) : []
  const patternPool: ChassisPattern[] = legalStartingPatterns(printed)
  const beyond = printed.filter((pattern) => !patternPool.includes(pattern))

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
    ...beyond.map((pattern) => ({
      key: pattern.name,
      name: pattern.name,
      line: loadoutLine(pattern),
      beyond: true,
    })),
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
          <div id={PATTERN_STRIP_ID}>
            <PickList
              // "Optional" is the title's own note, never a column's head (r7 F11).
              title={mechCopy('orStartFromAPatternOptional')}
              rows={patternRows}
              rowKey={(row) => row.key}
              rowName={(row) => row.name}
              columns={PATTERN_COLUMNS}
              selected={selectedPatternKey}
              onSelect={(key) => {
                const row = patternRows.find((r) => r.key === key)
                if (row?.beyond) return setPressed({ chassis: chassisName, pattern: row.name })
                setPressed(null)
                if (row?.pattern) onSelectPattern(row.pattern)
                else onSelectCustom()
              }}
              disabled={(row) => (row.beyond ? mechCopy('notAStartingPattern') : undefined)}
              why={() => mechCopy('notAStartingBuild')}
            />
            {/* A dimmed row says why on itself (r4 E22). A pressed one answers here,
                with the way to build it; until then the hint gives that way. Both links are routes: the
                surface's link adds the app's base. */}
            {asked !== undefined ? (
              <Text variant="hint" role="status">
                {mechCopy('patternNotStarting', { name: asked })}{' '}
                <InlineRef
                  href={`/mechs/new?chassis=${chassisName}&pattern=${nameToSlug(asked)}${inGame}`}
                  style={NO_WRAP}
                >
                  {mechCopy('buildNameAsPrinted', { name: asked })}
                </InlineRef>
              </Text>
            ) : (
              beyond.length > 0 && (
                <Text variant="hint">
                  {mechCopy('dimmedPatternsAreBuilt')}{' '}
                  {/* One line, so a press on its middle lands on it wherever the hint wraps. */}
                  <InlineRef
                    href={`${gameId === undefined ? '/mechs/new?' : `${newInGameHref('/mechs/new', gameId)}&`}mode=pattern`}
                    style={NO_WRAP}
                  >
                    {mechCopy('newMechFromAPattern')}
                  </InlineRef>
                </Text>
              )
            )}
          </div>
        )}
      </div>

      {/* Past the card's links to Next (r5 C6). */}
      <SkipToNext />
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
 * figures the pick list printed, under their labels. One radio group, one
 * Tab stop (the picked plate, else the first), its arrows moving the pick, as
 * the pattern list's radios do (r7 F11); the picked plate takes the ink
 * frame. The step's rule is its cited brief.
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
  const slugs = pool.map((chassis) => nameToSlug(chassis.name))
  const stop = selected !== undefined && slugs.includes(selected) ? selected : slugs[0]
  // A radio group's arrows: the next or previous plate is picked and focused.
  const onArrow = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[event.key]
    if (step === undefined) return
    event.preventDefault()
    const at = slugs.indexOf(stop ?? '')
    const next = slugs[(at + step + slugs.length) % slugs.length]
    if (next === undefined) return
    onSelect(next)
    event.currentTarget.querySelector<HTMLElement>(`[data-slug="${next}"]`)?.focus()
  }
  return (
    <section className="su-chassis-gallery">
      <header className="su-rule-head" data-slab="">
        <h2 className={cn('su-rule-head__label', CAPS)}>{title}</h2>
        <span className={cn('su-rule-head__note', CAPS)}>{note}</span>
      </header>
      {/* What the cards' figures mean, each opening its glossary entry (r6 F3). */}
      <ChassisLegend />
      <div
        className="su-grid su-chassis-gallery__grid"
        role="radiogroup"
        aria-label={title}
        onKeyDown={onArrow}
      >
        {pool.map((chassis) => {
          const slug = nameToSlug(chassis.name)
          const art = getAssetUrl(chassis)
          const picked = slug === selected
          return (
            <PictureRadio
              key={slug}
              checked={picked}
              tabIndex={slug === stop ? 0 : -1}
              data-slug={slug}
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
              <span className={cn('su-chassis-plate__name', CAPS)}>
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
