/**
 * A page opened from search (`markAtContent` in `lib/searchHref`, whose key
 * this repeats): its content takes the focus, once, unscrolled, so the next Tab
 * starts there with the page at its top (RR7-09, r8 G3). Its own few bytes, as
 * the page script loads it on every page.
 */
export function focusMarkedContent(): void {
  try {
    const key = 'su-at-content'
    if (sessionStorage.getItem(key) !== location.pathname) return
    sessionStorage.removeItem(key)
    document.getElementById('main-content')?.focus({ preventScroll: true })
  } catch {
    // No storage: nothing was marked.
  }
}
