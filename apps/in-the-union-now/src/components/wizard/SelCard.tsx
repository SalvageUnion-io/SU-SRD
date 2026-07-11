import type { SURefEntity } from 'salvageunion-reference'
import { ReferenceEntityDisplay, Sel } from 'suref-react'
import { cn } from '../../lib/utils'

type SelCardProps = {
  /** The reference entity to render as a compact card. */
  entity: unknown
  /** Card title used for the Sel wrapper's accessible name. */
  name: string
  selected: boolean
  onToggle: () => void
  /** Blocks interaction (budget reached) and greys the card. */
  disabled?: boolean
  /**
   * Why this card is unavailable (mockup `.sel.off` + `.chip.warn`), e.g.
   * 'Needs 6 Slots · 2 Left' — rendered as a cond-caps footMeta chip and dims
   * the card. Inert chrome this phase: nothing drives it until the Phase 3–5
   * rules engines land.
   */
  disabledReason?: string
  /** Optional pseudo-header label on the card frame (e.g. tree name). */
  label?: string
}

/**
 * Wizard multi-select cell (design §3.2 Sel-grid variant, reskinned to the
 * wizard-refresh mockup `.sel` poster look): a compact entity card inside a
 * Sel selection-ring wrapper. The card stays selection-agnostic; the selected
 * ring is the poster's double ink halo (a `var(--ground)` gap inside an ink
 * ring — the CreateModeChooser guided-door treatment), non-layout-shifting.
 * Disabled cells desaturate, grey out, and drop pointer events; the budget
 * notice renders ONCE in the WizShell footer beside the buttons, never
 * per-card — but a per-card `disabledReason` chip names the specific gate.
 */
export function SelCard({
  entity,
  name,
  selected,
  onToggle,
  disabled = false,
  disabledReason,
  label,
}: SelCardProps) {
  const isOff = disabled || disabledReason !== undefined
  return (
    <div className={cn(isOff && 'pointer-events-none opacity-50 saturate-50')}>
      <Sel
        selected={selected}
        onToggle={isOff ? undefined : onToggle}
        ariaLabel={name}
        className={cn(selected && 'shadow-[0_0_0_3px_var(--ground),0_0_0_6px_var(--color-ink)]')}
      >
        <ReferenceEntityDisplay
          data={entity as SURefEntity}
          compact
          disabled={isOff}
          hide={{ actions: true, choices: true }}
          label={label}
          footMeta={disabledReason ? [{ label: disabledReason, value: '' }] : undefined}
        />
      </Sel>
    </div>
  )
}
