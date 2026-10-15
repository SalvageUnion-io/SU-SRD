import type { CSSProperties, MouseEvent, ReactNode } from 'react'
import { cn } from '../../../lib/cn'
import { Badge } from '../../atoms/Badge'
import { FOCUS_RING } from '../../atoms/interaction'
import { RadioCard } from '../../containers/RadioCardGroup'
import type { EntityMode } from '../types'

type SelectMode = Extract<EntityMode, { kind: 'select' }>

/** SELECT's seal in the head's right slot: "Selected", ink. */
export function SelectedSeal({ word = 'Selected' }: { word?: string }) {
  return (
    <Badge
      shape="stamp"
      size="mini"
      surface="inverse"
      style={{ flex: 'none', pointerEvents: 'none', whiteSpace: 'nowrap' }}
    >
      {word}
    </Badge>
  )
}

/** The toggle's checkbox: the WCAG 2.2 minimum target, no shrinking in the head. */
const CHECK = {
  flex: 'none',
  height: 'var(--space-24)',
  margin: 0,
  width: 'var(--space-24)',
} satisfies CSSProperties

/**
 * SELECT's control in `toggle` mode: a real `<input type="checkbox">` in the
 * head, named for what choosing does. It is the surface's one keyboard and
 * screen-reader path; `accent` paints its check in the head's own foreground
 * so it reads on an ink band and a tone band alike. Its click stops at the box,
 * so the surface's pointer convenience never toggles it a second time.
 */
export function SelectCheck({
  mode,
  label,
  accent,
}: {
  mode: SelectMode
  label: string
  accent: string
}) {
  return (
    <input
      type="checkbox"
      checked={mode.selected}
      onChange={mode.onSelect}
      onClick={(e: MouseEvent) => e.stopPropagation()}
      aria-label={label}
      className={FOCUS_RING}
      style={{ ...CHECK, accentColor: accent, cursor: 'pointer' }}
    />
  )
}

/**
 * SELECT's surface. `radio` is a `RadioCard` (`role="radio"`, `aria-checked`,
 * the arrow keys inside a `RadioCardGroup`). `toggle` is a plain element whose
 * click is a POINTER convenience only — no role, tab stop or name — because
 * the real control is the `SelectCheck` checkbox inside it: a `role="button"`
 * surface would nest that checkbox in another control and turn the Row's
 * facts and traits presentational.
 */
export function SelectSurface({
  mode,
  label,
  className,
  style,
  children,
}: {
  mode: SelectMode
  label: string
  className: string
  style?: CSSProperties
  children: ReactNode
}) {
  if (mode.role === 'radio') {
    return (
      <RadioCard
        selected={mode.selected}
        onSelect={mode.onSelect}
        className={cn(className, FOCUS_RING)}
        style={{ ...style, cursor: 'pointer' }}
        aria-label={label}
      >
        {children}
      </RadioCard>
    )
  }
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: a pointer convenience; the SelectCheck checkbox inside is the control
    // biome-ignore lint/a11y/useKeyWithClickEvents: the keyboard path is the SelectCheck checkbox inside
    <div className={className} style={{ ...style, cursor: 'pointer' }} onClick={mode.onSelect}>
      {children}
    </div>
  )
}
