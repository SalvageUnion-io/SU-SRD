import type { CSSProperties } from 'react'

export type ChassisBadgeProps = {
  chassisName: string
  patternName?: string
  badgeTextClass: string
}

export function buildBadgeTextClass(compact: boolean): string {
  return compact ? 'text-xs font-normal uppercase' : 'text-base font-semibold uppercase'
}

export function buildChassisBadgeProps(
  chassisName: string | undefined,
  patternName: string | undefined,
  compact: boolean
): ChassisBadgeProps | null {
  if (!chassisName) return null
  return { chassisName, patternName, badgeTextClass: buildBadgeTextClass(compact) }
}

export function buildStripeStyle(
  isBoarded: boolean,
  inDowntime: boolean
): CSSProperties | undefined {
  if (!isBoarded && !inDowntime) return undefined
  const layers = [
    isBoarded &&
      'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(122,151,138,0.45) 10px, rgba(122,151,138,0.45) 20px)',
    inDowntime &&
      'repeating-linear-gradient(-45deg, transparent, transparent 10px, rgba(206,88,152,0.35) 10px, rgba(206,88,152,0.35) 20px)',
  ]
    .filter(Boolean)
    .join(', ')
  return { backgroundImage: layers }
}
