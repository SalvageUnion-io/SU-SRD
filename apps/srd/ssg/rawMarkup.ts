/**
 * NO RAW MARKUP (entity display language E4, phase 3): every `[[Trait]]` the
 * rules text carries renders as a Mention — a word linked to its page with its
 * Peek — and never as the markup itself. So no page the site emits may carry
 * `[[` in its rendered body.
 *
 * `ssg/build.ts` asserts it on every page it renders, as it renders it: the
 * build already draws the whole corpus, so the property is checked there
 * rather than by a test that renders all of it a second time. It lives here,
 * not in `build.ts`, so it can be tested without running a build (importing
 * `build.ts` runs one).
 *
 * Island props (`<script type="application/json">`) are data, not rendered
 * text: an island's entity travels raw and its client render draws the
 * Mentions, so script bodies are left out of the scan.
 */

/** The rendered body: everything after `<body`, without its script blocks. */
export function renderedBody(html: string): string {
  return html.slice(html.indexOf('<body')).replace(/<script\b[\s\S]*?<\/script>/g, '')
}

/** The first raw `[[` in a page's rendered body, with context, or undefined. */
export function findRawMarkup(html: string): string | undefined {
  const body = renderedBody(html)
  const at = body.indexOf('[[')
  if (at < 0) return undefined
  return `…${body.slice(Math.max(0, at - 60), at + 40)}…`
}

/** Throws if any rendered page carried raw markup; `offenders` is `route: context`. */
export function assertNoRawMarkup(offenders: readonly string[]): void {
  if (offenders.length === 0) return
  const shown = offenders.slice(0, 10)
  throw new Error(
    `[ssg] refusing to finish: ${offenders.length} page(s) render raw [[markup]].\n` +
      shown.map((offender) => `  ${offender}`).join('\n') +
      (offenders.length > shown.length
        ? `\n  ...and ${offenders.length - shown.length} more\n`
        : '\n') +
      '\n  A [[Trait]] in rules text must render as a Mention (a link to its page\n' +
      '  with its Peek), never as the markup itself. The page drew a text field\n' +
      '  without passing it through the rules-text renderer.\n'
  )
}
