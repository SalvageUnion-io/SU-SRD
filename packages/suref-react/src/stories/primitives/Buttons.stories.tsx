import type { Story } from '@ladle/react'
import type { ReactNode } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Btn } from '../../components/chrome/Btn'
import { Sel } from '../../components/chrome/Sel'
import { MiniBtn, StepBtn } from '../../components/chrome/SmallButtons'
import { FilterChip } from '../../components/shared/FilterChip'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Atoms/Button',
}

// Real SRD content — reference data is preloaded by .ladle/components.tsx.
const chassis = SalvageUnionReference.Chassis.all()[0]
const classes = SalvageUnionReference.Classes.all()
const chassisName = chassis?.name ?? 'Chassis'
const structure = chassis?.structurePoints ?? 10
const pilotClassA = classes[0]?.name ?? 'Engineer'
const pilotClassB = classes[1]?.name ?? 'Hacker'

// The `.btn` cva ships four variants (btnVariants.ts). `secondary` / `control`
// are named in the codex but not yet implemented — only the real ones render.
const BTN_VARIANTS = ['default', 'primary', 'ghost', 'danger'] as const
const BTN_SIZES = ['sm', 'md', 'lg'] as const

/** Gauge-story caption: names the variant / prop under each cluster. */
function Cluster({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-cond text-label uppercase tracking-caps text-wk-muted">{label}</span>
      <div className="flex flex-wrap items-start gap-3">{children}</div>
    </div>
  )
}

type BtnVariant = (typeof BTN_VARIANTS)[number]

/**
 * One story per variant: every size (sm/md/lg) plus the disabled treatment
 * (opacity .4, pointer-events none). Labels are sentence-case bodies — a Btn is
 * never a stamp.
 */
function VariantShowcase({ variant, label }: { variant: BtnVariant; label: string }) {
  return (
    <div className="bg-paper p-4">
      <div className="flex flex-col gap-5">
        <Cluster label={`${variant} · sizes`}>
          {BTN_SIZES.map((size) => (
            <Btn key={size} variant={variant} size={size}>
              {label}
            </Btn>
          ))}
        </Cluster>
        <Cluster label={`${variant} · disabled`}>
          <Btn variant={variant} disabled>
            {label}
          </Btn>
        </Cluster>
      </div>
    </div>
  )
}

/** `default` — paper/ink outline, the resting non-action button. */
export const Default: Story = () => <VariantShowcase variant="default" label="Cancel" />

/** `primary` — rust, THE single action colour. */
export const Primary: Story = () => <VariantShowcase variant="primary" label="Commit" />

/** `ghost` — transparent ground, ink text; a low-emphasis action. */
export const Ghost: Story = () => <VariantShowcase variant="ghost" label="Details" />

/** `danger` — the warm bad tone for destructive actions. */
export const Danger: Story = () => <VariantShowcase variant="danger" label="Eject" />

/** Every variant side-by-side at md, plus the disabled row, for a scan. */
export const AllVariants: Story = () => (
  <div className="bg-paper p-4">
    <div className="flex flex-col gap-5">
      <Cluster label="every variant · md">
        {BTN_VARIANTS.map((variant) => (
          <Btn key={variant} variant={variant}>
            {variant}
          </Btn>
        ))}
      </Cluster>
      <Cluster label="every variant · disabled">
        {BTN_VARIANTS.map((variant) => (
          <Btn key={variant} variant={variant} disabled>
            {variant}
          </Btn>
        ))}
      </Cluster>
    </div>
  </div>
)

/**
 * `Sel` — the selection-ring wrapper for wizard entity cards: a 3px rust
 * box-shadow ring that doesn't shift layout. Shown selected + unselected, and
 * in interactive (button/radio) vs static form.
 */
