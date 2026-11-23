/**
 * Is this an installed app rather than a browser tab?
 *
 * `display-mode: standalone` covers installed PWAs on every engine that
 * implements the manifest; `minimal-ui` covers the installed-but-chromed
 * variants; `navigator.standalone` is iOS Safari's older, non-standard flag,
 * kept because iOS is a realistic place to install a reference book.
 *
 * Deliberately NOT `appinstalled`: that event fires once, at the moment of
 * installation, and a user who installed last week and opened the app today
 * would never warm anything.
 *
 * Its own module so the page script asks it before it loads the offline warm
 * (`islands.client.ts`): a browser tab never fetches that chunk.
 */
export function isInstalledApp(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  if (window.matchMedia('(display-mode: standalone)').matches) return true
  if (window.matchMedia('(display-mode: minimal-ui)').matches) return true
  return (window.navigator as { standalone?: boolean }).standalone === true
}
