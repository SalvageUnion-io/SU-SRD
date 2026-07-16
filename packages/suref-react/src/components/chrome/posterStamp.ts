/**
 * The poster wrapping-stamp shape (clean-pilot.html `.sect`/`.stamp`) — the
 * multi-line ink label whose background is cloned across each wrapped line
 * (`box-decoration-clone inline`), with the wider poster tracking (`0.09em`).
 *
 * Distinct from the `Badge` `shape="stamp"` atom (a single-line `inline-block`
 * chip locked to `line-height: 1` and `tracking-caps-tight`). Compose this with
 * the per-site padding / leading / text-size (the shapes differ slightly). Used
 * by `Slab`'s solid variant and `VitalGauge`'s label, so the poster ink-label
 * lives in one place instead of being re-inlined.
 */
export const POSTER_STAMP =
  'box-decoration-clone inline bg-ink text-paper font-cond font-bold uppercase tracking-[0.09em]'
