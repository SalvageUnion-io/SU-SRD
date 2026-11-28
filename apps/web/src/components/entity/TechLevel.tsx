import { entityCopy } from '../../messages/components-entity'
import type { CSSVarStyle } from '../../styles/cssVars'

/** A Tech Level as a chip on paper, framed in its colour on the map (§3.8). */
export function TechLevel({ level }: { level: number | string | undefined }) {
  if (level === undefined || level === '') return null
  const key = typeof level === 'number' ? level : String(level).toLowerCase()
  return (
    <span
      className="su-tl"
      style={{ '--tl': `var(--color-tl-${key})` } as CSSVarStyle}
      title={entityCopy('techLevelN', { level: String(level) })}
    >
      {level}
    </span>
  )
}
