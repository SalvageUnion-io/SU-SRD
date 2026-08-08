/**
 * `ssg/snapshot.ts` — the output gate that replaced `ssg/parity.ts`.
 *
 * The point of these tests is the property ADR-031 insisted on for parity and
 * which is the only thing that makes a gate worth having: **it has to bite.**
 * "Zero differences" is a result only if a non-zero result is reachable, so
 * every check the gate claims to perform is exercised here by injecting the
 * corresponding defect into a fixture `dist` and asserting it is reported.
 *
 * Fixtures are written to a throwaway directory rather than mocked, so the
 * filesystem walk, the path normalization and the digesting are all real.
 */
import { afterAll, describe, expect, it } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import {
  buildSnapshot,
  compare,
  isContentDigested,
  normalizeEmittedPath,
  run,
  serializeSnapshot,
} from '../snapshot'

const page = (opts: {
  title?: string
  description?: string
  canonical?: string
  og?: string
  jsonLd?: string
  main?: string
}) =>
  `<!doctype html><html lang="en"><head>` +
  `<title>${opts.title ?? 'Mule'}</title>` +
  `<meta name="description" content="${opts.description ?? 'A hauling Mech.'}"/>` +
  `<link rel="canonical" href="${opts.canonical ?? 'https://salvageunion.io/chassis/mule'}"/>` +
  `<meta property="og:title" content="${opts.og ?? 'Mule'}"/>` +
  (opts.jsonLd === undefined
    ? '<script type="application/ld+json">{"@type":"WebPage","name":"Mule"}</script>'
    : opts.jsonLd) +
  `</head><body><main>${opts.main ?? 'The M-63 Mule hauls cargo.'}</main></body></html>`

const CHANGELOG_BASE = 'v2.0.0 fixed the cargo bay. v1.0.0 first release.'

/** A minimal but structurally real `dist`. */
const FIXTURE: Record<string, string> = {
  'index.html': page({ title: 'SRD', main: 'Welcome to the Salvage Union SRD.' }),
  'schema/chassis/item/mule/index.html': page({}),
  'changelog/index.html': page({ title: 'Changelog', main: CHANGELOG_BASE }),
  'schema/chassis.json': '{"items":[{"name":"Mule","tech":1}]}',
  'llms.txt': '# Salvage Union\n\n- /chassis/mule\n',
  _headers: '/*\n  X-Frame-Options: DENY\n',
  'assets/islands-DAnO9BIm.js': 'console.log(1)',
  'og-image.png': 'not-really-a-png',
}

/** Every fixture root written, so `afterAll` can remove them. */
const roots: string[] = []

const writeDist = async (files: Record<string, string>): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), 'srd-snapshot-'))
  roots.push(root)
  for (const [path, body] of Object.entries(files)) {
    const full = join(root, path)
    await mkdir(dirname(full), { recursive: true })
    await writeFile(full, body)
  }
  return root
}

/** Snapshot the fixture, then snapshot a mutated copy, and diff. */
const findingsFor = async (mutate: (files: Record<string, string>) => void) => {
  const base = await buildSnapshot(await writeDist(FIXTURE))
  const mutated = { ...FIXTURE }
  mutate(mutated)
  const after = await buildSnapshot(await writeDist(mutated))
  return compare(base, after)
}

afterAll(async () => {
  await Promise.all(roots.map((r) => rm(r, { recursive: true, force: true })))
})

describe('snapshot gate — it agrees with itself', () => {
  it('reports zero findings for an unchanged build', async () => {
    const root = await writeDist(FIXTURE)
    const a = await buildSnapshot(root)
    const b = await buildSnapshot(root)
    expect(compare(a, b)).toEqual([])
  })

  it('round-trips through its serialized form', async () => {
    const snapshot = await buildSnapshot(await writeDist(FIXTURE))
    const reparsed = JSON.parse(serializeSnapshot(snapshot))
    expect(compare(snapshot, reparsed)).toEqual([])
    expect(reparsed.counts.html).toBe(3)
  })
})

