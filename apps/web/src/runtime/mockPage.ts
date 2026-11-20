/**
 * The page-ground comparisons, each a URL toggle
 * that holds for the tab's session and lands on <html> as `data-mock-*`
 * (`best-site.css`). `=off` clears one. All off by default.
 *
 * - The page on a desk, its measure a column, is the default (`?mock-page=off`
 *   shows the old full-width ground for a comparison).
 * - `?mock-desk=1..4`: the desk's tone (stone, slate, charcoal, mid-grey).
 * - `?mock-boxes=bare`: stat tiles and text panels keep only their header
 *   strip, no paper box or frame.
 * - Stats as band chips on a non-chassis Page, and a Page that is only its
 *   description as plain prose, are the default (`?mock-stats=off` compares
 *   the old tiles and panel).
 */

const TOGGLES = ['page', 'desk', 'boxes', 'stats'] as const

export function applyMockPage(): void {
  try {
    const params = new URL(window.location.href).searchParams
    for (const name of TOGGLES) {
      const key = `su-mock-${name}`
      const asked = params.get(`mock-${name}`)
      // Paper is the default page; `?mock-page=off` holds the old one for a
      // comparison. The other toggles are off unless asked for.
      if (asked === 'off') {
        if (name === 'page' || name === 'stats') sessionStorage.setItem(key, 'off')
        else sessionStorage.removeItem(key)
      } else if (asked) sessionStorage.setItem(key, asked)
      const defaults: Record<string, string> = { page: 'paper', stats: 'chips' }
      const value = sessionStorage.getItem(key) ?? defaults[name] ?? null
      if (value && value !== 'off')
        document.documentElement.setAttribute(`data-mock-${name}`, value)
      else document.documentElement.removeAttribute(`data-mock-${name}`)
    }
    // The window's scrollbar, so paper mode's centred measure (`100vw` less
    // it) lands where the layout's own centring does.
    const scrollbar = () =>
      document.documentElement.style.setProperty(
        '--su-scrollbar',
        `${window.innerWidth - document.documentElement.clientWidth}px`
      )
    scrollbar()
    window.addEventListener('resize', scrollbar)
    new ResizeObserver(scrollbar).observe(document.documentElement)
  } catch {
    // No storage (a private window): the toggles simply stay off.
  }
}
