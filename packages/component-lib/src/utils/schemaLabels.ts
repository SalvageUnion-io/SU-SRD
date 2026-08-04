/**
 * Human-readable labels for a schema id.
 *
 * Search results carry `schemaTitle`, which is the RAW catalog title — and
 * every title in `schemas/index.json` is the kebab-case schema id itself
 * ('crawler-bays', 'npcs'). None has ever carried a 'Salvage Union ' prefix,
 * so the `schemaTitle.replace('Salvage Union ', '')` that used to label these
 * rows was a no-op that printed raw ids beside the authored category labels —
 * one dropdown spelling every schema two ways.
 *
 * The package already ships the authored plural (`displayNamePlural`, from
 * `schemaDisplayNames`), and it has the irregulars right: NPCs, Bio-Titans,
 * Chassis, Equipment. Resolve labels from the schema id through here so every
 * surface spells a schema the same way.
 */
import { getSchemaCatalog } from 'salvageunion-reference'

/** Lazily built from the static schema catalog (no `preload()` required). */
let pluralLabels: Map<string, string> | undefined

/**
 * Authored plural label for a schema id — 'crawler-bays' → 'Crawler Bays'.
 * Covers meta schemas too: a label says nothing about whether a page exists.
 * Falls back to the id for an unknown schema.
 */
export function schemaPluralLabel(schemaId: string): string {
  if (!pluralLabels) {
    pluralLabels = new Map(getSchemaCatalog().schemas.map((s) => [s.id, s.displayNamePlural]))
  }
  return pluralLabels.get(schemaId) ?? schemaId
}
