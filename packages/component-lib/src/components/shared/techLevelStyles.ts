export const TECH_LEVEL_STYLES: Record<string, string> = {
  '1': 'bg-tl-1 text-ink',
  '2': 'bg-tl-2 text-ink',
  '3': 'bg-tl-3 text-paper',
  '4': 'bg-tl-4 text-paper',
  '5': 'bg-tl-5 text-paper',
  '6': 'bg-tl-6 text-paper',
  B: 'bg-su-sickly-yellow text-ink',
  N: 'bg-su-silver text-ink',
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
  if (tl === 'N') return 'NANITE'
  return `TL${tl}`
}
