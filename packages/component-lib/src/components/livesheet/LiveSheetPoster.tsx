/**
 * LiveSheetPoster — L2 TARGET for the live-sheet reconciliation: the "Union
 * Poster" direction, ASSEMBLED ENTIRELY FROM EXISTING PRIMITIVES (no new
 * wholesale components). Ladle-only, not barrel-exported, no app consumers —
 * zero-risk iteration surface (methodology L2). Pilot is the reference
 * implementation; mech + crawler reuse the same parts.
 *
 * The skeleton (same for all three sheets, one accent each):
 *   top bar → identity band (DisplayCard: image seat + field grid)
 *           ∥ vitals band (DisplayCard: VitalGauge ×2 + Stat box + ConditionSwatch)
 *           → Slab-headed collection sections (ReferenceEntityCard rows, max 2-col)
 *           → linked units (Slab + rust link chips to existing player entities)
 *
 * Design intent (confirmed): optimize for WHITESPACE + LEGIBILITY — readable and
 * playable without zoom; keep the existing segmented `VitalGauge`; keep the
 * bottom linked-entity rail. Every region is one of our atoms; the only bespoke
 * markup is layout glue (grids, gaps) and the image SEAT (a framed box / dashed
 * dropzone assembled from Badge + Button — the user-image feature is not built yet).
 */

import { type ReactNode, useRef, useState } from 'react'
import type { SURefEntity } from 'salvageunion-reference'

import { Badge } from '../chrome/Badge'
import { Button } from '../chrome/Button'
import { EmptyState } from '../chrome/EmptyState'
import { Input } from '../chrome/Field'
import { Slab } from '../chrome/Slab'
import { UsedPip } from '../stat/UsedPip'
import { VitalGauge } from '../stat/VitalGauge'
import { DisplayCard } from '../shared/DisplayCard'
import { ModalShell } from '../shared/ModalShell'
import { EntityRow, type EntityRowStat, type EntityRowType } from '../shared/EntityRow'
import { Stat } from '../shared/Stat'
import { ReferenceEntityCard } from '../referenceEntity/card/ReferenceEntityCard'
import { cn } from '../../utils/cn'

// ---------------------------------------------------------------------------
// Data shapes (props — real ORM entities in, no store)
// ---------------------------------------------------------------------------

export type PosterField = {
  label: string
  value: string
  /** Emphasised — larger accent value. */
  accent?: boolean
  /** A once-per-downtime pilot resource (motto / keepsake / background): shows a
   * UsedPip beside the label — the old identity card's UsedChip. */
  usable?: boolean
  /** Seed the used state for a `usable` field. */
  used?: boolean
  /** Spans the full width, breaking out of the field columns (Callsign / Appearance / Bio). */
  fullWidth?: boolean
  /** Clamp the value to N lines (1 for Callsign, 2 for Appearance / Bio). */
  clampLines?: 1 | 2
  /** Show an expand control that opens the full value in a modal (e.g. Bio). */
  expandable?: boolean
}
export type PosterInjury = { label: string; severity: 'minor' | 'major' }
export type PosterCollectionItem = {
  entity: SURefEntity
}
export type PosterLink = {
  kind: string
  name: string
  /** Class/role/chassis label — the EntityRow's toned meta badge. */
  meta?: string
  /** At-a-glance stats (SP/EP/TL) in the row's subheader. */
  stats?: EntityRowStat[]
  href?: string
}

export type LiveSheetPosterProps = {
  name: string
  kind: string
  /** Image seat: provide a src for the FILLED state; omit for the empty dropzone. */
  imageSrc?: string
  imageLabel: string
  fields: PosterField[]
  hp: { value: number; max: number }
  ap: { value: number; max: number }
  tp: number
  injuries: PosterInjury[]
  abilities: PosterCollectionItem[]
  inventory: PosterCollectionItem[]
  linked: PosterLink[]
  /** Read-only (published snapshot) hides every edit affordance. */
  readOnly?: boolean
}

