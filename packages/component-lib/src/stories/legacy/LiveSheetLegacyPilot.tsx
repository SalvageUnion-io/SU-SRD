/**
 * LiveSheetLegacyPilot — a faithful, presentational "before" capture of ITUN's
 * CURRENT Pilot live sheet, reproduced INSIDE component-lib so it can live in
 * the Ladle catalog (component-lib cannot import the ITUN app, and ITUN has no
 * Ladle of its own). This is the L1 "real before" for the live-sheet
 * reconciliation pass — every region, class string, and primitive mirrors the
 * shipped ITUN sheet as of PR #466 (apps/in-the-union-now/src/components/sheet):
 *
 *   - top bar        ← LiveSheet.tsx (sticky app bar, resting state)
 *   - hero name band ← SheetHero.tsx (Phase-2 hero: name + meta only)
 *   - section frame  ← SheetSectionCard.tsx (DisplayCard-composed poster `.dcard`)
 *   - identity read  ← PilotIdentity.tsx / IdentityField.tsx (read-value boxes)
 *   - vitals         ← PilotSheet.tsx (VitalGauge + TpBlock) + ConditionsEditor
 *   - abilities/inv  ← PilotSheetItems.tsx (ReferenceEntityCard + footMeta) in Erow/Ecflow
 *   - linked units   ← SheetRail (bare SectionChead + rail chips)
 *
 * Rendered at REST (read-only presentation): no store, no persistence — static
 * identity/vital values, real ORM entities passed in as props. Story-only:
 * NOT barrel-exported (zero-risk, per the reconciliation methodology — the
 * "before" never ships).
 *
 * FIDELITY NOTE: the arbitrary values kept verbatim here (`text-[30px]`,
 * `tracking-widest`, `rounded-[8px]`, `text-[10.5px]`, `text-[9.5px]`, …) ARE
 * the pre-canon drift this reconciliation exists to remove. They are copied on
 * purpose so the "before" reads exactly as shipped — do not "fix" them here;
 * they get reconciled onto the canonical scale in the target shape.
 */

import type { ReactNode } from 'react'
import type { SURefEntity } from 'salvageunion-reference'

import { Badge } from '../../components/chrome/Badge'
import { Btn } from '../../components/chrome/Btn'
import { Pill } from '../../components/chrome/Pill'
import { DisplayCard, type CardFootMeta } from '../../components/shared/DisplayCard'
import { Stat } from '../../components/shared/Stat'
import { VitalGauge } from '../../components/stat/VitalGauge'
import { ReferenceEntityCard } from '../../components/referenceEntity/card/ReferenceEntityCard'

// ---------------------------------------------------------------------------
// SheetSectionCard mirror (← SheetSectionCard.tsx) — DisplayCard-composed poster
// `.dcard`: accent header/footer bands, deep-tone left rule on the paper body.
// ---------------------------------------------------------------------------

const CARD_TITLE_STAMP =
  'box-decoration-clone inline bg-ink px-2 pb-[3px] pt-[2px] font-cond text-sm font-bold uppercase leading-relaxed tracking-caps text-paper'

function SectionCard({
  title,
  count,
  controls,
  className,
  children,
}: {
  title: string
  count?: ReactNode
  controls?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <DisplayCard
      headerBg="bg-[var(--tone)]"
      borderColor="var(--tone)"
      cardStyle={{ className: className ? `sheet-section ${className}` : 'sheet-section' }}
      bodyPadding="p-0"
      headerContent={
        <>
          <div className="flex min-w-0 items-center gap-2">
            <span className={CARD_TITLE_STAMP}>{title}</span>
            {count}
          </div>
          {controls && <div className="ml-auto flex items-center gap-2">{controls}</div>}
        </>
      }
    >
      <div className="flex flex-1 flex-col bg-[var(--tone)] px-3">
        <div className="flex-1 border-l-[3px] border-[var(--tone-deep)] bg-paper px-3.5 py-3">
          {children}
        </div>
      </div>
    </DisplayCard>
  )
}

// ---------------------------------------------------------------------------
// Section-header controls (← SheetSection.tsx HBtn) — resting Edit / + Add.
// ---------------------------------------------------------------------------

const HBTN_BASE =
  'inline-flex cursor-pointer items-center gap-1.5 rounded-[3px] border-2 px-3 font-cond text-label-lg font-bold uppercase leading-none tracking-caps-wide whitespace-nowrap min-h-11 sm:min-h-8'

function EditControl() {
  return (
    <span className={`${HBTN_BASE} border-ink bg-paper text-ink`}>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-3.5 w-3.5"
        aria-hidden="true"
      >
        <path d="m16.5 3.5 4 4L7 21H3v-4z" />
      </svg>
      Edit
    </span>
  )
}

