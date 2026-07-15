import type { ComponentProps } from 'react'
import type { SURefEntity } from 'salvageunion-reference'
import { ReferenceEntityDisplay, Sel, StepBtn } from 'suref-react'
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
   * the card.
   */
  disabledReason?: string
  /** Optional pseudo-header label on the card frame (e.g. tree name). */
  label?: string
  /**
   * Radio semantics for exactly-one pickers (mockup Screen 01 `.selgrid`
   * radiogroup): the Sel ring announces `role="radio"` + `aria-checked`.
   * Pair with `<SelMasonry radio ariaLabel=…>`.
   */
  radio?: boolean
  /**
   * Extra props spread onto the inner ReferenceEntityDisplay — the seam for
   * schema-specific slot overrides (e.g. `useChassisPatternConfig` output for
   * pattern cards, a `subtitleExtra` Pill). Explicit SelCard affordances
   * (footMeta reason chip, footActions counter) win over entries here.
   */
  entityProps?: Partial<ComponentProps<typeof ReferenceEntityDisplay>>
  /**
   * Count-stepper mode (plan §3.1, mockup `.ctr`): when `count` and
   * `onCountChange` are both set, a `[− n +]` pair renders through the entity
   * card's existing footActions band. Duplicates allowed — the caller owns
   * the shared budget and passes `maxCount` (the highest value THIS card may
   * reach right now); at the budget every `+` disables.
   */
  count?: number
  onCountChange?: (next: number) => void
  /** Ceiling for `count` given the shared budget; `+` disables at it. */
  maxCount?: number
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
 * Count-stepper mode attaches a `[− n +]` control via footActions (the seam
 * Erow already proves) — never bespoke chrome outside the card.
 */
export function SelCard({
  entity,
  name,
  selected,
  onToggle,
  disabled = false,
  disabledReason,
  label,
  radio = false,
  entityProps,
  count,
  onCountChange,
  maxCount,
}: SelCardProps) {
  const isOff = disabled || disabledReason !== undefined
  const hasCounter = count !== undefined && onCountChange !== undefined
  const atMax = maxCount !== undefined && count !== undefined && count >= maxCount

  const counter = hasCounter ? (
    <span className="inline-flex items-stretch overflow-hidden rounded-[5px] border-2 border-ink leading-none">
      <StepBtn
        aria-label={`Remove one ${name}`}
        disabled={count === 0}
        onClick={(e) => {
          e.stopPropagation()
          onCountChange(count - 1)
        }}
        className="rounded-none border-0 bg-ink text-paper hover:bg-ink-2"
      >
        −
      </StepBtn>
      {/* Plain readout, not role="spinbutton" — a spinbutton must be
          focusable + arrow-operable, which a static span is not. The value
          is announced via the sr-only live region below; the ± buttons stay
          the operable controls (they carry their own accessible names). */}
      <span
        aria-hidden="true"
        className={cn(
          'grid w-8 place-items-center bg-paper font-cond text-[13px] font-bold text-ink',
          count === 0 && 'opacity-55'
        )}
      >
        {count}
      </span>
      <span role="status" aria-live="polite" className="sr-only">
        {name} count: {count}
      </span>
      <StepBtn
        aria-label={`Add one ${name}`}
        disabled={atMax}
        onClick={(e) => {
          e.stopPropagation()
          onCountChange(count + 1)
        }}
        className="rounded-none border-0 bg-ink text-paper hover:bg-ink-2"
      >
        +
      </StepBtn>
    </span>
  ) : undefined

  return (
    <div className={cn(isOff && 'pointer-events-none opacity-50 saturate-50')}>
      <Sel
        selected={selected}
        onToggle={isOff ? undefined : onToggle}
        ariaLabel={name}
        radio={radio}
        className={cn(selected && 'shadow-[0_0_0_3px_var(--ground),0_0_0_6px_var(--color-ink)]')}
      >
        <ReferenceEntityDisplay
          data={entity as SURefEntity}
          compact
          disabled={isOff}
          hide={{ actions: true, choices: true }}
          label={label}
          {...entityProps}
          footMeta={
            disabledReason
              ? // Append the reason UNDER the existing COSTS/SV line (mockup
                // Screen 02) — don't replace it; the player still sees the price.
                [...(entityProps?.footMeta ?? []), { label: disabledReason, value: '' }]
              : entityProps?.footMeta
          }
          footActions={counter ?? entityProps?.footActions}
        />
      </Sel>
    </div>
  )
}
