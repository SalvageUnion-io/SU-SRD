/**
 * ports — each checkout's own dev-server ports, so parallel worktrees never
 * share one.
 *
 * On a fixed port (srd's dev server on 4321), a
 * second worktree either fails to start its server or, worse, `bun run shot`
 * and srd's Playwright suite reuse the first checkout's server and silently
 * measure that checkout's code.
 *
 * - The primary checkout (its `.git` is a directory) and CI keep the base
 *   ports: `.claude/launch.json`, `wrangler.jsonc`'s `dev.port` and the CI
 *   workflows name them.
 * - A linked worktree (its `.git` is a file) adds an offset of 1–99 hashed
 *   from its own path: stable across restarts, distinct between worktrees
 *   but for a rare collision.
 * - An explicit `PORT` wins over both. The browser preview
 *   (`.claude/launch.json`, `autoPort`) always starts a server with `PORT` set
 *   to the port it waits on: the base port, or a free one when another
 *   checkout holds that. `tools/shot.ts` passes `PORT` too.
 * - The dev server answers with
 *   `x-su-checkout: <this checkout's root>`, so a client that finds its port
 *   busy can tell its own server from another checkout's (a collision, or a
 *   stale process) and refuse the latter, as `tools/shot.ts` does.
 */
import { createHash } from 'node:crypto'
import { realpathSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** The port the primary checkout's dev server listens on: srd, and the Cantina under `/build`. */
export const BASE_PORTS = { srd: 4321 } as const
export type DevServer = keyof typeof BASE_PORTS

/** The response header each dev server names its checkout in. */
export const CHECKOUT_HEADER = 'x-su-checkout'

/** Offsets run 1..SPAN-1; 0 is the primary checkout's. */
const SPAN = 100

/** This checkout's root, symlinks resolved: three levels above `packages/gates/lib/`. */
export const CHECKOUT_ROOT = realpathSync(fileURLToPath(new URL('../../../', import.meta.url)))

/** True for the primary checkout, whose `.git` is a directory (a linked worktree's is a file). */
export function isPrimaryCheckout(root: string): boolean {
  try {
    return statSync(join(root, '.git')).isDirectory()
  } catch {
    // No `.git` at all (an exported tree): nothing shares its ports.
    return true
  }
}

/** 0 for the primary checkout, else 1..99 hashed from the checkout's path. */
export function portOffset(root: string, primary: boolean): number {
  if (primary) return 0
  const hash = createHash('sha256').update(root).digest().readUInt32BE(0)
  return 1 + (hash % (SPAN - 1))
}

/** The port `server` listens on in this checkout (CI always uses the base port). */
export function portFor(
  server: DevServer,
  { root = CHECKOUT_ROOT, ci = Boolean(process.env.CI) }: { root?: string; ci?: boolean } = {}
): number {
  return BASE_PORTS[server] + (ci ? 0 : portOffset(root, isPrimaryCheckout(root)))
}
