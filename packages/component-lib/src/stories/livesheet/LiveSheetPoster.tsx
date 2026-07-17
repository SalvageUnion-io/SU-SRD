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
 * dropzone assembled from Badge + Btn — the user-image feature is not built yet).
 */

import { type ReactNode, useState } from 'react'
import type { SURefEntity } from 'salvageunion-reference'

import { Badge } from '../../components/chrome/Badge'
import { Btn } from '../../components/chrome/Btn'
import { EmptyState } from '../../components/chrome/EmptyState'
import { Slab } from '../../components/chrome/Slab'
import { UsedPip } from '../../components/stat/UsedPip'
import { VitalGauge } from '../../components/stat/VitalGauge'
import { DisplayCard } from '../../components/shared/DisplayCard'
import {
  EntityRow,
  type EntityRowStat,
  type EntityRowType,
} from '../../components/shared/EntityRow'
import { Stat } from '../../components/shared/Stat'
import { ReferenceEntityCard } from '../../components/referenceEntity/card/ReferenceEntityCard'

// ---------------------------------------------------------------------------
// Data shapes (props — real ORM entities in, no store)
// ---------------------------------------------------------------------------

export type PosterField = {
  label: string
  value: string
  /** Emphasised (the callsign) — larger accent value. */
  accent?: boolean
  /** Longer freeform text (appearance / motto / bio) — rendered full-width so it
   * never shares a grid row with a short field and leaves a ragged gap. */
  prose?: boolean
  /** A once-per-downtime pilot resource (motto / keepsake / background): shows a
   * UsedPip beside the label — the old identity card's UsedChip. */
  usable?: boolean
  /** Seed the used state for a `usable` field. */
  used?: boolean
  /** Spans the full width, breaking out of the field columns (e.g. Bio). */
  fullWidth?: boolean
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
            <Btn size="sm" variant="primary" onClick={() => {}}>
              Upload
            </Btn>
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
  readOnly,
}: PosterField & { readOnly?: boolean }) {
  const [used, setUsed] = useState(!!usedSeed)
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="flex min-h-6 items-center justify-between gap-2">
        <Badge shape="stamp" size="sm" surface={accent ? 'on-tone' : 'on-ink'}>
          {label}
        </Badge>
        {/* Every usable field shows its Used marker in BOTH modes: editable is
            an always-live toggle; read-only is the same pip, static. */}
        {usable && (
          <UsedPip used={used} subject={label} onToggle={readOnly ? undefined : setUsed} />
        )}
      </span>
      <div
        className={`min-w-0 border-b border-ink/15 pb-1 font-body text-ink ${
          accent ? 'text-lede font-semibold' : 'text-sm'
        }`}
      >
        {value}
      </div>
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
            <Btn size="sm" variant="default" onClick={() => {}}>
              + Add {addLabel}
            </Btn>
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
            {/* Fields FLOW in TWO columns (CSS multi-column) around the floated
                portrait; a `fullWidth` field (Bio) breaks out to span both
                columns via column-span. `break-inside-avoid` keeps a field whole.
                Single column on mobile. */}
            <div className="gap-x-5 sm:columns-2">
              <div className="float-left mb-3.5 mr-4 w-[140px]">
                <ImageSeat src={imageSrc} label={imageLabel} readOnly={readOnly} />
              </div>
              {fields
                .filter((f) => !f.fullWidth)
                .map((f) => (
                  <div key={f.label} className="mb-3.5 break-inside-avoid">
                    <Field {...f} readOnly={readOnly} />
                  </div>
                ))}
              {fields
                .filter((f) => f.fullWidth)
                .map((f) => (
                  <div key={f.label} className="break-inside-avoid [column-span:all]">
                    <Field {...f} readOnly={readOnly} />
                  </div>
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
                  <Badge shape="stamp" size="sm">
                    Injuries
                  </Badge>
                  {injuries.length === 0 ? (
                    <p className="mt-2 font-body text-caption text-wk-muted">
                      No injuries — max HP intact.
                    </p>
                  ) : (
                    <div className="mt-2 flex flex-col gap-1.5">
                      {injuries.map((inj) => (
                        <span key={inj.label} className="inline-flex items-center gap-2">
                          <Badge surface="tone" tone={inj.severity === 'major' ? 'bad' : 'warn'}>
                            {inj.severity === 'major' ? 'Major' : 'Minor'}
                          </Badge>
                          <span className="min-w-0 flex-1 font-body text-sm text-ink">
                            {inj.label}
                          </span>
                          <span className="shrink-0 font-body text-caption text-wk-muted">
                            {inj.severity === 'major' ? '−2' : '−1'} max HP
                          </span>
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
    </div>
  )
}
