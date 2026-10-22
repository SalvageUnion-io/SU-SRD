import { cn } from '../../lib/cn'

/**
 * The condensed-caps LABEL recipe — the one place that knows what a caps label
 * is made of.
 *
 * `font-cond` + `uppercase` + a size + a weight + a tracking is the single most
 * repeated class shape in this repo, and this is its primitive. `Text`
 * deliberately has no stamp/label variant (that role is `Badge shape="stamp"`),
 * so without this recipe every caps label in a rail, a section header, a gauge
 * cap or a key/value row re-derives the same five decisions from scratch, and
 * siblings drift between a stock `tracking-wide` and a semantic rung.
 *
 * ## Emits `.su-*` class names
 *
 * A `(opts) => string` recipe; the rules behind the names it returns live in
 * `src/styles/partials/controls.css`.
 *
 * It stays a class-string emitter rather than becoming a `CSSProperties` object,
 * even though every property it sets is static and the split rule would
 * otherwise put all of it inline. The reason is `buttonVariants`: that is a
 * public class-string export which composes this recipe into its own output,
 * and both apps put that output on `<a>` elements. A recipe feeding a class
 * string has to BE a class string — the class-string exemption in
 * `.claude/rules/styling.md`.
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
 * currently on the inherited rem scale (`text-xs`, `text-sm`, `text-lg`) are deliberately NOT expressible here — moving `text-sm` (14px) to
 * `text-caption` (13px) is a per-site design call, not a rename, so those sites
 * keep their own size class until someone rules on each one. `size` has no
 * default for the same reason a `Badge` chip supplies its own: omit it and the
 * recipe emits no size at all.
 */
/**
 * Semantic type-ladder rungs only. Omit when the caller already supplies
 * the size — a `Badge` surface, a `Button` size, or a container-driven step.
 */
const SIZE = {
  badge: 'su-caps--badge',
  note: 'su-caps--note',
  caption: 'su-caps--caption',
  lede: 'su-caps--lede',
  readout: 'su-caps--readout',
  title: 'su-caps--title',
  display: 'su-caps--display',
} as const

/**
 * Caps labels run bold by default; `semibold` is the chip weight.
 * `inherit` emits NOTHING — it is not a 400 weight. The distinction is
 * load-bearing: a label with no weight class inherits its container's
 * weight, and pinning it to 400 would silently un-bold every such label
 * that happens to sit inside a bold stamp or heading.
 */
const WEIGHT = {
  inherit: '',
  normal: 'su-caps--w-normal',
  semibold: 'su-caps--w-semibold',
  bold: 'su-caps--w-bold',
} as const

/**
 * The ratified multi-rung caps ladder (ruleset §4.2). `tight` is the
 * default, and `snug` at the 11px floor (`size: 'badge'` defaults to it);
 * the others exist because they are in deliberate use. `none` is the normal
 * letter-spacing. `inherit` emits nothing, for labels whose tracking is
 * supplied by the rule around them.
 */
const TRACKING = {
  inherit: '',
  none: 'su-caps--t-none',
  tight: 'su-caps--t-tight',
  snug: 'su-caps--t-snug',
  caps: 'su-caps--t-caps',
  wide: 'su-caps--t-wide',
  eyebrow: 'su-caps--t-eyebrow',
} as const

export type CapsLabelProps = {
  size?: keyof typeof SIZE | null
  weight?: keyof typeof WEIGHT | null
  tracking?: keyof typeof TRACKING | null
}

/**
 * 11px caps are snug (ruleset §4.2): at `size: 'badge'` the default rung is
 * `snug`, and the `tokens/badge-caps-snug` gate fails any other one named there.
 */
export function capsLabel({ size, weight, tracking }: CapsLabelProps = {}): string {
  return cn(
    'su-caps',
    size == null ? undefined : SIZE[size],
    WEIGHT[weight ?? 'bold'],
    TRACKING[tracking ?? (size === 'badge' ? 'snug' : 'tight')]
  )
}
