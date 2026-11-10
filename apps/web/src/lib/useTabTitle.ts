import { useEffect } from 'react'

/**
 * Names the tab after what the screen shows, and follows a rename. A route's
 * `head` runs once per navigation and its loader may not read a player's
 * entity or a Game (`.claude/rules/tanstack-router.md`), so it can only say
 * "Game" or "Play"; the component that reads the name sets it here. `null`
 * (the name has not answered) leaves the route's title standing.
 */
export function useTabTitle(title: string | null): void {
  useEffect(() => {
    if (title !== null) document.title = title
  }, [title])
}
