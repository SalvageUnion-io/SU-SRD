/**
 * The Worker's JSON routes as a test file reaches them (`lib/connection/workerRead.ts`):
 * `answerRoutes` names each path's value for this test, held before the
 * render, and every `POST` is kept in `routeWrites`. A read of a path it did
 * not name is never answered, so the screen stays loading; `routeAsks` says
 * what it asked.
 *
 * Call `withWorkerRoutes()` once at the top level of a test file: it stands
 * in for `fetch` before each test, and puts it back and drops every held read
 * after.
 */

import { afterEach, beforeEach } from 'bun:test'
import { forgetWorkerReads, holdWorkerRead } from '../../connection/workerRead'

let answers: Record<string, unknown> = {}

/** Every write a test made, oldest first: its path and its body. */
export const routeWrites: { path: string; body: unknown }[] = []

/** Every path a read asked the route for, past what `answerRoutes` held. */
export const routeAsks: string[] = []

/**
 * This test's answers by path (`/__shared/sheets/pilot/p-1`); replaces the
 * last test's. Each read is held at once, so a screen draws it on its first
 * render, as a query a mock answered did.
 */
export function answerRoutes(next: Record<string, unknown>): void {
  answers = next
  forgetWorkerReads()
  for (const [path, value] of Object.entries(next)) holdWorkerRead(path, value)
}

function respond(path: string): Response {
  if (!(path in answers)) throw new Error(`No answer for the Worker route ${path}`)
  return Response.json({ value: answers[path] })
}

export function withWorkerRoutes(): void {
  const realFetch = globalThis.fetch
  beforeEach(() => {
    answers = {}
    routeWrites.length = 0
    routeAsks.length = 0
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const path =
        typeof input === 'string' ? input : input instanceof URL ? input.pathname : input.url
      if (init?.method === 'POST') {
        routeWrites.push({ path, body: JSON.parse(String(init.body ?? 'null')) })
        // A write the test named no answer for lands, answering nothing.
        if (!(path in answers)) return Response.json({ value: null })
      } else routeAsks.push(path)
      return respond(path)
    }) as typeof fetch
  })
  afterEach(() => {
    globalThis.fetch = realFetch
    forgetWorkerReads()
  })
}
