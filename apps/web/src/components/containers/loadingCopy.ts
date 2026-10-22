/**
 * The one loading line's words (chrome.md K6): "Loading <thing>…", sentence
 * case, the ellipsis one character. Every loading atom says it through here —
 * `Pending`'s line, `Skeleton`'s and `RoutePending`'s status — so no screen
 * spells its own. No `label` is the bare "Loading…", where the surrounding
 * section already names the subject.
 */
export function loadingCopy(label?: string): string {
  return label === undefined ? 'Loading…' : `Loading ${label}…`
}
