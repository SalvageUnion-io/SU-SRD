import { useSyncExternalStore } from 'react'
import { modKeyHint } from './modKeyHint'

// The platform never changes under a page: there is nothing to subscribe to.
const noSubscription = () => () => {
  // Nothing to unsubscribe.
}

/**
 * The search shortcut's key cap for this reader's keyboard, one answer in both
 * tools (the SRD had printed "⌘K" for everyone). The server render, and the
 * first client render that hydrates it, read "⌘K"; the client then corrects it.
 */
export function useModKeyHint(): string {
  return useSyncExternalStore(
    noSubscription,
    () => modKeyHint(navigator.platform),
    () => '⌘K'
  )
}
