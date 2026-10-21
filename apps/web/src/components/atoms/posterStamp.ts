import { cn } from '../../lib/cn'
import { capsLabel } from './capsLabel'

/**
 * The poster wrapping-stamp shape (clean-pilot.html `.sect`/`.stamp`) — the
 * multi-line ink label whose background is cloned across each wrapped line
 * (`box-decoration-break: clone`, `display: inline`; the `.su-poster-stamp`
 * rule in `styles/partials/atoms.css`), at the wide poster tracking.
 *
 * Distinct from the `Badge` `shape="stamp"` atom (a single-line `inline-block`
 * chip locked to `line-height: 1` and `tracking-caps-tight`). Compose this with
 * the per-site padding / leading / text-size (the shapes differ slightly). Used
 * by `Slab` and `VitalGauge`'s label, so the poster ink-label
 * lives in one place instead of being re-inlined.
 *
 * Tracking was `0.09em` — an ARBITRARY value on no rung of the ladder, which
 * ruleset §4.2 makes a defect outright. `tracking-caps` (0.08em) is the nearest
 * rung, a 0.01em change. It is also exactly what `SectionChead` used, so
 * conforming here is what let SectionChead fold into Slab
 * without a tracking delta: the off-ladder value was the thing keeping two
 * implementations of one section header apart.
 */
export const POSTER_STAMP = cn(capsLabel({ tracking: 'caps' }), 'su-poster-stamp')
