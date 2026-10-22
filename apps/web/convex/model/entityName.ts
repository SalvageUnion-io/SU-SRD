import type { EntityKind } from 'game-domain/entityKinds'

/**
 * What every server surface calls an entity: a pilot by its callsign, then its
 * name (the crew calls them by callsign), anything else by its name. Trimmed,
 * and null when the body carries none, so each caller picks its own fallback.
 *
 * The name lives in the opaque body Convex cannot validate (ADR-030), so the
 * shape is not trusted.
 */
export function entityNameOf(kind: EntityKind, body: unknown): string | null {
  const fields = kind === 'pilot' ? (['callsign', 'name'] as const) : (['name'] as const)
  const record = body as Record<string, unknown> | null | undefined
  for (const field of fields) {
    const value = record?.[field]
    if (typeof value === 'string' && value.trim().length > 0) return value.trim()
  }
  return null
}
