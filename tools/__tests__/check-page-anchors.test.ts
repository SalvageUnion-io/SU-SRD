import { afterAll, describe, expect, spyOn, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { main } from '../check-page-anchors'

const temps: string[] = []

/** A built site: each path's page as its `index.html`. */
function site(pages: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'page-anchors-'))
  temps.push(root)
  for (const [path, body] of Object.entries(pages)) {
    const file = join(root, path, 'index.html')
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, body)
  }
  return root
}

afterAll(() => {
  for (const t of temps) rmSync(t, { recursive: true, force: true })
})

describe('page-anchors', () => {
  test('passes a site whose in-page links all land, across pages too', async () => {
    const log = spyOn(console, 'log').mockImplementation(() => {})
    const dist = site({
      '': '<a href="/classes/hacker/#training">t</a>',
      'classes/hacker': '<h2 id="training">T</h2><a href="#training">t</a>',
    })
    expect(await main(dist)).toBe(0)
    log.mockRestore()
  })

  test('fails on an in-page link with no target, naming the link and its page', async () => {
    const error = spyOn(console, 'error').mockImplementation(() => {})
    const dist = site({
      '': '<a href="/classes/hacker/#kit">k</a>',
      'classes/hacker': '<h2 id="training">T</h2><a href="#join">j</a>',
    })
    expect(await main(dist)).toBe(1)
    const said = String(error.mock.calls[0]?.[0])
    expect(said).toContain('/classes/hacker/#kit')
    expect(said).toContain('#join')
    expect(said).toContain('classes/hacker/index.html')
    error.mockRestore()
  })

  test('leaves the app’s pages to their own tests: its shell draws them in the browser', async () => {
    const log = spyOn(console, 'log').mockImplementation(() => {})
    const dist = site({
      '': '<a href="/build/#pilots">p</a><a href="/games/#join">j</a>',
      build: '<div id="root"></div><a href="#never">n</a>',
    })
    expect(await main(dist)).toBe(0)
    log.mockRestore()
  })

  test('with no build on disk it says so and passes', async () => {
    const log = spyOn(console, 'log').mockImplementation(() => {})
    expect(await main(join(tmpdir(), 'page-anchors-none'))).toBe(0)
    expect(String(log.mock.calls[0]?.[0])).toContain('bun run build')
    log.mockRestore()
  })
})
