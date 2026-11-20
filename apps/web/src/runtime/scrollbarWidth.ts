/**
 * The window's scrollbar width as `--su-scrollbar` on <html>, so the page
 * column's centred measure (`100vw` less it, `best-site.css`) lands where the
 * layout's own centring does.
 */
export function trackScrollbarWidth(): void {
  const root = document.documentElement
  const measure = () =>
    root.style.setProperty('--su-scrollbar', `${window.innerWidth - root.clientWidth}px`)
  measure()
  window.addEventListener('resize', measure)
  new ResizeObserver(measure).observe(root)
}
