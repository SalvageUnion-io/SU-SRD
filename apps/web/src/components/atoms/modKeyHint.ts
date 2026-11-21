import { atomsCopy } from '../../messages/components-atoms'

/**
 * "⌘K" where there is a Command key, else "Ctrl K". Free of React: the page's
 * client entry reads it before any search has mounted (`lib/searchShortcut.ts`);
 * a component reads it through `useModKeyHint`.
 */
export function modKeyHint(platform: string): string {
  return /Mac|iPhone|iPad/.test(platform) ? '⌘K' : atomsCopy('ctrlK')
}
