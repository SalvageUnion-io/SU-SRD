/**
 * Error reporting for the Cloudflare Workers, and the endpoint that brings the
 * browser's errors into them.
 *
 * ## Workers Issues is the error tracker
 *
 * Every Worker turns on `observability.issues` (`wrangler.jsonc`). Issues
 * records, with no SDK and no wrapper, an uncaught exception, a failed
 * invocation, a `5xx` the Worker returns, and any `console.error` — and groups
 * them into issues, alerted on by the dashboard's Issues automations.
 * `upload_source_maps` makes a Worker's own stacks point at the source.
 *
 * So a Worker reports a handled error by logging it: {@link reportError}.
 * There is no module-scope initialisation of anything (ADR-033 forbids I/O at
 * module scope), and nothing to wrap a default export in.
 *
 * ## The error Cloudflare cannot see by itself
 *
 * Cloudflare has no browser error tracking. The apps post their errors to
 * their own Worker ({@link handleErrorReport}, at {@link ERROR_REPORT_PATH}),
 * which logs each one as an `Error` so Issues groups it like a Worker's own.
 * The stacks stay minified: Cloudflare maps only a Worker's own code.
 */

/**
 * Report a handled error — one the Worker caught and turned into a response.
 *
 * Issues only sees an uncaught throw or a `5xx` on its own, and these Workers
 * deliberately catch nearly everything (a storage failure becomes a 503, a
 * transformation failure becomes a 404). Logging the error at error level is
 * what makes Issues record it, and it lands in Workers Logs (what
 * `wrangler tail` shows during an incident) at the same time. Safe under Bun,
 * so shared code and its tests import it directly.
 */
export function reportError(error: unknown, context?: Record<string, unknown>): void {
  // The error's first line rides along as `message`, which Workers Logs shows
  // as the event's message. Logged bare, an error whose message spans lines
  // (a Discord `DiscordAPIError[50035]: Invalid Form Body` and its field
  // list) showed only its stack frames: the reason was nowhere in the log.
  // The caller's own `message`, if it passes one, wins.
  const headline = error instanceof Error ? { message: headlineOf(error) } : {}
  console.error(error, { ...headline, ...context })
}

/** `${name}: ${message}` on one line, as a stack would open with it. */
function headlineOf(error: Error): string {
  // Split and trimmed rather than a whitespace regex, which backtracks on
  // long runs of spaces in a message this Worker does not control.
  const text = `${error.name}: ${error.message}`
    .split('\n')
    .map((line) => line.trim())
    .join(' ')
  return text.length > 1_000 ? `${text.slice(0, 1_000)}…` : text
}

/** A Workers rate limiting binding (`ratelimits` in `wrangler.jsonc`). */
export type RateLimiter = {
  limit(options: { key: string }): Promise<{ success: boolean }>
}

/**
 * Where a browser app posts its errors. Same origin, so the CSP's
 * `connect-src 'self'` already allows it.
 */
export const ERROR_REPORT_PATH = '/__errors'

/**
 * The largest report body the endpoint reads. The browser truncates its
 * stack and context well under this; anything bigger is not ours.
 */
const MAX_REPORT_BYTES = 16 * 1024

/** What a browser app posts: the `ErrorReport` `src/lib/browserObservability.ts` sends. */
export type ErrorReport = {
  name: string
  message: string
  stack?: string
  /** The page, without its query or hash. */
  url?: string
  /** The deployed commit, `VITE_COMMIT_REF`. */
  release?: string
  context?: Record<string, unknown>
  tags?: Record<string, string>
  /**
   * A stable name for the condition, for an error whose message varies per
   * event (a request id, a bundle hash). It becomes the logged error's
   * message, so Issues groups every event of the condition together.
   */
  fingerprint?: string[]
}

function noStore(status: number, headers?: Record<string, string>): Response {
  return new Response(null, { status, headers: { 'cache-control': 'no-store', ...headers } })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringRecord(value: unknown): Record<string, string> | undefined {
  if (!isRecord(value)) return undefined
  const entries = Object.entries(value).filter(
    (entry): entry is [string, string] => typeof entry[1] === 'string'
  )
  return entries.length > 0 ? Object.fromEntries(entries) : undefined
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

/** A posted body as an {@link ErrorReport}, or null when it is not one. */
function parseErrorReport(value: unknown): ErrorReport | null {
  if (!isRecord(value)) return null
  if (typeof value.message !== 'string') return null
  const fingerprint = Array.isArray(value.fingerprint)
    ? value.fingerprint.filter((part): part is string => typeof part === 'string')
    : []
  return {
    name: optionalString(value.name) ?? 'Error',
    message: value.message,
    stack: optionalString(value.stack),
    url: optionalString(value.url),
    release: optionalString(value.release),
    context: isRecord(value.context) ? value.context : undefined,
    tags: stringRecord(value.tags),
    fingerprint: fingerprint.length > 0 ? fingerprint : undefined,
  }
}

/**
 * An `Error` standing in for one that happened somewhere else, so Issues reads
 * its name, message and stack as if this Worker had thrown it.
 */
function remoteError(name: string, message: string, stack: string | undefined): Error {
  const error = new Error(message)
  error.name = name
  error.stack = stack ?? `${name}: ${message}`
  return error
}

/** The error a report is logged as: by its fingerprint when it has one. */
function errorOfReport(report: ErrorReport): Error {
  if (report.fingerprint) {
    return remoteError(report.name, report.fingerprint.join(' '), undefined)
  }
  return remoteError(report.name, report.message, report.stack)
}

/**
 * Answer a browser app's error report: log it as an error, answer `204`.
 *
 * Never a `5xx`, which Issues would record as a failure of this endpoint.
 * Abuse is bounded three ways: the body size, the shape, and, when the Worker
 * binds one, a per-address rate limit.
 */
export async function handleErrorReport(
  request: Request,
  options: { app: string; limiter?: RateLimiter }
): Promise<Response> {
  if (request.method !== 'POST') return noStore(405, { allow: 'POST' })

  if (options.limiter) {
    const key = request.headers.get('cf-connecting-ip') ?? 'unknown'
    const { success } = await options.limiter.limit({ key })
    if (!success) return noStore(429)
  }

  if (Number(request.headers.get('content-length') ?? 0) > MAX_REPORT_BYTES) return noStore(413)
  const body = await request.text()
  if (body.length > MAX_REPORT_BYTES) return noStore(413)

  let report: ErrorReport | null
  try {
    report = parseErrorReport(JSON.parse(body))
  } catch {
    // Not JSON: not a report, and nothing worth logging.
    report = null
  }
  if (report === null) return noStore(400)

  console.error(errorOfReport(report), {
    source: 'browser',
    app: options.app,
    url: report.url,
    release: report.release,
    tags: report.tags,
    context: report.context,
    ...(report.fingerprint ? { message: report.message } : {}),
    userAgent: request.headers.get('user-agent') ?? undefined,
  })
  return noStore(204)
}
