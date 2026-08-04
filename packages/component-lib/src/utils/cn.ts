import { type ClassValue, clsx } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * The semantic border-WEIGHT words (`--bw-*` in `theme.css`). Applied to every
 * side group so a new `@utility border-<side>-<weight>` needs no change here.
 */
const BORDER_WEIGHTS = ['chrome', 'rail', 'entity'] as const

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
 * - `theme.tracking` — the WHOLE letter-spacing ladder (`--tracking-caps*` plus
 *   `--tracking-eyebrow`). Unknown tracking values pass through rather than
 *   being eaten, so a gap here is quieter than the `text-*` one — but it still
 *   breaks conflict resolution: before `eyebrow` was registered,
 *   `cn('tracking-caps', 'tracking-eyebrow')` emitted BOTH and let source order
 *   in the stylesheet decide the winner instead of the last class.
 * - Border-width groups — the semantic weights registered via `@utility`
 *   (chrome 1.5px / rail 2.5px / entity 3px, from the theme's `--bw-*`
 *   tokens). Registered as the full weight × side cross-product, deliberately
 *   including sides `theme.css` has no `@utility` for yet: listing only the
 *   side variants that exist today is what made this bug recur a third time.
 *   `theme.css:331` added `@utility border-l-entity` without adding `entity` to
 *   `border-w-l` here, so twMerge classified it as a border COLOR and
 *   `cn('border-l-entity border-[var(--tone-deep)]')` dropped the width —
 *   deleting the 3px accent spine from every `SheetSectionCard` (all three live
 *   sheets, and every wizard `RuleBrief`). A class registered here that no
 *   `@utility` emits costs nothing; the reverse costs a silently-missing style.
 *   So this block describes the border-width VOCABULARY, not the current
 *   inventory of utilities — new `@utility border-<side>-<weight>` rules in
 *   `theme.css` are covered in advance.
 *
 * Twice now this drifted silently, so it is no longer left to review:
 * `__tests__/cn.test.ts` PARSES `theme.css` and asserts every `@utility` and
 * every `--text-*` / `--tracking-*` / `--radius-*` rung survives a class it
 * would conflict with. Add a token there and this file must follow, or the
 * test fails — which is the only signal available, since a dropped width or
 * colour throws nothing and merely renders wrong.
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
      tracking: ['caps', 'caps-tight', 'caps-snug', 'caps-wide', 'eyebrow'],
      // Radius scale (--radius-* in theme.css) → rounded-pip/badge/card/panel.
      radius: ['pip', 'badge', 'card', 'panel'],
    },
    classGroups: {
      'border-w': [{ border: BORDER_WEIGHTS }],
      'border-w-t': [{ 'border-t': BORDER_WEIGHTS }],
      'border-w-b': [{ 'border-b': BORDER_WEIGHTS }],
      'border-w-l': [{ 'border-l': BORDER_WEIGHTS }],
      'border-w-r': [{ 'border-r': BORDER_WEIGHTS }],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
