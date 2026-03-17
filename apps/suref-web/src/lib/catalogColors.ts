const techLevelGradient = [1, 2, 3, 4, 5, 6]
  .map((tl, i, arr) => {
    const start = ((i / arr.length) * 100).toFixed(1)
    const end = (((i + 1) / arr.length) * 100).toFixed(1)
    return `var(--color-tl-${tl}) ${start}%, var(--color-tl-${tl}) ${end}%`
  })
  .join(', ')

const techLevelBg = `linear-gradient(to right, ${techLevelGradient})`

const abilityGradient =
  'linear-gradient(to right, var(--color-su-orange) 0%, var(--color-su-orange) 33%, var(--color-su-orange-dark) 33%, var(--color-su-orange-dark) 66%, var(--color-su-pink) 66%, var(--color-su-pink) 100%)'

const classGradient =
  'linear-gradient(to right, var(--color-su-orange) 0%, var(--color-su-orange) 60%, var(--color-su-pink) 60%, var(--color-su-pink) 100%)'

const schemaColors: Record<string, string> = {
  chassis: 'var(--color-su-green-dark)',
  classes: classGradient,
  systems: techLevelBg,
  modules: techLevelBg,
  equipment: techLevelBg,
  drones: techLevelBg,
  vehicles: techLevelBg,
  crawlers: 'var(--color-su-pink)',
  'crawler-bays': 'var(--color-su-pink)',
  'crawler-tech-levels': 'var(--color-su-pink)',
  creatures: 'var(--color-su-rust)',
  'bio-titans': 'var(--color-su-rust)',
  factions: 'var(--color-su-rust)',
  npcs: 'var(--color-su-rust)',
  meld: 'var(--color-su-rust)',
  squads: 'var(--color-su-rust)',
  'roll-tables': 'var(--color-su-grey-dark)',
  keywords: 'var(--color-su-grey-dark)',
  distances: 'var(--color-su-grey-dark)',
  sources: 'var(--color-su-grey-dark)',
  'tech-levels': 'var(--color-su-grey-dark)',
  traits: 'var(--color-su-grey-dark)',
  guides: 'var(--color-su-grey-dark)',
}

export function getCatalogBg(schemaId: string): string {
  if (schemaId === 'abilities') return abilityGradient
  return schemaColors[schemaId] || 'var(--color-su-orange)'
}

const schemaLabelColors: Record<string, string> = {
  equipment: 'var(--color-su-orange-dark)',
  systems: 'var(--color-su-green-dark)',
  modules: 'var(--color-su-green-dark)',
  drones: 'var(--color-su-rust)',
  vehicles: 'var(--color-su-rust)',
}

export function getCatalogLabel(schemaId: string): string | undefined {
  return schemaLabelColors[schemaId]
}
