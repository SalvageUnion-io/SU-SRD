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
  /** Optional pseudo-header label on the card frame (e.g. tree name). */
  label?: string
}

/**
 * Wizard multi-select cell (design §3.2 Sel-grid variant): a compact entity
 * card inside a Sel selection-ring wrapper. The card stays selection-agnostic;
 * the 3px rust ring is non-layout-shifting. Disabled cells grey out and drop
 * pointer events; the budget notice renders ONCE in the WizShell footer
 * beside the buttons, never per-card.
 */
export function SelCard({
  entity,
  name,
  selected,
  onToggle,
  disabled = false,
  label,
}: SelCardProps) {
  return (
    <div className={cn(disabled && 'pointer-events-none opacity-50')}>
      <Sel selected={selected} onToggle={disabled ? undefined : onToggle} ariaLabel={name}>
        <ReferenceEntityDisplay
          data={entity as SURefEntity}
          compact
          disabled={disabled}
          hide={{ actions: true, choices: true }}
          label={label}
        />
      </Sel>
    </div>
  )
}