export const Selection: Story = () => {
  const swatch = (children: ReactNode) => (
    <div className="rounded-card border-chrome border-ink bg-paper px-4 py-3 font-body text-caption text-ink">
      {children}
    </div>
  )
  return (
    <div className="bg-paper p-4">
      <div className="flex flex-col gap-5">
        <Cluster label="static (no onToggle)">
          <Sel selected={false}>{swatch('Unselected')}</Sel>
          <Sel selected>{swatch('Selected')}</Sel>
        </Cluster>
        <Cluster label="interactive — button (aria-pressed)">
          <Sel selected={false} onToggle={() => {}} ariaLabel={chassisName}>
            {swatch(chassisName)}
          </Sel>
          <Sel selected onToggle={() => {}} ariaLabel={chassisName}>
            {swatch(chassisName)}
          </Sel>
        </Cluster>
        <Cluster label="interactive — radio (aria-checked)">
          <Sel selected={false} onToggle={() => {}} radio ariaLabel={pilotClassA}>
            {swatch(pilotClassA)}
          </Sel>
          <Sel selected onToggle={() => {}} radio ariaLabel={pilotClassB}>
            {swatch(pilotClassB)}
          </Sel>
        </Cluster>
      </div>
    </div>
  )
}

/**
 * `FilterChip` — facet toggle chip. Active vs inactive in three modes: plain,
 * with a `colorClass` override for the active fill, and `swatchStyle` (tlchip)
 * mode which renders a bordered colour swatch and switches to font-cond.
 */
export const FilterChips: Story = () => (
  <div className="bg-paper p-4">
    <div className="flex flex-col gap-5">
      <Cluster label="plain">
        <FilterChip label="Inactive" active={false} onClick={() => {}} />
        <FilterChip label="Active" active onClick={() => {}} />
      </Cluster>
      <Cluster label="colorClass (active fill override)">
        <FilterChip
          label="Pilot"
          active={false}
          onClick={() => {}}
          colorClass="bg-su-orange text-su-white"
        />
        <FilterChip
          label="Pilot"
          active
          onClick={() => {}}
          colorClass="bg-su-orange text-su-white"
        />
      </Cluster>
      <Cluster label="swatchStyle (tlchip)">
        <FilterChip label="TL1" active={false} onClick={() => {}} swatchStyle="#8bbf5a" />
        <FilterChip label="TL1" active onClick={() => {}} swatchStyle="#8bbf5a" />
        <FilterChip label="TL6" active={false} onClick={() => {}} swatchStyle="#c0563b" />
      </Cluster>
    </div>
  </div>
)

/**
 * `StepBtn` — the 24×24 stat stepper (−/+) that flanks a StatBlock value.
 * Enabled pair + disabled pair (at a min/max bound).
 */
export const StepButtons: Story = () => (
  <div className="bg-paper p-4">
    <div className="flex flex-col gap-5">
      <Cluster label="enabled −/+ pair">
        <StepBtn aria-label="Decrease Structure">–</StepBtn>
        <StepBtn aria-label="Increase Structure">+</StepBtn>
      </Cluster>
      <Cluster label={`in context (SP ${structure})`}>
        <div className="flex items-center gap-2">
          <StepBtn aria-label="Decrease Structure">–</StepBtn>
          <span className="font-body text-lede font-bold tabular-nums text-ink">{structure}</span>
          <StepBtn aria-label="Increase Structure">+</StepBtn>
        </div>
      </Cluster>
      <Cluster label="disabled at bound">
        <StepBtn aria-label="Decrease Structure" disabled>
          –
        </StepBtn>
        <StepBtn aria-label="Increase Structure" disabled>
          +
        </StepBtn>
      </Cluster>
    </div>
  </div>
)

/**
 * `MiniBtn` — tiny uppercase rail action (e.g. '⇄ Swap'). Default + disabled.
 */
export const MiniButtons: Story = () => (
  <div className="bg-paper p-4">
    <div className="flex flex-col gap-5">
      <Cluster label="default">
        <MiniBtn>⇄ Swap</MiniBtn>
        <MiniBtn>Remove</MiniBtn>
        <MiniBtn>Details</MiniBtn>
      </Cluster>
      <Cluster label="disabled">
        <MiniBtn disabled>⇄ Swap</MiniBtn>
      </Cluster>
    </div>
  </div>
)
