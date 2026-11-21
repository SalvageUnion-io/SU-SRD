import type { SheetKind } from 'game-domain/entityKinds'

/**
 * draftExportBundle — a wizard's finished build as a one-unit export bundle,
 * for a reader with no account to keep as a file (the Review step's
 * Download). It is the shape a single unit's Export writes (`ExportBundle`,
 * which `parseImportBundle` holds it to), so the Training Bay's Import… reads
 * it back once there is an account to hold it. The unit
 * gets an id of its own; Import mints a fresh one anyway.
 */
export function draftExportBundle(
  kind: SheetKind,
  input: Record<string, unknown>,
  now: string = new Date().toISOString(),
  id: string = crypto.randomUUID()
) {
  const unit: Record<string, unknown> = { ...input, id, createdAt: now, updatedAt: now }
  const none: Record<string, unknown>[] = []
  return {
    schemaVersion: 2 as const,
    exportedAt: now,
    entities: {
      pilots: kind === 'pilot' ? [unit] : none,
      mechs: kind === 'mech' ? [unit] : none,
      crawlers: kind === 'crawler' ? [unit] : none,
      npcs: none,
    },
    softLinks: none,
    mechPatterns: none,
    encounterNpcs: none,
  }
}
