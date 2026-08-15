import { cva } from 'class-variance-authority'

/**
 * The condensed-caps LABEL recipe — the one place that knows what a caps label
 * is made of.
 *
 * `font-cond` + `uppercase` + a size + a weight + a tracking is the single most
 * repeated class shape in this repo: ~188 hand-spelled occurrences across ~98
 * files, and until this existed there was no primitive for it. `Text`
 * deliberately has no stamp/label variant (that role is `Badge shape="stamp"`),
 * so every caps label in a rail, a section header, a gauge cap or a key/value
 * row re-derived the same five decisions from scratch — which is exactly how
 * four sites ended up on Tailwind's built-in `tracking-wide` while their
 * siblings sat on a semantic rung.
 *
 * ## Emits `.su-*` class names now, not Tailwind classes (#799, epic #802)
 *
 * The recipe's SHAPE is unchanged — same axes, same values, same defaults, same
 * `(opts) => string` signature — so **no call site moves**. Only the class names
 * it returns changed, and the rules behind them live in `src/styles/index.css`.
 *
 * It stays a class-string emitter rather than becoming a `CSSProperties` object,
 * even though every property it sets is static and the split rule would
 * otherwise put all of it inline. The reason is `buttonVariants`: that is a
 * public class-string export which composes this recipe into its own output,
 * and both apps put that output on `<a>` elements. A recipe feeding a class
 * string has to BE a class string. See the class-string exemption in this
 * package's CLAUDE.md — this is the "anything built on them inherits the same
 * constraint" clause. Worth revisiting once Button migrates.
 *
 * ## What this recipe does and does NOT standardise
 *
 * It locks the two invariants (condensed face, uppercase) into the base and
 * makes the three genuinely-varying decisions NAMED axes. It does **not**
 * collapse the tracking ladder onto one rung: `docs/design-system/ruleset.md`
 * §4.2 considered that consolidation and **declined** it — "the wide rungs are
 * in deliberate, active use. Ratified as-is rather than re-lettering every label
 * in the app." So `tracking` is an axis with `tight` as its DEFAULT (the
 * ruleset's stated default for a label: "reach up the ladder only
 * deliberately"), not a constant.
 *
 * The `size` axis carries only rungs of the **semantic** type ladder. Sites
 * currently on Tailwind's default scale (`text-xs`, `text-sm`, `text-lg`,
 * `text-3xl`) are deliberately NOT expressible here — moving `text-sm` (14px) to
 * `text-caption` (13px) is a per-site design call, not a rename, so those sites
 * keep their own size class until someone rules on each one. `size` has no
 * default for the same reason a `Badge` chip supplies its own: omit it and the
 * recipe emits no size at all.
 */
export const capsLabel = cva('su-caps', {
  variants: {
    /**
     * Semantic type-ladder rungs only. Omit when the caller already supplies
     * the size — a `Badge` surface, a `Button` size, or a container-driven step.
     */
    size: {
      nano: 'su-caps--nano',
      micro: 'su-caps--micro',
      label: 'su-caps--label',
      'label-lg': 'su-caps--label-lg',
      badge: 'su-caps--badge',
      note: 'su-caps--note',
      caption: 'su-caps--caption',
      lede: 'su-caps--lede',
      readout: 'su-caps--readout',
      title: 'su-caps--title',
      display: 'su-caps--display',
    },
    /**
     * Caps labels run bold by default; `semibold` is the chip weight.
     * `inherit` emits NOTHING — it is not a 400 weight. The distinction is
     * load-bearing: a label with no weight class inherits its container's
     * weight, and pinning it to 400 would silently un-bold every such label
     * that happens to sit inside a bold stamp or heading.
     */
    weight: {
      inherit: '',
      normal: 'su-caps--w-normal',
      semibold: 'su-caps--w-semibold',
      bold: 'su-caps--w-bold',
    },
    /**
     * The ratified multi-rung caps ladder (ruleset §4.2). `tight` is the
     * default; the others exist because they are in deliberate use. `none` is
     * the normal letter-spacing, for the caps labels that deliberately do not
     * letterspace (the `Button` mini chip). `inherit` emits nothing, for labels
     * whose tracking is supplied by the surface around them (a `Badge` surface
     * picks `caps` or `caps-snug` itself).
     */
    tracking: {
      inherit: '',
      none: 'su-caps--t-none',
      tight: 'su-caps--t-tight',
      snug: 'su-caps--t-snug',
      caps: 'su-caps--t-caps',
      wide: 'su-caps--t-wide',
      eyebrow: 'su-caps--t-eyebrow',
    },
  },
  defaultVariants: {
    weight: 'bold',
    tracking: 'tight',
  },
})
