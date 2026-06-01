type CustomCargoCategory = {
  value: string
  label: string
  headerBg: string
}

export const CUSTOM_CARGO_CATEGORIES: CustomCargoCategory[] = [
  { value: 'systems', label: 'Systems', headerBg: 'bg-su-orange' },
  { value: 'modules', label: 'Modules', headerBg: 'bg-su-orange' },
  { value: 'chassis', label: 'Chassis', headerBg: 'bg-su-green' },
  { value: 'other', label: 'Other', headerBg: 'bg-su-orange' },
]

const TL_BG_MAP: Record<string, string> = {
  '1': 'bg-tl-1',
  '2': 'bg-tl-2',
  '3': 'bg-tl-3',
  '4': 'bg-tl-4',
  '5': 'bg-tl-5',
  '6': 'bg-tl-6',
  B: 'bg-su-sickly-yellow',
  N: 'bg-su-silver',
}

/** Categories that show tech-level-based header colors */
const TL_COLOR_CATEGORIES = new Set(['systems', 'modules'])

/**
 * Returns the Tailwind bg class for a custom cargo item's header.
 * Tech items with a tech level use TL-based blues.
 * Chassis always green, everything else orange.
 */
export function getCustomItemHeaderBg(category?: string, techLevel?: string | number): string {
  if (!category || category === 'other') return 'bg-su-orange'
  if (category === 'chassis') return 'bg-su-green'

  // Tech items with a tech level override to TL-based color
  if (TL_COLOR_CATEGORIES.has(category) && techLevel !== undefined) {
    const key = String(techLevel)
    if (TL_BG_MAP[key]) return TL_BG_MAP[key]
  }

  // Fallback: use the category's default
  const cat = CUSTOM_CARGO_CATEGORIES.find((c) => c.value === category)
  return cat?.headerBg ?? 'bg-su-orange'
}

type CategoryFieldConfig = {
  techLevel?: boolean
  salvageValue?: boolean
  slotsRequired?: boolean
  structurePoints?: boolean
  energyPoints?: boolean
  heatCapacity?: boolean
  description?: boolean
}

const CATEGORY_FIELDS: { [key: string]: CategoryFieldConfig | undefined } = {
  systems: { techLevel: true, salvageValue: true, slotsRequired: true, description: true },
  modules: { techLevel: true, salvageValue: true, slotsRequired: true, description: true },
  chassis: {
    techLevel: true,
    salvageValue: true,
    structurePoints: true,
    energyPoints: true,
    heatCapacity: true,
    description: true,
  },
  other: { salvageValue: true, description: true },
}

const DEFAULT_FIELDS: CategoryFieldConfig = { salvageValue: true, description: true }

/** Returns which fields are relevant for a given category */
export function getCategoryFields(category: string): CategoryFieldConfig {
  return CATEGORY_FIELDS[category] ?? DEFAULT_FIELDS
}