describe('snapshot gate — it bites', () => {
  it('catches a page that stopped being emitted (a dropped route)', async () => {
    const findings = await findingsFor((files) => {
      delete files['schema/chassis/item/mule/index.html']
    })
    expect(findings).toContainEqual({
      kind: 'file-set',
      path: 'schema/chassis/item/mule/index.html',
      detail: 'emitted before, MISSING now',
    })
  })

  it('catches a page that appeared', async () => {
    const findings = await findingsFor((files) => {
      files['secret/index.html'] = page({ title: 'Secret' })
    })
    expect(findings.some((f) => f.kind === 'file-set' && f.path === 'secret/index.html')).toBe(true)
  })

  it('catches a changed <title>, and says what it became', async () => {
    const findings = await findingsFor((files) => {
      files['schema/chassis/item/mule/index.html'] = page({ title: 'Muel' })
    })
    const detail = findings.find((f) => f.detail.startsWith('title:'))?.detail
    expect(detail).toBe('title: "Mule" -> "Muel"')
  })

  it('catches a changed meta description', async () => {
    const findings = await findingsFor((files) => {
      files['schema/chassis/item/mule/index.html'] = page({ description: 'Something else.' })
    })
    expect(findings.some((f) => f.detail.startsWith('description:'))).toBe(true)
  })

  it('catches a changed canonical link', async () => {
    const findings = await findingsFor((files) => {
      files['schema/chassis/item/mule/index.html'] = page({ canonical: 'https://example.com/x' })
    })
    expect(findings.some((f) => f.detail.startsWith('canonical:'))).toBe(true)
  })

  it('catches a changed og/twitter tag', async () => {
    const findings = await findingsFor((files) => {
      files['schema/chassis/item/mule/index.html'] = page({ og: 'Something Else' })
    })
    expect(findings.some((f) => f.detail === 'og/twitter tags changed')).toBe(true)
  })

  it('catches a dropped JSON-LD block', async () => {
    const findings = await findingsFor((files) => {
      files['schema/chassis/item/mule/index.html'] = page({ jsonLd: '' })
    })
    const detail = findings.find((f) => f.detail.startsWith('json-ld:'))?.detail
    expect(detail).toBe('json-ld: [WebPage] -> []')
  })

  it('catches changed <main> visible text', async () => {
    const findings = await findingsFor((files) => {
      files['schema/chassis/item/mule/index.html'] = page({ main: 'The Mule no longer hauls.' })
    })
    expect(findings.some((f) => f.detail.startsWith('main text changed'))).toBe(true)
  })

  it('catches a changed JSON endpoint', async () => {
    const findings = await findingsFor((files) => {
      files['schema/chassis.json'] = '{"items":[{"name":"Mule","tech":2}]}'
    })
    expect(findings).toContainEqual(
      expect.objectContaining({ kind: 'content', path: 'schema/chassis.json' })
    )
  })

  it('catches a changed llms.txt', async () => {
    const findings = await findingsFor((files) => {
      files['llms.txt'] = '# Salvage Union\n'
    })
    expect(findings.some((f) => f.kind === 'content' && f.path === 'llms.txt')).toBe(true)
  })
})

describe('snapshot gate — it does NOT fire on non-changes', () => {
  it('ignores JSON key reordering, which is not a content change', async () => {
    const findings = await findingsFor((files) => {
      files['schema/chassis.json'] = '{"items":[{"tech":1,"name":"Mule"}]}'
    })
    expect(findings).toEqual([])
  })

  it('ignores a new content hash in a bundle filename', async () => {
    const findings = await findingsFor((files) => {
      delete files['assets/islands-DAnO9BIm.js']
      files['assets/islands-ZZZZZZZZ.js'] = 'console.log(2)'
    })
    expect(findings).toEqual([])
  })

  it('normalizes only bundle paths, never real page paths', () => {
    expect(normalizeEmittedPath('assets/islands-DAnO9BIm.js')).toBe('assets/islands-[hash].js')
    // Vite's hash alphabet is base64url, so a hyphen inside the hash is normal.
    expect(normalizeEmittedPath('assets/barlow-400-qiz4-Cze.woff2')).toBe(
      'assets/barlow-400-[hash].woff2'
    )
    // A page that merely looks hash-like must survive untouched.
    expect(normalizeEmittedPath('schema/chassis/item/abcdefgh/index.html')).toBe(
      'schema/chassis/item/abcdefgh/index.html'
    )
  })

  it('digests page content but not bundle or service-worker bytes', () => {
    expect(isContentDigested('schema/chassis.json')).toBe(true)
    expect(isContentDigested('llms.txt')).toBe(true)
    expect(isContentDigested('_headers')).toBe(true)
    expect(isContentDigested('assets/islands-DAnO9BIm.js')).toBe(false)
    expect(isContentDigested('sw.js')).toBe(false)
    expect(isContentDigested('og-image.png')).toBe(false)
  })
})

