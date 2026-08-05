/**
 * preview — serve the finished `dist/` as static files.
 *
 * Replaces `astro preview`. Two consumers, one implementation, so they can
 * never disagree about how a URL maps to a file:
 *   - `bun run preview` (and Playwright's `webServer` in CI) — the CLI below.
 *   - `scripts/og-screenshots.ts` — imports `startPreview` and serves in-process
 *     while it drives chromium over `/og-card/`.
 *
 * It reproduces the mapping in `ssg/DESIGN.md` ("URL -> file"), which is the
 * mapping Astro's `trailingSlash: 'ignore'` gave us and the one Netlify serves:
 *   /                      -> index.html
 *   /about  or  /about/    -> about/index.html
 *   /404                   -> 404.html          (a FILE, not a directory)
 *   /schema/chassis.json   -> schema/chassis.json
 *   anything else          -> 404.html, status 404
 *
 * This is a build/test convenience server only — never a production surface, so
 * it sets no caching or security headers (Netlify owns those, from
 * `netlify.toml`).
 */

import type { Server } from 'bun'
import { join, normalize, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIST_DIR = fileURLToPath(new URL('../dist', import.meta.url))

export type PreviewOptions = {
  /** Directory to serve. Defaults to this app's `dist/`. */
  dir?: string
  /** Defaults to 4321 — the port every other srd tool assumes. */
  port?: number
  /** Defaults to Bun's own (all interfaces), so `localhost` resolves. */
  hostname?: string
}

/**
 * Resolve a request pathname to a file inside `dir`, or null.
 *
 * Containment is checked on the NORMALIZED path, so `..` segments (and their
 * percent-encoded forms, which are decoded first) can never escape `dir`.
 */
async function resolveFile(dir: string, pathname: string): Promise<string | null> {
  let decoded: string
  try {
    decoded = decodeURIComponent(pathname)
  } catch {
    return null
  }
  const target = normalize(join(dir, decoded))
  if (target !== dir && !target.startsWith(dir + sep)) return null

  // A dotted endpoint (`schema/chassis.json`) is a real file and must win over
  // any directory interpretation; a bare route is a directory holding
  // index.html; `/404` is the one route Astro emitted as a sibling `.html`.
  for (const candidate of [target, join(target, 'index.html'), `${target}.html`]) {
    const file = Bun.file(candidate)
    if (await file.exists()) return candidate
  }
  return null
}

/** No websockets here, hence `Server<undefined>` — a plain static HTTP server. */
export function startPreview(options: PreviewOptions = {}): Server<undefined> {
  const dir = normalize(options.dir ?? DIST_DIR)
  const notFoundPath = join(dir, '404.html')

  return Bun.serve({
    port: options.port ?? 4321,
    hostname: options.hostname,
    async fetch(request) {
      const { pathname } = new URL(request.url)
      const filePath = await resolveFile(dir, pathname)
      if (filePath) return new Response(Bun.file(filePath))

      const notFound = Bun.file(notFoundPath)
      if (await notFound.exists()) return new Response(notFound, { status: 404 })
      return new Response('Not found', { status: 404 })
    },
  })
}

function readFlag(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag)
  if (index >= 0) return args[index + 1]
  const inline = args.find((arg) => arg.startsWith(`${flag}=`))
  return inline?.slice(flag.length + 1)
}

if (import.meta.main) {
  const args = process.argv.slice(2)
  const port = Number(readFlag(args, '--port') ?? process.env.PORT ?? 4321)
  const server = startPreview({ port, hostname: readFlag(args, '--host') })
  // biome-ignore lint/suspicious/noConsole: build-time CLI — the URL is the point
  console.log(`[preview] serving ${DIST_DIR} at ${server.url}`)
}
