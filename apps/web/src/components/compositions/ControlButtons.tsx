import type { CSSProperties } from 'react'
import { useCallback } from 'react'
import { iconSize, space } from '../../design/tokens'
import { Badge } from '../atoms/Badge'
import { Button } from '../atoms/Button'
import type {
  ReferenceEntityControl,
  ReferenceEntityControlVariant,
} from '../referenceEntity/referenceEntityControlTypes'
import { StatusBadge } from './StatusBadge'

/**
 * A worded control's Button: `primary` and `danger` fill ink (no state colour
 * fills a button, ruleset §3.1, hard rule R9; rust is the icon Remove's, below,
 * and the `StatusRail`'s), `ghost` is the paper button.
 */
const WORDED = {
  primary: 'ink',
  danger: 'ink',
  ghost: 'default',
} as const satisfies Record<ReferenceEntityControlVariant, string>

const ROW = { display: 'flex', gap: space[4] } satisfies CSSProperties

type ControlButtonsProps = {
  controls: ReferenceEntityControl[]
}

function ControlButton({
  control,
  onClickWithStop,
}: {
  control: ReferenceEntityControl
  onClickWithStop: (e: React.MouseEvent, onClick: () => void) => void
}) {
  // Typed item variants — render a primitive instead of an action button.
  // Precedence: badge → status → link → button (a stepper is the rail's `Stat`).
  if (control.badge !== undefined) {
    return (
      <Badge shape="stamp" size="mini">
        {control.badge}
      </Badge>
    )
  }
  if (control.status) {
    return (
      <StatusBadge
        status={control.status.value}
        onClick={control.status.onClick}
        subject={control.status.subject}
      />
    )
  }
  // Every rail control is the Mini Button: the rail sits beside the card's
  // seam stamp, and one row carries one Size (ruleset §4.7).
  if (control.href !== undefined) {
    return (
      <Button
        href={control.href}
        aria-label={control.ariaLabel}
        size="mini"
        className={control.className}
      >
        {control.label ?? control.ariaLabel}
      </Button>
    )
  }
  const variant = control.variant ?? 'primary'
  const isDisabled = !!control.disabled
  const onClick = control.onClick ?? (() => undefined)
  const shared = {
    size: 'mini',
    className: control.className,
    title: control.title ?? control.ariaLabel,
    'aria-label': control.ariaLabel,
    'aria-expanded': control.ariaExpanded,
    'aria-controls': control.ariaControls,
    disabled: isDisabled,
    'aria-disabled': isDisabled || undefined,
    onClick: isDisabled ? undefined : (e: React.MouseEvent) => onClickWithStop(e, onClick),
  } as const

  // Icon-only control (design-spec `.ctl`) — the live-sheet per-card
  // remove/swap/fold cluster: the glyph sized to the label line it replaces,
  // so an icon button and a worded one are interchangeable in the row.
  //
  // It carries NO tap-target floor of its own. `theme.css` applies a
  // POINTER-keyed 44px floor to every `button` under `@media (pointer:
  // coarse)`, unlayered, so it beats every layered rule at every width. A
  // WIDTH-keyed floor (`min-h-11 min-w-11 sm:min-h-0 sm:min-w-0`) would only
  // add a touch floor to a mouse — a narrow desktop window, a responsive-mode
  // preview, a small laptop — the one case the pointer rule skips.
  //
  // That distorts the geometry. This button renders inside `CardControlRail`,
  // an ABSOLUTE row centred on a card's top frame line, so a 44px box grows the
  // rail with it, hanging down into the header band over the TL/SV stat cells
  // the rail stacks above, a 44px square beside a 22px status badge in a row
  // whose whole premise is that every cell is the same stamp height.
  //
  // Measure this with touch emulation, not just a narrow viewport — the two
  // disagree here, and a fine-pointer run alone will tell you a coarse-pointer
  // change worked when it did nothing.
  //
  // A `danger` icon (the ✕ remove) is Button's rust `primary` — filled, not
  // outlined — because it is the one control in the rail that destroys
  // something, and as neutral paper chrome it read like the fold chevron
  // beside it. Rust, never a state colour (ruleset §3.1, hard rule R9).
  const Icon = control.icon
  if (Icon && !control.label) {
    return (
      <Button variant={variant === 'danger' ? 'primary' : 'default'} {...shared}>
        {/* A Mini control, so a Mini glyph (hard rule R23). */}
        <Icon size={iconSize.mini} />
      </Button>
    )
  }

  return (
    <Button variant={WORDED[variant]} {...shared}>
      {control.label ?? control.ariaLabel}
    </Button>
  )
}

export function ControlButtons({ controls }: ControlButtonsProps) {
  const handleClick = useCallback((e: React.MouseEvent, onClick: () => void) => {
    // preventDefault so a control nested inside a wrapping navigation <a> (e.g.
    // the schema list cards) doesn't also trigger that anchor's navigation; a
    // no-op for the standalone case. stopPropagation keeps it off onCardClick.
    e.preventDefault()
    e.stopPropagation()
    onClick()
  }, [])

  const visibleControls = controls.filter((c) => !c.hidden)

  if (visibleControls.length === 0) return null

  return (
    <div style={ROW}>
      {visibleControls.map((control) => (
        <ControlButton key={control.key} control={control} onClickWithStop={handleClick} />
      ))}
    </div>
  )
}
