/**
 * The one loading line's words (chrome K6): "Loading <thing>…", sentence
 * case, the ellipsis one character. Every loading atom says it through here —
 * `Pending`'s line, `Skeleton`'s and `RoutePending`'s status — so no screen
 * spells its own. No `label` is the bare "Loading…", where the surrounding
 * section already names the subject.
 */
export function loadingCopy(label?: string): string {
  return label === undefined ? 'Loading…' : `Loading ${label}…`
}

/**
 * Search's own waiting line (K6): its index is still on the way, and the
 * reader asked a question, so it says what it is doing with it.
 */
export const SEARCHING = 'Searching…'
