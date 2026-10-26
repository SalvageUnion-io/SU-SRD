/**
 * NO RAW MARKUP (entity display language E4): every `[[Trait]]` the
 * rules text carries renders as a Mention — a word linked to its page with its
 * Peek — and never as the markup itself. So no page the site emits may carry
 * `[[` in its rendered body.
 *
 * The build asserts it on every page it wrote (`./site`): the build already
 * draws the whole corpus, so the property is checked there rather than by a
 * test that renders all of it a second time. It lives here so it can be
 * tested without running a build.
 *
 * Island props (an `<astro-island>`'s `props`) and script bodies are data, not
 * rendered text: an island's entity travels raw and its client render draws
 * the Mentions, and Astro's prop encoding nests arrays (`[1,[[0,…]]]`), so
 * both are left out of the scan.
 */

/** An `<astro-island …>` opening tag's `props="…"` (its value is HTML-escaped, so holds no `"`). */
const ISLAND_PROPS = /(<astro-island\b[^>]*?)\sprops="[^"]*"/gi

/** True when `<script` at `at` (in lower-cased html) opens a script tag, not `<scripts`. */
function opensScript(lower: string, at: number): boolean {
  const next = lower.charAt(at + '<script'.length)
  return next === '' || !/[a-z0-9-]/.test(next)
}

/**
 * `html` with every `<script …>…</script …>` block cut out, matched without
 * regard to case. An unterminated `<script` is left in place, so the text after
 * it is still scanned: the assertion errs toward seeing markup, not hiding it.
 */
function withoutScriptsOnce(html: string): string {
  const lower = html.toLowerCase()
  let out = ''
  let cursor = 0
  let open = lower.indexOf('<script', cursor)
  while (open >= 0) {
    if (!opensScript(lower, open)) {
      open = lower.indexOf('<script', open + 1)
      continue
    }
    out += html.slice(cursor, open)
    const close = lower.indexOf('</script', open)
    const end = close < 0 ? -1 : lower.indexOf('>', close)
    if (end < 0) return out + html.slice(open)
    cursor = end + 1
    open = lower.indexOf('<script', cursor)
  }
  return out + html.slice(cursor)
}

/**
 * The rendered body: everything after `<body`, without its script blocks. The
 * cut repeats until nothing changes, so pieces left either side of a removed
 * block cannot join into a new one (`<scr<script></script>ipt>`).
 */
export function renderedBody(html: string): string {
  let body = html
    .slice(Math.max(0, html.toLowerCase().indexOf('<body')))
    .replace(ISLAND_PROPS, '$1')
  for (let cut = withoutScriptsOnce(body); cut !== body; cut = withoutScriptsOnce(body)) {
    body = cut
  }
  return body
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
    `[build] refusing to finish: ${offenders.length} page(s) render raw [[markup]].\n` +
      shown.map((offender) => `  ${offender}`).join('\n') +
      (offenders.length > shown.length
        ? `\n  ...and ${offenders.length - shown.length} more\n`
        : '\n') +
      '\n  A [[Trait]] in rules text must render as a Mention (a link to its page\n' +
      '  with its Peek), never as the markup itself. The page drew a text field\n' +
      '  without passing it through the rules-text renderer.\n'
  )
}
