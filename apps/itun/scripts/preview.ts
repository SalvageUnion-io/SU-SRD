/**
 * preview — serve the built `dist/` as static files, with this app's SPA rules.
 *
 * ## Why this exists rather than `vite preview`
 *
 * The e2e `webServer` used `bunx --bun vite preview`, and it hung: the server
 * printed the TanStack Router plugin's output and then never reached `listen`,
 * so Playwright timed out after 240 s with no spec having run. Measured twice on
 * unrelated PRs (#958, #962), passing on re-run in between — roughly one run in
 * two, and never reproducible locally.
 *
 * The cause is structural rather than a bug to chase: `vite preview` loads the
 * FULL Vite config before it serves anything. That means the React plugin, the
 * PWA plugin and TanStack Router's filesystem route generation all run — for a
 * directory of files that were built minutes earlier and will not change. The
 * hang landed exactly at the end of that pass, which is the part with the
 * filesystem watchers in it.
 *
 * Serving a finished build needs none of that. This is ~40 lines with no plugin
 * graph, no config load and no watcher, so there is nothing left to hang. It
 * starts in milliseconds instead of seconds.
 *
 * `apps/srd/ssg/preview.ts` is the same idea for that app, and this file
 * deliberately mirrors its shape (containment check, `--port`/`--host` flags,
 * `startPreview` export). The MAPPING differs because the apps do: srd is
 * multi-page (a directory holds `index.html`), itun is a single-page app.
 *
 * ## The mapping, which is production's
 *
 * Copied from rules 4-7 of `src/worker/index.ts`, because a preview server that
 * answers differently from the Worker tests the wrong thing:
 *
 *   /assets/<hashed chunk>   -> the file, or 404. NEVER the shell.
 *   /favicon.ico, /sw.js     -> the file, or 404 (a dot in the last segment
 *                               means a FILE was wanted)
 *   /roster, /pilots/new     -> index.html, 200 (a client-side route)
 *
 * The `/assets/*` rule has its own incident behind it (#759): SPA-mode fallback
 * answered 200 `text/html` for a rotated-away chunk, the failed import rejected
 * on MIME type, and the `immutable` header pinned that HTML under the chunk's
 * URL for a year. The dotted-segment rule has one too — `/robots.txt` and
 * `/sitemap.xml` served the app in the body, making the origin an infinite well
 * of soft-404s.
 *
 * This is a test convenience server. It sets no caching or security headers;
 * `public/_headers` and the Worker own those in production.
 */

import { join, normalize, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Server } from 'bun'

const DIST_DIR = fileURLToPath(new URL('../dist', import.meta.url))

export type PreviewOptions = {
  /** Directory to serve. Defaults to this app's `dist/`. */
  dir?: string
  /** Defaults to 5173 — the port `playwright.config.ts` and the specs assume. */
  port?: number
  /** Defaults to Bun's own (all interfaces), so `localhost` resolves. */
  hostname?: string
}

/**
 * Resolve a pathname to a file inside `dir`, or null when there is none.
 *
 * Containment is checked on the NORMALIZED path, so `..` segments — and their
 * percent-encoded forms, which are decoded first — cannot escape `dir`.
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

  const file = Bun.file(target)
  return (await file.exists()) ? target : null
}

/** No websockets here, hence `Server<undefined>` — a plain static HTTP server. */
export function startPreview(options: PreviewOptions = {}): Server<undefined> {
  const dir = normalize(options.dir ?? DIST_DIR)
  const shellPath = join(dir, 'index.html')

  return Bun.serve({
    port: options.port ?? 5173,
    hostname: options.hostname,
    async fetch(request) {
      const { pathname } = new URL(request.url)

      const filePath = await resolveFile(dir, pathname)
      if (filePath) return new Response(Bun.file(filePath))

      // A missing asset is a 404, never the shell. See the header (#759).
      if (pathname.startsWith('/assets/')) {
        return new Response('Not found', { status: 404 })
      }

      // A dot in the last segment means a FILE was wanted, and it is not here.
      const lastSegment = pathname.slice(pathname.lastIndexOf('/') + 1)
      if (lastSegment.includes('.')) {
        return new Response('Not found', { status: 404 })
      }

      // Anything else is a client-side route: serve the shell.
      const shell = Bun.file(shellPath)
      if (await shell.exists()) return new Response(shell)
      return new Response(`No index.html in ${dir} — was the app built?`, { status: 500 })
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
  const port = Number(readFlag(args, '--port') ?? process.env.PORT ?? 5173)
  const server = startPreview({ port, hostname: readFlag(args, '--host') })
  // biome-ignore lint/suspicious/noConsole: build-time CLI — the URL is the point
  console.log(`[preview] serving ${DIST_DIR} at ${server.url}`)
}
