import type { ComponentPropsWithRef, CSSProperties, ReactNode } from 'react'
import {
  borderWidth,
  color,
  duration,
  ease,
  font,
  fontSize,
  radius,
  space,
  weight,
} from '../../design/tokens'
import { cn } from '../../lib/cn'
import { FOCUS_RING } from './interaction'

/**
 * SWITCH — a setting that is on or off, drawn as one: a track whose block
 * slides to the right and fills ink when on. `role="switch"` and
 * `aria-checked` carry the state; its words, beside the track, never change.
 *
 * For a standing setting (share a pattern on the Reference). A press that acts
 * on a sheet or a view is a `Toggle`; one of several is a `Radio` or
 * `Segmented`.
 */

const TRACK_W = 34
const TRACK_H = 18
const BLOCK = 12
/** The block's travel: the track's inner width less the block and its two insets. */
const TRAVEL = TRACK_W - BLOCK - 2 * 2 - 2 * 1.5

const ROW = {
  alignItems: 'center',
  background: 'none',
  border: 0,
  color: color.ink,
  cursor: 'pointer',
  display: 'inline-flex',
  fontFamily: font.body,
  fontSize: fontSize.sm,
  fontWeight: weight.bold,
  gap: space[8],
  lineHeight: 'calc(1.25 / 0.875)',
  padding: 0,
  textAlign: 'left',
} satisfies CSSProperties

const TRACK = {
  alignItems: 'center',
  borderColor: color.ink,
  borderRadius: radius.badge,
  borderStyle: 'solid',
  borderWidth: borderWidth.chrome,
  boxSizing: 'border-box',
  display: 'inline-flex',
  flexShrink: 0,
  height: TRACK_H,
  padding: space[2],
  transition: `background-color ${duration.fast} ${ease}`,
  width: TRACK_W,
} satisfies CSSProperties

const BLOCK_STYLE = {
  borderRadius: radius.pip,
  height: BLOCK,
  transition: `transform ${duration.fast} ${ease}, background-color ${duration.fast} ${ease}`,
  width: BLOCK,
} satisfies CSSProperties

export function Switch({
  checked,
  className,
  style,
  children,
  ...rest
}: Omit<ComponentPropsWithRef<'button'>, 'type' | 'role' | 'aria-checked'> & {
  checked: boolean
  /** Its words: what is on when it is on. */
  children: ReactNode
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={cn(FOCUS_RING, className)}
      style={{ ...ROW, ...style }}
      {...rest}
    >
      <span
        aria-hidden="true"
        style={{ ...TRACK, backgroundColor: checked ? color.ink : color.paper }}
      >
        <span
          style={{
            ...BLOCK_STYLE,
            backgroundColor: checked ? color.paper : color.ink,
            transform: checked ? `translateX(${TRAVEL}px)` : 'none',
          }}
        />
      </span>
      {children}
    </button>
  )
}
