import type { CardDomain } from '../components/referenceEntity/card/entityCardTone'
import { resolveSchemaDomain } from '../components/referenceEntity/card/entityCardTone'

const techLevelGradient = [1, 2, 3, 4, 5, 6]
  .map((tl, i, arr) => {
    const start = ((i / arr.length) * 100).toFixed(1)
    const end = (((i + 1) / arr.length) * 100).toFixed(1)
    return `var(--color-tl-${tl}) ${start}%, var(--color-tl-${tl}) ${end}%`
  })
  .join(', ')

const techLevelBg = `linear-gradient(to right, ${techLevelGradient})`

/** The three ability tiers, in book order: Core (brick) · Advanced (orange) · Legendary (pink). */
const abilityGradient =
  'linear-gradient(to right, var(--color-tier-core) 0%, var(--color-tier-core) 33%, var(--color-pilot) 33%, var(--color-pilot) 66%, var(--color-crawler) 66%, var(--color-crawler) 100%)'

/** Core classes vs the hybrid classes they branch into. */
const classGradient =
  'linear-gradient(to right, var(--color-pilot) 0%, var(--color-pilot) 60%, var(--color-crawler) 60%, var(--color-crawler) 100%)'

/**
 * Catalog tile background PER DOMAIN. The schema → domain grouping itself is
 * NOT restated here — it comes from `resolveSchemaDomain` in component-lib, so
 * a new schema can't silently fall through to a wrong default the way a
 * hand-keyed schema list allowed (the card had exactly that bug).
 *
 * `gear` rides the tech-level ramp, matching how gear entities are toned.
 */
const DOMAIN_BG: Record<CardDomain, string> = {
  pilot: 'var(--color-pilot)',
  mech: 'var(--color-mech-dark)',
  crawler: 'var(--color-crawler)',
  actor: 'var(--color-adversary)',
  gear: techLevelBg,
  glossary: 'var(--color-ink-2)',
  // Actions never appear as a catalog tile; they have no schema of their own.
  action: 'var(--color-adversary)',
}

/**
 * Two schemas get a gradient rather than their flat domain colour, because the
 * tile is standing in for a whole SPREAD of entities rather than one hue:
 * abilities span the three tiers, classes span core → hybrid.
 */
export function getCatalogBg(schemaId: string): string {
  if (schemaId === 'abilities') return abilityGradient
  if (schemaId === 'classes') return classGradient
  const domain = resolveSchemaDomain(schemaId)
  return domain ? DOMAIN_BG[domain] : 'var(--color-pilot)'
}

/**
 * Tiles whose background is a GRADIENT need their name on a solid chip to stay
 * legible. Keyed off the domain for the same reason as above.
 */
const schemaLabelColors: Record<string, string> = {
  equipment: 'var(--color-rust)',
  systems: 'var(--color-mech-dark)',
  modules: 'var(--color-mech-dark)',
  drones: 'var(--color-adversary)',
  vehicles: 'var(--color-adversary)',
}

export function getCatalogLabel(schemaId: string): string | undefined {
  return schemaLabelColors[schemaId]
}
