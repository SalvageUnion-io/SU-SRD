/**
 * Extract a snippet of text around a match with context
 * @param text - The full text to search in
 * @param query - The search query to find
 * @param contextChars - Number of characters to show before and after the match
 * @returns Object with the snippet and match positions
 */
export function extractMatchSnippet(
  text: string,
  query: string,
  contextChars = 50
): { snippet: string; matchStart: number; matchEnd: number } | null {
  const lowerText = text.toLowerCase()
  const lowerQuery = query.toLowerCase()
  const matchIndex = lowerText.indexOf(lowerQuery)

  if (matchIndex === -1) {
    return null
  }

  const snippetStart = Math.max(0, matchIndex - contextChars)
  const snippetEnd = Math.min(text.length, matchIndex + query.length + contextChars)

  let snippet = text.slice(snippetStart, snippetEnd)

  if (snippetStart > 0) {
    snippet = '...' + snippet
  }
  if (snippetEnd < text.length) {
    snippet = snippet + '...'
  }

  const matchStart = snippetStart > 0 ? matchIndex - snippetStart + 3 : matchIndex - snippetStart
  const matchEnd = matchStart + query.length

  return { snippet, matchStart, matchEnd }
}

/**
 * Highlight matching text within a string
 * @param text - The text to highlight
 * @param matchStart - Start index of the match
 * @param matchEnd - End index of the match
 * @returns Object with before, match, and after text segments
 */
export function highlightMatch(
  text: string,
  matchStart: number,
  matchEnd: number
): { before: string; match: string; after: string } {
  return {
    before: text.slice(0, matchStart),
    match: text.slice(matchStart, matchEnd),
    after: text.slice(matchEnd),
  }
}
