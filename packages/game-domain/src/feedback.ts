/**
 * Feedback's words and its GitHub issue (ADR-057): what "Suggest or report"
 * and `/su feedback` hold a note to, and the issue a note becomes. Shared by
 * the server that files it and the tests; imports nothing.
 */

/** What a piece of feedback is: an idea, or something broken. */
export type FeedbackKind = 'suggestion' | 'report'

/** Where a piece of feedback came from: the app's "Suggest or report", or `/su feedback`. */
export type FeedbackSource = 'app' | 'bot'

/** Where the issues go. Public: the form says so. */
export const FEEDBACK_REPO = 'SalvageUnion-io/SU-SRD'

/** Every issue wears this label, plus `bug` for a report or `enhancement` for a suggestion. */
const FEEDBACK_LABEL = 'feedback'

/** The note's length bounds, in characters. */
export const FEEDBACK_MIN = 10
export const FEEDBACK_MAX = 2000

/** How many notes one sender may send in a day. */
export const FEEDBACK_DAILY_LIMIT = 5

/** What the sender is told once a note is in. */
export const FEEDBACK_THANKS = 'Thank you! Your note is on its way to the workshop.'

/** Why a note was refused, worded for the sender. */
export const FEEDBACK_REFUSAL = {
  short: `Say a little more: at least ${FEEDBACK_MIN} characters.`,
  long: `That is over ${FEEDBACK_MAX} characters. Trim it a little.`,
  limit: `That is ${FEEDBACK_DAILY_LIMIT} notes today. Thank you! Send more tomorrow.`,
} as const

/**
 * The page a note was sent from, as the issue names it: a site path (`/build/`)
 * and nothing else. Anything that is not one (spaces, a line break, a mention)
 * is dropped, since the caller sends it and the issue is public.
 */
export function pagePath(raw: string | undefined): string | null {
  if (raw === undefined) return null
  return /^\/[\w\-./~%?=&+]{0,199}$/.test(raw) ? raw : null
}

/** Neutralise what GitHub would act on in a stranger's words: mentions and issue links. */
export function quoteNote(text: string): string {
  return text
    .replace(/@/g, '@​')
    .replace(/#(\d)/g, '#​$1')
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n')
}

/** The issue a note becomes: title, body, labels. Exported for the tests. */
export function issueFor(note: {
  kind: FeedbackKind
  source: FeedbackSource
  text: string
  page: string | null
}): { title: string; body: string; labels: string[] } {
  const firstLine = note.text.split('\n')[0]?.trim() ?? ''
  const lead = note.kind === 'report' ? 'Report' : 'Suggestion'
  const title = `${lead}: ${firstLine.length > 70 ? `${firstLine.slice(0, 69)}…` : firstLine}`
  const from =
    note.source === 'app' ? 'the app’s Suggest or report' : 'the Discord bot (/su feedback)'
  const where = note.page === null ? '' : `\n\nPage: \`${note.page.replace(/`/g, '')}\``
  return {
    title,
    body: `${quoteNote(note.text)}\n\nSent from ${from}.${where}`,
    labels: [FEEDBACK_LABEL, note.kind === 'report' ? 'bug' : 'enhancement'],
  }
}
