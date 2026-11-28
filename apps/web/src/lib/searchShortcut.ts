/**
 * The keys that open search on every page: Cmd+K or Ctrl+K anywhere, and "/"
 * wherever it would not be typed. Plain DOM and free of React: the page's
 * client entry asks it before any search has mounted (`islands.client.ts`),
 * and `SearchIsland` after.
 */

import { modKeyHint } from '../components/atoms/modKeyHint'

/** Where a key press is text going into a field. */
const FIELDS = ['input', 'textarea', 'select'].join()

/** Whether a key press here is text going into a field. */
export function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || target.matches(FIELDS)
}

/** Whether `event` is one of the search shortcuts. */
export function isSearchShortcut(event: KeyboardEvent): boolean {
  if ((event.metaKey || event.ctrlKey) && event.key === 'k') return true
  return (
    event.key === '/' &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.altKey &&
    !isTyping(event.target)
  )
}

/** The key cap a page is served with: a Mac's, since the server cannot know the keyboard. */
const SERVED_HINT = '⌘K'

/**
 * The served key caps read "⌘K" (the server cannot know the keyboard); this
 * corrects them before a search has mounted, so a reader off a Mac is never
 * shown a key they do not have. A cap that names another key ("/") is every
 * keyboard's and stays.
 */
export function correctShortcutHints(root: ParentNode, platform: string): void {
  const hint = modKeyHint(platform)
  for (const cap of root.querySelectorAll('.su-search-field__shortcut')) {
    const key = cap.querySelector('kbd')
    if (key && key.textContent === SERVED_HINT && hint !== SERVED_HINT) key.textContent = hint
  }
}
