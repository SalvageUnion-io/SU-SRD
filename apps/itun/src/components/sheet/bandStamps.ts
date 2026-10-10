/**
 * The second type stamp on a sheet's chapter band (board 10): what kind of
 * pilot, mech or crawler this is — the class, the chassis, the crawler type.
 * `undefined` when the ref does not resolve, and the band shows the kind
 * stamp alone.
 */

import { resolveClassName } from '../../lib/classRef'
import { resolveCrawlerType } from '../../lib/crawlerRefs'
import { mechChassisStats } from '../roster/rowStats'

export function pilotStamp(classRef: string): string | undefined {
  return resolveClassName(classRef) || undefined
}

export function mechStamp(chassisRef: string): string | undefined {
  const chassis = mechChassisStats(chassisRef)?.find((stat) => stat.label === 'Chassis')?.value
  return chassis === undefined ? undefined : String(chassis)
}

export function crawlerStamp(typeRef: string | undefined): string | undefined {
  if (!typeRef) return undefined
  return resolveCrawlerType(typeRef)?.name
}
