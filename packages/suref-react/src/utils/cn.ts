import { type ClassValue, clsx } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * tailwind-merge extended with the custom utilities the SU theme registers
 * (ITUN design-review T-5). Without this, twMerge's default config classifies
 * unknown `text-*` / `border-*` classes as COLORS and silently drops them
 * whenever a real color class shares the merged list — e.g.
 * `twMerge('border-entity border-ink')` would strip `border-entity`, leaving
 * the element with no border width at all.
 *
 * - `theme.text` — the semantic type scale (`--text-nano` … `--text-lede` in
 *   ITUN's index.css) feeds the font-size class group.
 * - `theme.tracking` — the caps tracking steps (`--tracking-caps*`) feed the
 *   letter-spacing group (defensive: unknown tracking values pass through
 *   today, but registering them gives correct conflict resolution).
 * - Border-width groups — the semantic weights registered via `@utility`
 *   (chrome 1.5px / rail 2.5px / entity 3px, from the theme's `--bw-*`
 *   tokens), per side where a side variant exists.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ['nano', 'micro', 'label', 'label-lg', 'badge', 'note', 'caption', 'lede'],
      tracking: ['caps', 'caps-tight', 'caps-snug', 'caps-wide'],
    },
    classGroups: {
      'border-w': [{ border: ['chrome', 'rail', 'entity'] }],
      'border-w-t': [{ 'border-t': ['chrome'] }],
      'border-w-b': [{ 'border-b': ['chrome', 'entity'] }],
      'border-w-l': [{ 'border-l': ['chrome'] }],
      'border-w-r': [{ 'border-r': ['chrome'] }],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
