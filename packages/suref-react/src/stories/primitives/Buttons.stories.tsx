import type { Story } from '@ladle/react'
import type { ReactNode } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Btn } from '../../components/chrome/Btn'
import { Sel } from '../../components/chrome/Sel'
import { MiniBtn, StepBtn } from '../../components/chrome/SmallButtons'
import { FilterChip } from '../../components/shared/FilterChip'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Primitives/Buttons',
}

// Real SRD content — reference data is preloaded by .ladle/components.tsx.
const chassis = SalvageUnionReference.Chassis.all()[0]
const classes = SalvageUnionReference.Classes.all()
const chassisName = chassis?.name ?? 'Chassis'
const structure = chassis?.structurePoints ?? 10
const pilotClassA = classes[0]?.name ?? 'Engineer'
const pilotClassB = classes[1]?.name ?? 'Hacker'

const BTN_VARIANTS = ['default', 'primary', 'ghost', 'danger'] as const
const BTN_SIZES = ['sm', 'md', 'lg'] as const

function Cluster({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-ink/60">
        {label}
      </span>
      <div className="flex flex-wrap items-start gap-3">{children}</div>
    </div>
  )
}

/**
 * `Btn` — the app-chrome `.btn` (btnVariants cva): every variant × size, plus
 * the disabled treatment (opacity .4, no pointer events). `primary` is rust,
 * the single action colour; `danger` is the warm bad tone.
 */
export const Buttons: Story = () => (
  <div className="bg-paper p-4">
    <div className="flex flex-col gap-5">
      {BTN_SIZES.map((size) => (
        <Cluster key={size} label={`size: ${size}`}>
          {BTN_VARIANTS.map((variant) => (
            <Btn key={variant} variant={variant} size={size}>
              {variant}
            </Btn>
          ))}
        </Cluster>
      ))}
      <Cluster label="disabled (each variant)">
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
    <div className="rounded-[4px] border-chrome border-ink bg-paper px-4 py-3 font-body text-[13px] text-ink">
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
          <span className="font-body text-[15px] font-bold tabular-nums text-ink">{structure}</span>
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