// ---------------------------------------------------------------------------
// Image seat — the reserved user-image region (assembled: framed box / dashed
// dropzone). Filled = a flat tone-toned frame with a seam "Portrait" stamp;
// empty = a dashed seat with a stamp headline + rust Upload (EmptyState idiom).
// ---------------------------------------------------------------------------

function ImageSeat({ src, label, readOnly }: { src?: string; label: string; readOnly?: boolean }) {
  if (src) {
    return (
      <div className="flex flex-col gap-1.5">
        <div className="relative aspect-[3/4] w-full overflow-hidden rounded-card border-rail border-ink">
          <img src={src} alt={label} className="h-full w-full object-cover" />
          <Badge shape="stamp" size="sm" surface="on-tone" seam className="absolute left-1.5 top-0">
            {label}
          </Badge>
        </div>
        {!readOnly && (
          <div className="flex gap-3">
            <button
              type="button"
              className="font-cond text-badge font-bold uppercase tracking-caps text-rust"
            >
              &#9998; Replace
            </button>
            <button
              type="button"
              className="font-cond text-badge font-bold uppercase tracking-caps text-ink-2"
            >
              Remove
            </button>
          </div>
        )}
      </div>
    )
  }
  // Empty dropzone — the shared EmptyState primitive (dashed panel + stamp
  // headline + rust action), the SAME 3:4 portrait size as the filled state so
  // the poster never reflows and the seat never balloons past the fields.
  return (
    <div className="aspect-[3/4] w-full [&>*]:h-full">
      <EmptyState
        headline={`Add ${label}`}
        body="PNG or JPG"
        action={
          readOnly ? undefined : (
            <Button size="sm" variant="primary" onClick={() => {}}>
              Upload
            </Button>
          )
        }
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Field grid — stamp label + read value (ledger hairline). Legibility-first:
// generous line-height, tabular values, airy gaps.
// ---------------------------------------------------------------------------

function Field({
  label,
  value,
  accent,
  usable,
  used: usedSeed,
  clampLines,
  expandable,
  readOnly,
}: PosterField & { readOnly?: boolean }) {
  const [used, setUsed] = useState(!!usedSeed)
  const [open, setOpen] = useState(false)
  const clampClass = clampLines === 1 ? 'line-clamp-1' : clampLines === 2 ? 'line-clamp-2' : ''
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="flex min-h-6 items-center justify-between gap-2">
        <Badge shape="stamp" size="sm" surface={accent ? 'on-tone' : 'on-ink'}>
          {label}
        </Badge>
        <span className="flex shrink-0 items-center gap-2">
          {expandable && (
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label={`Read full ${label.toLowerCase()}`}
              className="font-cond text-badge font-bold uppercase tracking-caps text-rust hover:text-rust-hi"
            >
              Read more
            </button>
          )}
          {/* Usable fields show their Used marker in BOTH modes: editable is an
              always-live toggle; read-only is the same pip, static. */}
          {usable && (
            <UsedPip used={used} subject={label} onToggle={readOnly ? undefined : setUsed} />
          )}
        </span>
      </span>
      <div
        className={`min-w-0 border-b border-ink/15 pb-1 font-body text-ink ${accent ? 'text-lede font-semibold' : 'text-sm'} ${clampClass}`}
      >
        {value}
      </div>
      {expandable && (
        <ModalShell open={open} onOpenChange={setOpen} title={label}>
          <div className="bg-paper p-5 font-body text-sm leading-relaxed text-ink">{value}</div>
        </ModalShell>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Collection section — Slab header + entity rows (compact) + generic chrome rows.
// ---------------------------------------------------------------------------

function CollectionSection({
  title,
  count,
  items,
  readOnly,
  addLabel,
}: {
  title: string
  count: ReactNode
  items: PosterCollectionItem[]
  readOnly?: boolean
  addLabel: string
}) {
  return (
    <section className="flex flex-col gap-3">
      <Slab
        label={title}
        count={count}
        actions={
          readOnly ? undefined : (
            <Button size="sm" variant="default" onClick={() => {}}>
              + Add {addLabel}
            </Button>
          )
        }
      />
      {/* Only game entities render here — always the compact entity card. */}
      <div className="grid grid-cols-1 gap-3">
        {items.map(({ entity }) => (
          <ReferenceEntityCard key={entity.id} data={entity} size="compact" />
        ))}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Linked units — the pilot's linked mech + crawler as real ENTITY ROWS, via the
// shared EntityRow primitive (header-only listing row: ontology accent rail +
// black name-tab + toned meta badge + at-a-glance stats + View/unlink). They're
// PLAYER entities; in the app these resolve to real records.
// ---------------------------------------------------------------------------

function LinkedUnits({ linked }: { linked: PosterLink[] }) {
  return (
    <section className="flex flex-col gap-3">
      <Slab label="Linked Units" />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {linked.map((l) => (
          <EntityRow
            key={`${l.kind}-${l.name}`}
            entityType={l.kind.toLowerCase() as EntityRowType}
            name={l.name}
            meta={l.meta}
            stats={l.stats}
            sheetHref={l.href ?? '#'}
            onDeleteClick={() => {}}
          />
        ))}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// The poster
// ---------------------------------------------------------------------------

const ICONBTN =
  'flex size-[38px] shrink-0 items-center justify-center rounded-card border-chrome border-ink bg-paper text-ink'

export function LiveSheetPoster(props: LiveSheetPosterProps) {
  const {
    name,
    kind,
    imageSrc,
    imageLabel,
    fields,
    hp,
    ap,
    tp,
    injuries,
    abilities,
    inventory,
    linked,
    readOnly,
  } = props

  // Short fields fill an aligned 2-col grid beside the portrait; full-width
  // fields (Appearance, Bio) stack full-width beneath.
  const gridFields = fields.filter((f) => !f.fullWidth)
  const bottomFields = fields.filter((f) => f.fullWidth)

  // Injuries are locally editable (Add via modal, Remove per row) so the
  // editable poster demonstrates the flow; seeded from props. Each row carries
  // a stable key (labels can repeat) minted from a monotonic counter.
  const injuryKey = useRef(0)
  const [injuryList, setInjuryList] = useState<(PosterInjury & { _k: number })[]>(() =>
    injuries.map((inj) => ({ ...inj, _k: injuryKey.current++ }))
  )
  const [injuryModalOpen, setInjuryModalOpen] = useState(false)

  return (
    <div
      className="sheet--pilot min-h-screen"
      style={{ background: 'var(--ground)' }}
      data-variant="pilot"
    >
      {/* ===== Top bar ===== */}
      <header
        className="sticky top-0 z-20 flex min-h-[58px] flex-wrap items-center gap-x-3 gap-y-1 border-b-2 border-ink px-4 py-2 sm:px-[30px]"
        style={{ background: 'var(--ground-2)' }}
      >
        <span className={ICONBTN} aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            className="size-[18px]"
            aria-hidden="true"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <span className="flex size-7 shrink-0 items-center justify-center rounded-badge bg-ink font-cond text-[10px] font-bold text-paper">
          SU
        </span>
        <span className="bg-ink px-2 pb-[3px] pt-[2px] font-cond text-[15px] font-bold uppercase leading-[1.5] tracking-caps-snug text-paper">
          {name}
        </span>
        <Badge shape="stamp" size="sm" surface="on-tone">
          {kind}
        </Badge>
        {/* No global Edit here — each section owns its own edit control. The
            action buttons match the 38px icon-button height for a level bar. */}
        <div className="ml-auto flex shrink-0 items-center gap-2.5">
          <button
            type="button"
            className="inline-flex h-[38px] shrink-0 items-center rounded-card border-chrome border-ink bg-paper px-3.5 font-body text-sm text-ink transition-colors hover:bg-wk-bg-2"
          >
            Share
          </button>
          <span className={ICONBTN} aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="currentColor" className="size-[18px]" aria-hidden="true">
              <circle cx="5" cy="12" r="1.6" />
              <circle cx="12" cy="12" r="1.6" />
              <circle cx="19" cy="12" r="1.6" />
            </svg>
          </span>
        </div>
      </header>

      {/* ===== Poster ===== */}
      <div className="mx-auto flex max-w-[1180px] flex-col gap-4 px-4 pb-14 pt-5 sm:px-[30px]">
        {/* Row 1: Identity ∥ Vitals — `items-start` so the shorter Vitals card
            keeps its natural height instead of stretching to the Identity card
            (no empty card interior). */}
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1.55fr_1fr]">
          {/* Identity band — the section Edit control lives in the HEADER. */}
          <DisplayCard
            headerContent={
              <div className="flex w-full items-center justify-between gap-3">
                <span className="font-cond text-sm font-bold uppercase tracking-caps text-paper">
                  Pilot Identity
                </span>
                {!readOnly && (
                  <button
                    type="button"
                    className="shrink-0 font-cond text-badge font-bold uppercase tracking-caps text-paper/80 hover:text-paper"
                  >
                    &#9998; Edit
                  </button>
                )}
              </div>
            }
            headerBg="bg-[var(--tone-deep)]"
            borderColor="var(--tone)"
            bodyPadding="p-4"
          >
            <div className="flex flex-col gap-3.5">
              {/* Portrait (left) ∥ right region: the first field (Callsign) leads
                  full-width ABOVE an aligned 2-col grid of the rest. Single column
                  on mobile. */}
              <div className="flex flex-col gap-4 sm:flex-row sm:gap-5">
                <div className="w-[140px] shrink-0">
                  <ImageSeat src={imageSrc} label={imageLabel} readOnly={readOnly} />
                </div>
                <div className="flex flex-1 flex-col gap-3.5">
                  {gridFields[0] && <Field {...gridFields[0]} readOnly={readOnly} />}
                  <div className="grid grid-cols-1 content-start gap-x-5 gap-y-3.5 sm:grid-cols-2">
                    {gridFields.slice(1).map((f) => (
                      <Field key={f.label} {...f} readOnly={readOnly} />
                    ))}
                  </div>
                </div>
              </div>
              {/* Appearance, Bio — full-width beneath, clamped (Bio expands to a modal). */}
              {bottomFields.map((f) => (
                <Field key={f.label} {...f} readOnly={readOnly} />
              ))}
            </div>
          </DisplayCard>

          {/* Vitals band */}
          <DisplayCard
            headerContent={
              <span className="font-cond text-sm font-bold uppercase tracking-caps text-paper">
                Vitals
              </span>
            }
            headerBg="bg-[var(--tone-deep)]"
            borderColor="var(--tone)"
            bodyPadding="p-4"
          >
            <div className="flex flex-col gap-3.5">
              <VitalGauge label="HP" value={hp.value} max={hp.max} readOnly={readOnly} />
              <VitalGauge label="AP" value={ap.value} max={ap.max} readOnly={readOnly} />
              <hr className="my-1 border-0 border-t border-dashed border-[color-mix(in_srgb,var(--tone-deep)_40%,transparent)]" />
              <div className="flex flex-wrap items-start gap-5">
                <Stat label="Training" value={tp} bottomLabel="Points" />
                {/* Pilots have no "conditions" in the rules — they track INJURIES
                    (Critical Injury Table): each Minor/Major injury lowers max HP
                    until healed at a Med Bay. */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <Badge shape="stamp" size="sm">
                      Injuries
                    </Badge>
                    {!readOnly && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setInjuryModalOpen(true)}
                        aria-label="Add injury"
                      >
                        + Add
                      </Button>
                    )}
                  </div>
                  {injuryList.length === 0 ? (
                    <p className="mt-2 font-body text-caption text-wk-muted">
                      No injuries — max HP intact.
                    </p>
                  ) : (
                    <div className="mt-2 flex flex-col gap-1.5">
                      {injuryList.map((inj, i) => (
                        <span key={inj._k} className="inline-flex items-center gap-2">
                          <Badge surface="tone" tone={inj.severity === 'major' ? 'bad' : 'warn'}>
                            {inj.severity === 'major' ? 'Major' : 'Minor'}
                          </Badge>
                          <span className="min-w-0 flex-1 font-body text-sm text-ink">
                            {inj.label}
                          </span>
                          <span className="shrink-0 font-body text-caption text-wk-muted">
                            {inj.severity === 'major' ? '−2' : '−1'} max HP
                          </span>
                          {!readOnly && (
                            <button
                              type="button"
                              onClick={() =>
                                setInjuryList((list) => list.filter((_, j) => j !== i))
                              }
                              aria-label={`Remove ${inj.label}`}
                              className="shrink-0 font-cond text-badge font-bold uppercase tracking-caps text-wk-muted hover:text-status-bad"
                            >
                              ✕
                            </button>
                          )}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </DisplayCard>
        </div>

        {/* Row 2: Abilities ∥ Pilot Equipment */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <CollectionSection
            title="Abilities"
            count={abilities.length}
            items={abilities}
            readOnly={readOnly}
            addLabel="ability"
          />
          <CollectionSection
            title="Pilot Equipment"
            count={inventory.length}
            items={inventory}
            readOnly={readOnly}
            addLabel="equipment"
          />
        </div>

        {/* Row 3: Linked units */}
        <LinkedUnits linked={linked} />
      </div>

      <InjuryModal
        open={injuryModalOpen}
        onOpenChange={setInjuryModalOpen}
        onAdd={(inj) => setInjuryList((list) => [...list, { ...inj, _k: injuryKey.current++ }])}
      />
    </div>
  )
}

/**
 * InjuryModal — add a specific Critical-Injury-Table injury: a name + a
 * Minor/Major severity. Built from the shared `ModalShell` + `Input` + `Button`
 * primitives; the severity choice reuses the `Badge` tone stamps the row uses.
 */
function InjuryModal({
  open,
  onOpenChange,
  onAdd,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (injury: PosterInjury) => void
}) {
  const [label, setLabel] = useState('')
  const [severity, setSeverity] = useState<PosterInjury['severity']>('minor')

  const reset = () => {
    setLabel('')
    setSeverity('minor')
  }
  const submit = () => {
    const trimmed = label.trim()
    if (!trimmed) return
    onAdd({ label: trimmed, severity })
    reset()
    onOpenChange(false)
  }

  return (
    <ModalShell
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
      title="Add Injury"
      subtitle="Critical Injury Table — Minor lowers max HP by 1, Major by 2 until healed at a Med Bay."
      maxWidth="max-w-md"
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="injury-name" className="w-fit">
            <Badge shape="stamp" size="sm">
              Injury
            </Badge>
          </label>
          <Input
            id="injury-name"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Cracked ribs"
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit()
            }}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Badge shape="stamp" size="sm">
            Severity
          </Badge>
          <div className="flex gap-2">
            {(['minor', 'major'] as const).map((sev) => {
              const active = severity === sev
              return (
                <button
                  key={sev}
                  type="button"
                  onClick={() => setSeverity(sev)}
                  aria-pressed={active}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-2 rounded-card border-chrome px-3 py-2 font-cond text-sm font-bold uppercase tracking-caps transition-colors',
                    active
                      ? sev === 'major'
                        ? 'border-status-bad bg-status-bad text-paper'
                        : 'border-status-warn bg-status-warn text-paper'
                      : 'border-ink bg-paper text-ink hover:bg-wk-bg-2'
                  )}
                >
                  {sev === 'major' ? 'Major' : 'Minor'}
                  <span className="font-body text-caption font-normal normal-case">
                    {sev === 'major' ? '−2 max HP' : '−1 max HP'}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={submit} disabled={!label.trim()}>
            Add Injury
          </Button>
        </div>
      </div>
    </ModalShell>
  )
}