function AddControl({ label }: { label: string }) {
  return (
    <span
      className={`${HBTN_BASE} border-[color:var(--tone-deep)] bg-paper text-[color:var(--tone-deep)]`}
    >
      <span className="flex h-4 w-4 items-center justify-center rounded-full border-2 border-current">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={3}
          strokeLinecap="round"
          className="h-2 w-2"
          aria-hidden="true"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
      </span>
      Add {label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// IdentityField mirror (← IdentityField.tsx) — read-value box, tight label tab.
// ---------------------------------------------------------------------------

function IdentityField({
  label,
  value,
  multiline,
  labelAction,
}: {
  label: string
  value: string
  multiline?: boolean
  labelAction?: ReactNode
}) {
  return (
    <div className="flex min-w-0 flex-col">
      <span className="mb-[2px] flex items-center justify-between gap-2">
        <span className="bg-ink px-1.5 pb-px pt-[2px] font-cond text-label font-bold uppercase leading-none tracking-caps text-paper">
          {label}
        </span>
        {labelAction}
      </span>
      <span
        className="flex min-h-[44px] items-center rounded-[8px] border-2 bg-paper px-3 py-2 font-body text-sm text-ink"
        style={{
          borderColor: 'color-mix(in oklch, var(--tone-deep, var(--color-ink)) 50%, transparent)',
        }}
      >
        <span className={`min-w-0 ${multiline ? 'whitespace-pre-wrap' : 'truncate'}`}>{value}</span>
      </span>
    </div>
  )
}

/** Static 'USED' stamp (← PilotIdentity.tsx UsedChip, read state). */
function UsedStamp() {
  return (
    <span className="inline-flex min-h-[28px] items-center gap-1.5 rounded-full border-2 border-ink bg-ink py-[4px] pl-[6px] pr-[10px] font-cond text-[9.5px] font-bold uppercase leading-none tracking-caps-wide text-paper">
      <span
        aria-hidden="true"
        className="h-3 w-3 shrink-0 rounded-full border-2 border-[color:var(--tone)] bg-[var(--tone)]"
      />
      Used
    </span>
  )
}

// ---------------------------------------------------------------------------
// TpBlock mirror (← PilotSheet.tsx, read state — no steppers).
// ---------------------------------------------------------------------------

function TpBlock({ value }: { value: number }) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: mirrors the shipped TpBlock role="group"
    <div
      role="group"
      aria-label={`TP ${value}`}
      className="flex shrink-0 flex-col items-center gap-1 rounded-[3px] border-2 border-ink bg-paper px-3.5 py-2 text-center"
    >
      <span className="box-decoration-clone inline bg-ink px-[0.5em] pb-[0.16em] pt-[0.1em] font-cond text-[11px] font-bold uppercase leading-[1.5] tracking-widest text-paper">
        TP
      </span>
      <span className="min-w-[1.4em] font-body text-[30px] font-bold leading-[1.05] tabular-nums text-ink">
        {value}
      </span>
      <span className="font-cond text-[8px] font-semibold uppercase leading-none tracking-[0.16em] text-ink/55">
        Training Points
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ConditionsEditor mirror (← ConditionsEditor.tsx, read state).
// ---------------------------------------------------------------------------

const COND_BASE =
  'inline-flex min-h-8 items-center gap-1.5 rounded-[2px] border-2 px-2.5 py-1.5 font-cond text-[10.5px] font-bold uppercase leading-none tracking-caps'

function ConditionsRead({ conditions }: { conditions: { label: string; warn?: boolean }[] }) {
  return (
    <div className="flex min-h-12 flex-wrap items-center gap-1.5 rounded border-chrome border-ink bg-su-paper p-2.5">
      {conditions.length === 0 && <span className="font-mono text-xs text-wk-muted">None</span>}
      {conditions.map((c) => (
        <span
          key={c.label}
          className={`${COND_BASE} ${
            c.warn
              ? 'border-su-sickly-yellow bg-su-sickly-yellow text-ink'
              : 'border-ink bg-ink text-paper'
          }`}
        >
          <span
            aria-hidden="true"
            className={`h-[9px] w-[9px] shrink-0 rounded-full border-2 ${
              c.warn ? 'border-ink bg-ink' : 'border-[color:var(--tone)] bg-[var(--tone)]'
            }`}
          />
          {c.label}
        </span>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Rail chip mirror (← SheetRailParts, approximate) — a linked-unit row.
// ---------------------------------------------------------------------------

function RailChip({ kind, name, spec }: { kind: string; name: string; spec: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-[3px] border-rail border-ink bg-paper px-3 py-2.5">
      <Pill>{kind}</Pill>
      <span className="min-w-0 flex-1 truncate font-cond text-sm font-bold uppercase tracking-caps text-ink">
        {name}
      </span>
      <span className="shrink-0 font-body text-caption text-wk-muted">{spec}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// The sheet
// ---------------------------------------------------------------------------

export type LegacyAbility = { entity: SURefEntity; apCost: number | string; used?: boolean }
export type LegacyEquipment = { entity: SURefEntity; slots: number | string }

export type LiveSheetLegacyPilotProps = {
  abilities: LegacyAbility[]
  equipment: LegacyEquipment[]
}

const ICONBTN =
  'flex size-[38px] shrink-0 items-center justify-center rounded-[3px] border-chrome border-ink bg-paper text-ink'

export function LiveSheetLegacyPilot({ abilities, equipment }: LiveSheetLegacyPilotProps) {
  const slotsUsed = 4
  const slotsCap = 6

  return (
    <div
      className="sheet--pilot min-h-screen"
      style={{ background: 'var(--ground)' }}
      data-variant="pilot"
    >
      {/* ===== Top bar (← LiveSheet.tsx, resting) ===== */}
      <header
        className="sticky top-0 z-20 flex min-h-[58px] flex-wrap items-center gap-x-4 gap-y-1 border-b-2 border-ink px-4 py-2 sm:px-[30px]"
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
        {/* SU cargo mark — real sheet loads /logos/su-cargo-dark.svg; placeholder here. */}
        <span className="flex size-7 shrink-0 items-center justify-center rounded-[2px] bg-ink font-cond text-[10px] font-bold text-paper">
          SU
        </span>
        <div className="ml-auto flex shrink-0 items-center gap-2.5">
          <Btn size="sm" variant="ghost" onClick={() => {}}>
            Share
          </Btn>
          <span className={ICONBTN} aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="currentColor" className="size-[18px]" aria-hidden="true">
              <circle cx="5" cy="12" r="1.6" />
              <circle cx="12" cy="12" r="1.6" />
              <circle cx="19" cy="12" r="1.6" />
            </svg>
          </span>
        </div>
      </header>

      {/* ===== Hero name band (← SheetHero.tsx) ===== */}
      <div className="px-4 pb-1.5 pt-4 sm:px-[30px] sm:pt-[22px]">
        <section
          aria-label="Vesper-9 sheet header"
          className="relative overflow-hidden rounded-[3px] border-entity border-ink"
          style={{ background: 'var(--tone)' }}
        >
          <span className="absolute -top-px left-[18px] bg-ink px-[7px] pb-px pt-[2px] font-cond text-badge font-semibold uppercase leading-none tracking-caps-snug text-paper">
            Pilot
          </span>
          <div className="flex flex-col gap-[18px] px-4 py-[18px] sm:px-5">
            <div className="min-w-0">
              <h1 className="m-0 inline bg-ink box-decoration-clone px-2 font-cond text-[26px] font-bold uppercase leading-[1.28] text-paper sm:text-[31px]">
                Vesper-9 &ldquo;Ghost&rdquo;
              </h1>
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                <Pill>Hybrid Wolf</Pill>
                <Badge>Rank 2</Badge>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* ===== Body poster grid (← PilotSheet.tsx) ===== */}
      <div className="px-4 pb-[34px] pt-[18px] sm:px-[30px] sm:pb-[60px] sm:pt-6">
        <section
          aria-label="Vesper-9 pilot details"
          className="sheet-section @container flex flex-col gap-6"
        >
          {/* R1: Identity ∥ Vitals */}
          <div className="grid grid-cols-1 gap-[22px] @5xl:grid-cols-12 @5xl:gap-6">
            <div className="@5xl:col-span-7">
              <SectionCard title="Identity" controls={<EditControl />}>
                <div className="min-w-0">
                  <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
                    <div className="flex min-w-0 flex-col gap-3">
                      <IdentityField label="Name" value="Vesper-9" />
                      <IdentityField label="Callsign" value="Ghost" />
                      <IdentityField label="Class" value="Hybrid Wolf" />
                      <IdentityField
                        label="Appearance"
                        value="Wiry, hollow-cheeked; a salvaged optic where the left eye was."
                        multiline
                      />
                    </div>
                    <div className="flex min-w-0 flex-col gap-3">
                      <IdentityField
                        label="Motto"
                        value="&ldquo;I was never here.&rdquo;"
                        multiline
                        labelAction={<UsedStamp />}
                      />
                      <IdentityField
                        label="Keepsake"
                        value="A cracked dog-tag, name filed off."
                        multiline
                      />
                      <IdentityField
                        label="Background"
                        value="Union scout, went dark after the Vail-3 collapse."
                        multiline
                      />
                    </div>
                  </div>
                  <div className="mt-3">
                    <IdentityField
                      label="Bio"
                      value="Runs point for the crew. Trusts the mech more than the people in it."
                      multiline
                    />
                  </div>
                </div>
              </SectionCard>
            </div>

            <div className="@5xl:col-span-5">
              <SectionCard title="Vitals">
                <div className="flex w-full flex-col [&>*+*]:mt-[14px] [&>*+*]:border-t [&>*+*]:border-dashed [&>*+*]:border-[color-mix(in_srgb,var(--tone-deep)_40%,transparent)] [&>*+*]:pt-[14px]">
                  <VitalGauge label="HP" value={8} max={10} readOnly />
                  <VitalGauge label="AP" value={3} max={5} readOnly />
                </div>
                <div className="mt-4 flex flex-wrap gap-4 border-t border-dashed border-[color-mix(in_srgb,var(--tone-deep)_40%,transparent)] pt-[14px]">
                  <TpBlock value={4} />
                  <div className="w-full min-w-0 flex-1">
                    <span
                      className="mb-2 block font-cond text-label font-bold uppercase leading-none tracking-caps"
                      style={{ color: 'var(--tone-deep, var(--color-ink))' }}
                    >
                      Conditions
                    </span>
                    <ConditionsRead
                      conditions={[{ label: 'Exposed', warn: true }, { label: 'Prone' }]}
                    />
                  </div>
                </div>
              </SectionCard>
            </div>
          </div>

          {/* R2: Abilities (full width) */}
          <SectionCard
            title="Abilities"
            count={<Stat orientation="horizontal" compact label="Known" value={abilities.length} />}
            controls={<AddControl label="ability" />}
          >
            <Ecflow>
              {abilities.map(({ entity, apCost, used }) => (
                <AbilityCard key={entity.id} entity={entity} apCost={apCost} used={used} />
              ))}
            </Ecflow>
          </SectionCard>

          {/* R3: Inventory (full width) */}
          <SectionCard
            title="Inventory"
            count={
              <span className="font-cond text-label-lg font-bold uppercase tracking-caps text-ink">
                {slotsUsed} / {slotsCap} slots
              </span>
            }
            controls={<AddControl label="equipment" />}
          >
            <Ecflow>
              {equipment.map(({ entity, slots }) => (
                <div key={entity.id} className="min-w-0">
                  <ReferenceEntityCard
                    data={entity}
                    footMeta={[{ label: 'Slots', value: slots }] satisfies CardFootMeta[]}
                  />
                </div>
              ))}
            </Ecflow>
          </SectionCard>

          {/* R4: Linked Units (bare section header + rail) */}
          <div>
            <div className="mb-2 flex min-h-8 flex-wrap items-center gap-x-2.5 gap-y-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className="bg-ink px-2 pb-px pt-[2px] font-cond text-sm font-bold uppercase leading-relaxed tracking-caps text-paper">
                  Linked Units
                </span>
              </div>
              <span
                aria-hidden="true"
                className="h-0 min-w-3 flex-1 border-t-chrome border-ink/35"
              />
            </div>
            <div className="flex flex-col gap-4">
              <RailChip kind="Mech" name="Iron Mongrel" spec="SP 12 · EP 6" />
              <RailChip kind="Crawler" name="The Rust Kettle" spec="TL 3" />
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Ecflow mirror (← Erow.tsx) — max 2-col entity-card grid.
// ---------------------------------------------------------------------------

function Ecflow({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 items-stretch gap-x-[18px] gap-y-[26px] md:grid-cols-2">
      {children}
    </div>
  )
}

/** One ability card (← PilotSheetItems.tsx PilotAbilityItem) with foot meta + resting actions. */
function AbilityCard({
  entity,
  apCost,
  used,
}: {
  entity: SURefEntity
  apCost: number | string
  used?: boolean
}) {
  return (
    <div className="min-w-0">
      <ReferenceEntityCard
        data={entity}
        footMeta={[{ label: 'AP Cost', value: apCost }] satisfies CardFootMeta[]}
        footActions={
          <>
            <Btn size="sm" variant="primary" onClick={() => {}}>
              Spend AP
            </Btn>
            <Btn size="sm" onClick={() => {}}>
              {used ? 'Recharge' : 'Mark Used'}
            </Btn>
          </>
        }
      />
    </div>
  )
}
