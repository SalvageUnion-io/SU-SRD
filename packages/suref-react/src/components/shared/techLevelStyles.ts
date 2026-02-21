export const TECH_LEVEL_STYLES: Record<string, string> = {
  '1': 'bg-tl-1 text-su-black',
  '2': 'bg-tl-2 text-su-black',
  '3': 'bg-tl-3 text-su-white',
  '4': 'bg-tl-4 text-su-white',
  '5': 'bg-tl-5 text-su-white',
  '6': 'bg-tl-6 text-su-white',
  B: 'bg-su-sickly-yellow text-su-black',
  N: 'bg-su-silver text-su-black',
}

/** Background-only classes for numeric tech levels (used by calculateBackgroundColor) */
export const TECH_LEVEL_BG: Record<number, string> = {
  1: 'bg-tl-1',
  2: 'bg-tl-2',
  3: 'bg-tl-3',
  4: 'bg-tl-4',
  5: 'bg-tl-5',
  6: 'bg-tl-6',
}

export function techLevelLabel(tl: number | 'B' | 'N'): string {
  if (tl === 'B') return 'BIO'
  if (tl === 'N') return 'NPC'
  return `TL${tl}`
}
