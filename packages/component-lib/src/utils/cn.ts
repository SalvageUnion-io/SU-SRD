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
 * - `theme.text` — the WHOLE semantic type scale (`--text-nano` … `--text-hero`
 *   in `theme.css`, including the display/heading rungs `readout`/`title`/
 *   `display`/`display-lg`/`hero`) feeds the font-size class group. Registering
 *   only the body rungs was a latent bug: an unregistered size like
 *   `text-display` was treated as a COLOR, so `cn('text-paper', 'text-display')`
 *   dropped `text-paper` — which is exactly how the sheet hero name-stamp lost
 *   its white ink and rendered black-on-ink (an invisible title).
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
      text: [
        'nano',
        'micro',
        'label',
        'label-lg',
        'badge',
        'note',
        'caption',
        'lede',
        'readout',
        'title',
        'display',
        'display-lg',
        'hero',
      ],
      tracking: ['caps', 'caps-tight', 'caps-snug', 'caps-wide'],
      // Radius scale (--radius-* in theme.css) → rounded-pip/badge/card/panel.
      radius: ['pip', 'badge', 'card', 'panel'],
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