describe('snapshot gate — the /changelog append-only exemption is a real assertion', () => {
  it('allows a new entry to be prepended', async () => {
    const findings = await findingsFor((files) => {
      files['changelog/index.html'] = page({
        title: 'Changelog',
        main: `v3.0.0 added Games. ${CHANGELOG_BASE}`,
      })
    })
    expect(findings).toEqual([])
  })

  it('allows a new entry to be appended', async () => {
    const findings = await findingsFor((files) => {
      files['changelog/index.html'] = page({
        title: 'Changelog',
        main: `${CHANGELOG_BASE} v0.9.0 beta.`,
      })
    })
    expect(findings).toEqual([])
  })

  it('FAILS when an existing entry is deleted', async () => {
    const findings = await findingsFor((files) => {
      files['changelog/index.html'] = page({
        title: 'Changelog',
        main: 'v2.0.0 fixed the cargo bay.',
      })
    })
    expect(findings.some((f) => f.kind === 'append-only')).toBe(true)
  })

  it('FAILS when an existing entry is reworded', async () => {
    const findings = await findingsFor((files) => {
      files['changelog/index.html'] = page({
        title: 'Changelog',
        main: 'v2.0.0 BROKE the cargo bay. v1.0.0 first release.',
      })
    })
    expect(findings.some((f) => f.kind === 'append-only')).toBe(true)
  })

  it('FAILS when existing entries are reordered', async () => {
    const findings = await findingsFor((files) => {
      files['changelog/index.html'] = page({
        title: 'Changelog',
        main: 'v1.0.0 first release. v2.0.0 fixed the cargo bay.',
      })
    })
    expect(findings.some((f) => f.kind === 'append-only')).toBe(true)
  })

  it('still checks everything ELSE on an append-only page', async () => {
    // The exemption covers <main> text only. A title regression on /changelog
    // must not slip through it — the reason the append-only branch is if/else
    // rather than an early return.
    const findings = await findingsFor((files) => {
      files['changelog/index.html'] = page({
        title: 'Chnagelog',
        main: `v3.0.0 new. ${CHANGELOG_BASE}`,
      })
    })
    expect(findings.some((f) => f.detail === 'title: "Changelog" -> "Chnagelog"')).toBe(true)
  })
})

/**
 * `run()` — the exit code IS the gate.
 *
 * Everything above tests `compare()`, which returns findings. CI does not read
 * findings; it reads a process exit code, and that translation lives in `run()`.
 * A comparator that finds a difference and a runner that returns 0 anyway is a
 * gate that reports problems and blocks nothing — the retired parity gate's
 * failure in a different form. So these drive the real entry point end to end.
 */
describe('snapshot gate — run() returns the exit code CI acts on', () => {
  /**
   * Write a dist, bless it into a snapshot file, and hand back both.
   *
   * The snapshot lives in its own temp dir, NOT inside the dist — the gate
   * asserts the emitted file set in both directions, so a snapshot written
   * under `dist/` is itself an unexpected file and every comparison fails by
   * one. (Which is the gate being right, and this helper being wrong.)
   */
  const blessed = async (files: Record<string, string>) => {
    const dist = await writeDist(files)
    const holder = await mkdtemp(join(tmpdir(), 'srd-snapshot-blessed-'))
    roots.push(holder)
    const snapshot = join(holder, 'snapshot.json')
    await writeFile(snapshot, serializeSnapshot(await buildSnapshot(dist)))
    return { dist, snapshot }
  }

  /** The same fixture with one page's visible text rewritten. */
  const rewritten = (): Record<string, string> => ({
    ...FIXTURE,
    'about/index.html': page({ title: 'About', main: 'Rewritten entirely.' }),
  })

  it('returns 0 when the built output matches', async () => {
    const { dist, snapshot } = await blessed(FIXTURE)
    expect(await run({ dist, snapshot, update: false })).toBe(0)
  })

  it('returns 1 when the output drifted', async () => {
    const { snapshot } = await blessed(FIXTURE)
    const dist = await writeDist(rewritten())
    expect(await run({ dist, snapshot, update: false })).toBe(1)
  })

  it('returns 2 — not 0 — when there is no build to check', async () => {
    // A missing dist must not read as "nothing changed". Returning 0 here would
    // let any job that forgot to build report a clean gate.
    const { snapshot } = await blessed(FIXTURE)
    const absent = join(tmpdir(), 'srd-snapshot-dist-that-does-not-exist')
    expect(await run({ dist: absent, snapshot, update: false })).toBe(2)
  })

  it('--update re-blesses, so the next run passes', async () => {
    const { snapshot } = await blessed(FIXTURE)
    const dist = await writeDist(rewritten())

    expect(await run({ dist, snapshot, update: false })).toBe(1)
    expect(await run({ dist, snapshot, update: true })).toBe(0)
    expect(await run({ dist, snapshot, update: false })).toBe(0)
  })
})
