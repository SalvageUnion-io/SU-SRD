/**
 * The site Worker in dev: `wrangler dev` runs it, rooms and shared database
 * and all, beside `astro dev`, which hands it every path only the Worker
 * answers (`isWorkerPath`: sign-in, the rooms and their sockets, the shared
 * reads, photos, error reports, Homebrew). The test sign-in is on, and the
 * shared database's migrations are applied first. State persists in
 * `.wrangler/state/`, or `DEV_ROOMS_STATE` (`bun run dev:backend`).
 */

import { spawn, spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { request } from 'node:http'
import { connect } from 'node:net'
import type { Duplex } from 'node:stream'
import { fileURLToPath } from 'node:url'
import type { Connect, Plugin } from 'vite'
import { AUTH_PREFIX } from '../../src/lib/auth/paths'
import { HOMEBREW_PATTERNS_PATH } from '../../src/lib/homebrew/endpoint'
import { PHOTOS_PATH, SHARED_PATH } from '../../src/lib/sharing/paths'
import { ROOMS_PATH } from '../../src/rooms/routes'
import { ERROR_REPORT_PATH } from '../../src/worker/errorReports'

const APP_DIR = fileURLToPath(new URL('../..', import.meta.url))

const WORKER_TREES = [ROOMS_PATH, SHARED_PATH, PHOTOS_PATH]

/** @public A path the Worker answers and the dev server does not. */
export function isWorkerPath(pathname: string): boolean {
  return (
    pathname.startsWith(AUTH_PREFIX) ||
    pathname === HOMEBREW_PATTERNS_PATH ||
    pathname === ERROR_REPORT_PATH ||
    WORKER_TREES.some((tree) => pathname === tree || pathname.startsWith(`${tree}/`))
  )
}

/** `--persist-to` when the state lives elsewhere than `.wrangler/state/`. */
function persistArgs(state = process.env.DEV_ROOMS_STATE): string[] {
  return state ? ['--persist-to', state] : []
}

/** Starts `wrangler dev` on `port`, migrations applied; it stops with this process. */
function startWorker(port: number): void {
  // wrangler refuses a missing assets directory; the Worker's paths need none of it.
  mkdirSync(`${APP_DIR}/dist`, { recursive: true })
  spawnSync(
    'bunx',
    ['wrangler', 'd1', 'migrations', 'apply', 'SHARED', '--local', ...persistArgs()],
    {
      cwd: APP_DIR,
      stdio: ['ignore', 'inherit', 'inherit'],
    }
  )
  const child = spawn(
    'bunx',
    [
      'wrangler',
      'dev',
      '--port',
      String(port),
      '--ip',
      '127.0.0.1',
      '--show-interactive-dev-session=false',
      '--var',
      'TEST_AUTH:true',
      ...persistArgs(),
    ],
    { cwd: APP_DIR, stdio: ['ignore', 'inherit', 'inherit'] }
  )
  process.on('exit', () => child.kill())
}

function proxyWorker(port: number, req: IncomingMessage, res: ServerResponse): void {
  const upstream = request(
    { host: '127.0.0.1', port, path: req.url, method: req.method, headers: req.headers },
    (answer) => {
      res.writeHead(answer.statusCode ?? 502, answer.headers)
      answer.pipe(res)
    }
  )
  upstream.on('error', () => {
    res.statusCode = 502
    res.end('the Worker is not running')
  })
  req.pipe(upstream)
}

function proxyWorkerUpgrade(
  port: number,
  req: IncomingMessage,
  socket: Duplex,
  head: Buffer
): void {
  const upstream = connect(port, '127.0.0.1', () => {
    const lines = [`${req.method} ${req.url} HTTP/1.1`]
    for (let i = 0; i < req.rawHeaders.length; i += 2) {
      lines.push(`${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}`)
    }
    upstream.write(`${lines.join('\r\n')}\r\n\r\n`)
    upstream.write(head)
    upstream.pipe(socket).pipe(upstream)
  })
  upstream.on('error', () => socket.destroy())
  socket.on('error', () => upstream.destroy())
}

/** Dev only: the Worker on `port`, ahead of Astro's own middleware. */
export function workerInDev(port: number): Plugin {
  return {
    name: 'worker-in-dev',
    apply: 'serve',
    configureServer(server) {
      startWorker(port)
      const worker: Connect.NextHandleFunction = (req, res, next) => {
        if (!isWorkerPath(new URL(req.url ?? '/', 'http://localhost').pathname)) return next()
        proxyWorker(port, req, res)
      }
      // Vite's HMR socket takes only its own upgrades; a room's socket goes on.
      server.httpServer?.on('upgrade', (req, socket, head) => {
        if (isWorkerPath(new URL(req.url ?? '/', 'http://localhost').pathname)) {
          proxyWorkerUpgrade(port, req, socket, head)
        }
      })
      // To the front of the stack once Astro has put its own there (`./appPlugins`).
      return () => {
        server.middlewares.stack.unshift({ route: '', handle: worker })
      }
    },
  }
}
