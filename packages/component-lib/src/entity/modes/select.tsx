import type { CSSProperties, ReactNode } from 'react'
import { Badge } from '../../components/atoms/Badge'
import { activateOnKey, FOCUS_RING } from '../../components/atoms/interaction'
import { RadioCard } from '../../components/containers/RadioCardGroup'
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

/**
 * SELECT's surface: the whole form toggles. `radio` is a `RadioCard`
 * (`role="radio"`, `aria-checked`, the arrow keys inside a `RadioCardGroup`);
 * `toggle` is a button with `aria-pressed`. Enter and Space select.
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
  const cls = `${className} ${FOCUS_RING}`
  const surfaceStyle = { ...style, cursor: 'pointer' }
  if (mode.role === 'radio') {
    return (
      <RadioCard
        selected={mode.selected}
        onSelect={mode.onSelect}
        className={cls}
        style={surfaceStyle}
        aria-label={label}
      >
        {children}
      </RadioCard>
    )
  }
  return (
    // biome-ignore lint/a11y/useSemanticElements: the surface holds block content (the head and the body), which a <button> may not
    <div
      role="button"
      tabIndex={0}
      aria-pressed={mode.selected}
      aria-label={label}
      className={cls}
      style={surfaceStyle}
      onClick={mode.onSelect}
      onKeyDown={activateOnKey(mode.onSelect)}
    >
      {children}
    </div>
  )
}
