import type { NestedCardHost } from './NestedCards'

/**
 * Whether a host nests its children as TOKENS (N1, EDL E6): every host but a
 * Page. A Page is level 0, so its children are level 1, compact Cards; any
 * other host (a Card on a Page, a card in a wizard pick, a sheet, a dialog's
 * list) is level 1 or deeper, so its children are level 2, and level 2 holds
 * Minis only. A Peek's host is a card, so it nests Minis too (E16).
 */
export function nestsMinis(host: Pick<NestedCardHost, 'onPage'>): boolean {
  return !host.onPage
}
