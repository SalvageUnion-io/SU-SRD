import type { SURefMetaEntity } from 'salvageunion-reference'

/**
 * `Intl` instance built once, pinned to `en-US`. The dataset and the rulebook
 * are English, and the card is server-rendered by srd's static build — a
 * locale-sensitive format would make the built HTML depend on the build
 * machine's locale.
 */
const GROUPED = new Intl.NumberFormat('en-US')

/**
 * The population band a Union Crawler tech level covers, formatted the way the
 * book's tech-level table prints it (Workshop Manual p.218).
 *
 * `populationMax: 0` is the dataset's "unbounded" marker — only the Megacity
 * Crawler carries it, and the book states that tier open-ended, so it formats as
 * `25,000+` rather than as a range ending at zero.
 *
 * Returns `undefined` for every entity that is not a crawler tech level, so the
 * caller can spread the result into a cell list unconditionally. The check is on
 * the DATA SHAPE, not the schema name, per the display-system rule.
 */
export function crawlerPopulationRange(entity: SURefMetaEntity): string | undefined {
  if (!('populationMin' in entity) || typeof entity.populationMin !== 'number') return undefined
  const min = entity.populationMin
  const max =
    'populationMax' in entity && typeof entity.populationMax === 'number' ? entity.populationMax : 0
  // En dash, the range separator the book uses — not a hyphen.
  return max > 0 ? `${GROUPED.format(min)}–${GROUPED.format(max)}` : `${GROUPED.format(min)}+`
}
