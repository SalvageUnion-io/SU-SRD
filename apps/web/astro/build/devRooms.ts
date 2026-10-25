/**
 * The rooms in dev: `wrangler dev` runs the site Worker, Durable Objects and
 * all, beside `astro dev`, which hands it everything under `ROOMS_PATH`
 * (requests and socket upgrades). State persists in `.wrangler/state/`.
 */

import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { request } from 'node:http'
import { connect } from 'node:net'
import type { Duplex } from 'node:stream'
import { fileURLToPath } from 'node:url'
import type { Connect, Plugin } from 'vite'
import { ROOMS_PATH } from '../../src/rooms/routes'

const APP_DIR = fileURLToPath(new URL('../..', import.meta.url))

function isRoomsPath(pathname: string): boolean {
  return pathname === ROOMS_PATH || pathname.startsWith(`${ROOMS_PATH}/`)
}

/** Starts `wrangler dev` on `port`; it stops with this process. */
function startRooms(port: number): void {
  // wrangler refuses a missing assets directory; the rooms need none of it.
  mkdirSync(`${APP_DIR}/dist`, { recursive: true })
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
    ],
    { cwd: APP_DIR, stdio: ['ignore', 'inherit', 'inherit'] }
  )
  process.on('exit', () => child.kill())
}

function proxyRooms(port: number, req: IncomingMessage, res: ServerResponse): void {
  const upstream = request(
    { host: '127.0.0.1', port, path: req.url, method: req.method, headers: req.headers },
    (answer) => {
      res.writeHead(answer.statusCode ?? 502, answer.headers)
      answer.pipe(res)
    }
  )
  upstream.on('error', () => {
    res.statusCode = 502
    res.end('rooms not running')
  })
  req.pipe(upstream)
}

function proxyRoomsUpgrade(port: number, req: IncomingMessage, socket: Duplex, head: Buffer): void {
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

/** Dev only: the rooms on `port`, ahead of Astro's own middleware. */
export function roomsInDev(port: number): Plugin {
  return {
    name: 'rooms-in-dev',
    apply: 'serve',
    configureServer(server) {
      startRooms(port)
      const rooms: Connect.NextHandleFunction = (req, res, next) => {
        if (!isRoomsPath(new URL(req.url ?? '/', 'http://localhost').pathname)) return next()
        proxyRooms(port, req, res)
      }
      // Vite's HMR socket takes only its own upgrades; a room's socket goes on.
      server.httpServer?.on('upgrade', (req, socket, head) => {
        if (isRoomsPath(new URL(req.url ?? '/', 'http://localhost').pathname)) {
          proxyRoomsUpgrade(port, req, socket, head)
        }
      })
      // To the front of the stack once Astro has put its own there (`./appPlugins`).
      return () => {
        server.middlewares.stack.unshift({ route: '', handle: rooms })
      }
    },
  }
}
