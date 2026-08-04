import { cva } from 'class-variance-authority'

/**
 * The condensed-caps LABEL recipe — the one place that knows what a caps label
 * is made of.
 *
 * `font-cond` + `uppercase` + a size + a weight + a tracking is the single most
 * repeated class shape in this repo: ~188 hand-spelled occurrences across ~98
 * files, and until now there was no primitive for it. `Text` deliberately has
 * no stamp/label variant (that role is `Badge shape="stamp"`), so every caps
 * label in a rail, a section header, a gauge cap or a key/value row re-derived
 * the same five decisions from scratch — which is exactly how four sites ended
 * up on Tailwind's built-in `tracking-wide` while their siblings sat on a
 * semantic rung.
 *
 * ## What this recipe does and does NOT standardise
 *
 * It locks the two invariants (`font-cond`, `uppercase`) into the base and
 * makes the three genuinely-varying decisions NAMED axes. It does **not**
 * collapse the tracking ladder onto one rung: `docs/design-system/ruleset.md`
 * §4.2 (lines 235-256) considered that consolidation and **declined** it —
 * "the wide rungs are in deliberate, active use. Ratified as-is rather than
 * re-lettering every label in the app." So `tracking` is an axis with
 * `caps-tight` as its DEFAULT (the ruleset's stated default for a label:
 * "reach up the ladder only deliberately"), not a constant.
 *
 * The `size` axis carries only rungs of the **semantic** type ladder
 * (`--text-*` in `theme.css`). Sites currently on Tailwind's default scale
 * (`text-xs`, `text-sm`, `text-lg`, `text-3xl`) are deliberately NOT expressible
 * here — moving `text-sm` (14px) to `text-caption` (13px) is a per-site design
 * call, not a rename, so those sites keep their own class until someone rules
 * on each one. `size` has no default for the same reason a `Badge` chip supplies
 * its own: omit it and the recipe emits no size at all.
 */
export const capsLabel = cva('font-cond uppercase', {
  variants: {
    /**
     * Semantic type-ladder rungs only (`theme.css` §"Semantic type scale").
     * Omit when the caller already supplies the size — a `Badge` surface, a
     * `Button` size, or a container-driven step.
     */
    size: {
      nano: 'text-nano',
      micro: 'text-micro',
      label: 'text-label',
      'label-lg': 'text-label-lg',
      badge: 'text-badge',
      note: 'text-note',
      caption: 'text-caption',
      lede: 'text-lede',
      readout: 'text-readout',
      title: 'text-title',
      display: 'text-display',
    },
    /**
     * Caps labels run bold by default; `semibold` is the chip weight.
     * `inherit` emits NOTHING — it is not `font-normal`. The distinction is
     * load-bearing: a label with no weight class inherits its container's
     * weight, and pinning it to 400 would silently un-bold every such label
     * that happens to sit inside a bold stamp or heading.
     */
    weight: {
      inherit: '',
      normal: 'font-normal',
      semibold: 'font-semibold',
      bold: 'font-bold',
    },
    /**
     * The ratified multi-rung caps ladder (ruleset §4.2). `tight` is the
     * default; the others exist because they are in deliberate use.
     * `none` is Tailwind's `tracking-normal`, for the caps labels that
     * deliberately do not letterspace (the `Button` mini chip). `inherit`
     * emits nothing, for labels whose tracking is supplied by the surface
     * around them (a `Badge` surface picks `caps` or `caps-snug` itself).
     */
    tracking: {
      inherit: '',
      none: 'tracking-normal',
      tight: 'tracking-caps-tight',
      snug: 'tracking-caps-snug',
      caps: 'tracking-caps',
      wide: 'tracking-caps-wide',
      eyebrow: 'tracking-eyebrow',
    },
  },
  defaultVariants: {
    weight: 'bold',
    tracking: 'tight',
  },
})
