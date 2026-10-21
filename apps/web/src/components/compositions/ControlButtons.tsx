import type { MouseEvent, ReactNode } from 'react'
import { iconSize } from '../../design/tokens'
import { Badge } from '../atoms/Badge'
import { Button } from '../atoms/Button'
import { StatusBadge } from '../atoms/StatusBadge'
import type {
  ReferenceEntityControl,
  ReferenceEntityControlVariant,
} from '../referenceEntity/referenceEntityControlTypes'

/**
 * A worded control's Button: `primary` and `danger` fill ink (no state colour
 * fills a button, ruleset §3.1, hard rule R9; rust is the icon Remove's,
 * below), `ghost` is the paper button.
 */
const WORDED = {
  primary: 'ink',
  danger: 'ink',
  ghost: 'default',
} as const satisfies Record<ReferenceEntityControlVariant, string>

/**
 * preventDefault so a control nested inside a wrapping navigation <a> doesn't
 * also trigger that anchor's navigation; stopPropagation keeps it off the
 * card's own click (`onCardClick`).
 */
function onClickWithStop(e: MouseEvent, onClick: () => void) {
  e.preventDefault()
  e.stopPropagation()
  onClick()
}

/** One control as its chip: a plain function (no hooks), keyed by the control. */
function controlChip(control: ReferenceEntityControl): ReactNode {
  const { key } = control
  // Typed item variants — render a primitive instead of an action button.
  // Precedence: badge → status → link → button (a stepper is the state slot's `Stat`).
  if (control.badge !== undefined) {
    return (
      <Badge key={key} shape="stamp" size="mini">
        {control.badge}
      </Badge>
    )
  }
  if (control.status) {
    return (
      <StatusBadge
        key={key}
        status={control.status.value}
        onClick={control.status.onClick}
        subject={control.status.subject}
        next={control.status.next}
      />
    )
  }
  // Every control is the Mini Button, drawn a chip's height in the head's
  // chip group: one line carries one Size (ruleset §4.7, hard rule R6).
  if (control.href !== undefined) {
    return (
      <Button
        key={key}
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
    disabled: isDisabled,
    'aria-disabled': isDisabled || undefined,
    onClick: isDisabled ? undefined : (e: MouseEvent) => onClickWithStop(e, onClick),
  } as const

  // Icon-only control (design-spec `.ctl`) — the live-sheet per-card
  // remove/swap/fold cluster: the glyph sized to the label line it replaces,
  // so an icon button and a worded one are interchangeable in the strip. It
  // carries no tap-target floor of its own: `theme.css`'s pointer-keyed 44px
  // floor and the strip's Mini plate (hard rule R6) give it its hit area.
  //
  // A `danger` icon (the ✕ remove) is Button's rust `primary` — filled, not
  // outlined — because it is the one control in the strip that destroys
  // something, and as neutral paper chrome it read like the fold chevron
  // beside it. Rust, never a state colour (ruleset §3.1, hard rule R9).
  const Icon = control.icon
  if (Icon && !control.label) {
    return (
      <Button key={key} variant={variant === 'danger' ? 'primary' : 'default'} {...shared}>
        {/* A Mini control, so a Mini glyph (hard rule R23). */}
        <Icon size={iconSize.mini} />
      </Button>
    )
  }

  return (
    <Button key={key} variant={WORDED[variant]} {...shared}>
      {control.label ?? control.ariaLabel}
    </Button>
  )
}

/**
 * A card's controls as chips (`chips-and-actions.md` C8, hard rule R6): one
 * node per visible control, each its own chip in the head's chip group, so
 * the strip keeps one even gap and counts each one (`Chips`).
 */
export function controlChips(controls: readonly ReferenceEntityControl[]): ReactNode[] {
  return controls.filter((c) => !c.hidden).map(controlChip)
}
