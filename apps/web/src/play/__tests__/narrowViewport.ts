/**
 * A phone's viewport for a test of Play below `lg` (play.md §11): the
 * window's media queries answer as a 390px-wide window would, so
 * `usePlayWide` reads narrow and `PlayFrame` draws its panes as tabs.
 * happy-dom evaluates no container query, so a test reads what the frame
 * tells a reader (tabs, `hidden` panes), not the arrangement.
 *
 * Returns the restore; call it in a `finally` or an `afterEach`.
 */

export function narrowViewport(width = 390): () => void {
  const original = window.matchMedia
  window.matchMedia = ((query: string) => {
    const rem = query.match(/\(width >= ([\d.]+)rem\)/)
    return {
      matches: rem !== null && width >= Number(rem[1]) * 16,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }
  }) as unknown as typeof window.matchMedia
  return () => {
    window.matchMedia = original
  }
}
