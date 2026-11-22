/**
 * What a Game's member is called when their account has no name (r6 C11, LG6-30):
 * their place in the joining order, "Player 2", so no two members of a roster
 * read alike. An account's own name, else its Discord name (`shownProfile`),
 * always comes first; this is the last resort, said the same way on the Game
 * page's Members and on the invite page.
 */

/** "Player N" for the member at `joinIndex` (0 the first to join, the Organiser). */
export function unnamedMember(joinIndex: number): string {
  return `Player ${joinIndex + 1}`
}

/** The member's name, else their place in the joining order. */
export function memberName(displayName: string | null | undefined, joinIndex: number): string {
  const name = displayName?.trim() ?? ''
  return name === '' ? unnamedMember(joinIndex) : name
}
