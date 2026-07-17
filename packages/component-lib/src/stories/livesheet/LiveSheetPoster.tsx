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

import type { ReactNode } from 'react'
import type { SURefEntity } from 'salvageunion-reference'

import { Badge } from '../../components/chrome/Badge'
import { Btn } from '../../components/chrome/Btn'
import { EmptyState } from '../../components/chrome/EmptyState'
import { Slab } from '../../components/chrome/Slab'
import { ConditionSwatch } from '../../components/stat/ConditionSwatch'
import { VitalGauge } from '../../components/stat/VitalGauge'
import { DisplayCard, type CardFootMeta } from '../../components/shared/DisplayCard'
import { Stat } from '../../components/shared/Stat'
import { ReferenceEntityCard } from '../../components/referenceEntity/card/ReferenceEntityCard'

// ---------------------------------------------------------------------------
// Data shapes (props — real ORM entities in, no store)
// ---------------------------------------------------------------------------

export type PosterField = { label: string; value: string; accent?: boolean; span?: 1 | 2 | 3 }
export type PosterCondition = { label: string; state?: 'intact' | 'damaged' | 'destroyed' }
export type PosterCollectionItem = {
  entity: SURefEntity
  footMeta: CardFootMeta[]
  /** Render this row expanded (full card) instead of the compact header row. */
  expanded?: boolean
}
export type PosterGenericItem = { name: string; slots: number }
export type PosterLink = { kind: string; name: string; href?: string }

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
  conditions: PosterCondition[]
  abilities: PosterCollectionItem[]
  inventory: PosterCollectionItem[]
  genericInventory: PosterGenericItem[]
  slotsUsed: number
  slotsCap: number
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
  // headline + rust action), sized to the portrait seat so the poster never
  // reflows between empty and filled.
  return (
    <div className="min-h-[192px] w-full [&>*]:h-full">
      <EmptyState
        headline={`Add ${label}`}
        body="PNG or JPG — seats in the identity band"
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

function Field({ label, value, accent, span }: PosterField) {
  const spanClass = span === 3 ? 'sm:col-span-3' : span === 2 ? 'sm:col-span-2' : ''
  return (
    <div className={`flex min-w-0 flex-col gap-1 ${spanClass}`}>
      <Badge shape="stamp" size="sm" surface={accent ? 'on-tone' : 'on-ink'}>
        {label}
      </Badge>
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
  generic,
  readOnly,
  addLabel,
}: {
  title: string
  count: ReactNode
  items: PosterCollectionItem[]
  generic?: PosterGenericItem[]
  readOnly?: boolean
  addLabel: string
}) {
  return (
    <section className="flex flex-col gap-3">
      <Slab
        label={title}
        count={count}
        variant="solid"
        actions={
          readOnly ? undefined : (
            <Btn size="sm" variant="default" onClick={() => {}}>
              + Add {addLabel}
            </Btn>
          )
        }
      />
      <div className="grid grid-cols-1 gap-3">
        {items.map(({ entity, footMeta, expanded }) => (
          <ReferenceEntityCard
            key={entity.id}
            data={entity}
            size={expanded ? 'full' : 'compact'}
            footMeta={footMeta}
          />
        ))}
        {generic?.map((g) => (
          <div
            key={g.name}
            className="flex items-center justify-between gap-3 rounded-card border-chrome border-ink/25 bg-paper px-3 py-2"
          >
            <span className="min-w-0 truncate font-body text-sm text-ink">{g.name}</span>
            <Badge>Slots {g.slots}</Badge>
          </div>
        ))}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Linked units — the bottom rail: keep linking to existing player entities.
// Rust = navigational (the one action colour).
// ---------------------------------------------------------------------------

function LinkedUnits({ linked }: { linked: PosterLink[] }) {
  return (
    <section className="flex flex-col gap-3">
      <Slab label="Linked Units" variant="solid" />
      <div className="flex flex-wrap gap-2.5">
        {linked.map((l) => (
          <a
            key={`${l.kind}-${l.name}`}
            href={l.href ?? '#'}
            className="inline-flex items-center gap-2 rounded-card border-2 border-rust bg-paper px-3 py-2 font-body text-sm text-rust no-underline hover:bg-rust hover:text-paper"
          >
            <span className="font-cond text-badge font-bold uppercase tracking-caps">{l.kind}</span>
            <span className="font-semibold">{l.name}</span>
            <span aria-hidden="true">&#8599;</span>
          </a>
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
    conditions,
    abilities,
    inventory,
    genericInventory,
    slotsUsed,
    slotsCap,
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
        <div className="ml-auto flex shrink-0 items-center gap-2.5">
          {!readOnly && (
            <Btn size="sm" variant="ghost" onClick={() => {}}>
              &#9998; Edit
            </Btn>
          )}
          <Btn size="sm" variant="ghost" onClick={() => {}}>
            Share
          </Btn>
        </div>
      </header>

      {/* ===== Poster ===== */}
      <div className="mx-auto flex max-w-[1180px] flex-col gap-4 px-4 pb-14 pt-5 sm:px-[30px]">
        {/* Row 1: Identity ∥ Vitals */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.55fr_1fr]">
          {/* Identity band */}
          <DisplayCard
            headerContent={
              <span className="font-cond text-sm font-bold uppercase tracking-caps text-paper">
                Pilot Identity
              </span>
            }
            headerBg="bg-[var(--tone-deep)]"
            borderColor="var(--tone)"
            bodyPadding="p-4"
            footMeta={[{ label: 'Advance', value: `${tp} TP banked` }]}
            footActions={
              readOnly ? undefined : (
                <button
                  type="button"
                  className="font-cond text-badge font-bold uppercase tracking-caps text-rust"
                >
                  &#9998; Edit identity
                </button>
              )
            }
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[150px_1fr]">
              <ImageSeat src={imageSrc} label={imageLabel} readOnly={readOnly} />
              <div className="grid grid-cols-2 gap-x-4 gap-y-3.5 sm:grid-cols-3">
                {fields.map((f) => (
                  <Field key={f.label} {...f} />
                ))}
              </div>
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
            footerContent={
              <span className="font-cond text-[10px] font-semibold uppercase tracking-caps text-ink/85">
                Gauges always live — tap a segment
              </span>
            }
          >
            <div className="flex flex-col gap-3.5">
              <VitalGauge label="HP" value={hp.value} max={hp.max} readOnly={readOnly} />
              <VitalGauge label="AP" value={ap.value} max={ap.max} readOnly={readOnly} />
              <hr className="my-1 border-0 border-t border-dashed border-[color-mix(in_srgb,var(--tone-deep)_40%,transparent)]" />
              <div className="flex flex-wrap items-start gap-5">
                <Stat label="TP" value={tp} bottomLabel="Training pts" />
                <div className="min-w-0 flex-1">
                  <Badge shape="stamp" size="sm">
                    Conditions
                  </Badge>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
                    {conditions.map((c) => (
                      <span key={c.label} className="inline-flex items-center gap-1.5">
                        <ConditionSwatch state={c.state ?? 'intact'} />
                        <span className="font-body text-sm text-ink">{c.label}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </DisplayCard>
        </div>

        {/* Row 2: Abilities ∥ Inventory */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <CollectionSection
            title="Abilities"
            count={abilities.length}
            items={abilities}
            readOnly={readOnly}
            addLabel="ability"
          />
          <CollectionSection
            title="Inventory"
            count={`${slotsUsed} / ${slotsCap} slots`}
            items={inventory}
            generic={genericInventory}
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
