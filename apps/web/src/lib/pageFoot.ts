import { useEffect } from 'react'
import { create } from 'zustand'

/**
 * What the app's page foot (`SiteFooter`) cites for the route on screen. The
 * foot sits after the route in the root layout, a sibling it cannot reach
 * through props, so a page that has something to cite sets it here while it
 * is mounted.
 *
 * Only a player-made page sets one today: a saved pattern's "Homebrew // Made
 * by alxjrvs", in the place a book page cites its printings (ruleset §3.9).
 */
type PageFootState = { credit: string | undefined }

export const usePageFoot = create<PageFootState>(() => ({ credit: undefined }))

/** Cite `credit` on the page's foot while the calling page is mounted. */
export function usePageFootCredit(credit: string | undefined): void {
  useEffect(() => {
    usePageFoot.setState({ credit })
    return () => usePageFoot.setState({ credit: undefined })
  }, [credit])
}
