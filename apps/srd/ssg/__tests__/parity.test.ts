/**
 * `ssg/parity.ts` — the acceptance gate for the Astro → in-house SSG migration.
 *
 * The gate's own claim is "zero differences across 1,039 pages", and the only
 * thing standing between that and "the comparator silently agrees with itself"
 * is whether it still BITES. So this file is in two halves:
 *
 *   1. the tolerant HTML scanning it is built on — a hand-rolled parser whose
 *      failure mode is not a crash but a quietly-dropped chunk of `<main>`,
 *      which reads as "identical";
 *   2. `run()` end to end, against synthetic baseline/candidate trees, with one
 *      case per fatal category plus the two deliberately non-fatal ones.
 *
 * Everything asserted here is exported by the module already; the parity script
 * exports its helpers precisely so the gate can be checked rather than trusted.
 */

import { describe, expect, it, spyOn } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import {
  canonicalize,
  decodeEntities,
  extractHeadMeta,
  extractJsonLd,
  extractMainInner,
  firstJsonDiff,
  isBundleAsset,
  isInsertionOf,
  NON_SSR_ISLANDS,
  normalizeText,
  parseArgs,
  parseAttrs,
  run,
  stripNonSsrIslands,
  textExcerpt,
} from '../parity'

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

/** Files keyed by dist-relative path. */
type Tree = Record<string, string>

async function writeTree(files: Tree): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'srd-parity-'))
  for (const [path, contents] of Object.entries(files)) {
    const target = join(root, path)
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, contents, 'utf-8')
  }
  return root
}

type ParityResult = { code: number; stdout: string; stderr: string }

/**
 * Run the gate over two synthetic trees, capturing what it printed.
 *
 * `run` reports through `process.stdout`/`process.stderr` rather than returning
 * its findings, so the report text IS the interface for everything except the
 * exit code — and "which category failed" only exists there.
 */
async function runGate(
  baselineFiles: Tree,
  candidateFiles: Tree,
  overrides: { ignoreIslandText?: boolean; strictAssets?: boolean; limit?: number } = {}
): Promise<ParityResult> {
  const baseline = await writeTree(baselineFiles)
  const candidate = await writeTree(candidateFiles)
  const out: string[] = []
  const err: string[] = []
  const capture =
    (sink: string[]) =>
    (chunk: unknown): boolean => {
      sink.push(String(chunk))
      return true
    }
  const outSpy = spyOn(process.stdout, 'write').mockImplementation(
    capture(out) as typeof process.stdout.write
  )
  const errSpy = spyOn(process.stderr, 'write').mockImplementation(
    capture(err) as typeof process.stderr.write
  )
  try {
    const code = await run({
      baseline,
      candidate,
      limit: overrides.limit ?? 20,
      ignoreIslandText: overrides.ignoreIslandText ?? true,
      strictAssets: overrides.strictAssets ?? false,
    })
    return { code, stdout: out.join(''), stderr: err.join('') }
  } finally {
    outSpy.mockRestore()
    errSpy.mockRestore()
    await rm(baseline, { recursive: true, force: true })
    await rm(candidate, { recursive: true, force: true })
  }
}

/** The gate's status line for one category, e.g. `[FAIL] <main> visible text`. */
function statusOf(report: string, category: string): string | undefined {
  return new RegExp(`\\[(PASS|FAIL|WARN)\\] ${category.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)
    .exec(report)
    ?.at(1)
}

type PageParts = { title?: string; description?: string; canonical?: string; main?: string }

function page({
  title = 'Aegis',
  description = 'A chassis.',
  canonical = 'https://salvageunion.io/schema/chassis/item/aegis/',
  main = '<h1>Aegis</h1>',
}: PageParts = {}): string {
  return (
    `<!doctype html><html lang="en"><head><title>${title}</title>` +
    `<meta name="description" content="${description}">` +
    `<link rel="canonical" href="${canonical}">` +
    `<meta property="og:title" content="${title}">` +
    `</head><body><main>${main}</main></body></html>`
  )
}

// ---------------------------------------------------------------------------
// Tolerant HTML scanning
// ---------------------------------------------------------------------------

describe('decodeEntities', () => {
  it('decodes the named entities the site actually emits', () => {
    expect(decodeEntities('a &amp; b')).toBe('a & b')
    expect(decodeEntities('&quot;quoted&quot;')).toBe('"quoted"')
    expect(decodeEntities('It&rsquo;s 30&deg; &mdash; hot')).toBe('It’s 30° — hot')
    // A real U+00A0, not a plain space: `normalizeText` is what folds the two
    // together, and it must be the only place that does.
    expect(decodeEntities('&nbsp;')).toBe('\u00a0')
    expect(normalizeText('a&nbsp;b')).toBe('a b')
  })

  it('decodes decimal and hexadecimal numeric references', () => {
    expect(decodeEntities('&#8212;')).toBe('—')
    expect(decodeEntities('&#x2014;')).toBe('—')
  })

  it('leaves an unknown entity exactly as written', () => {
    // Dropping it would silently make two different texts compare equal.
    expect(decodeEntities('&notarealentity;')).toBe('&notarealentity;')
    expect(decodeEntities('a & b')).toBe('a & b')
  })

  it('returns input untouched when there is no ampersand at all', () => {
    expect(decodeEntities('plain text')).toBe('plain text')
  })
})

describe('parseAttrs', () => {
  it('reads double-quoted, single-quoted and bare attributes', () => {
    expect(parseAttrs('name="description" content=\'x\' hidden')).toEqual({
      name: 'description',
      content: 'x',
      hidden: '',
    })
  })

  it('lowercases attribute names but not values', () => {
    expect(parseAttrs('REL="Canonical" HREF="/About/"')).toEqual({
      rel: 'Canonical',
      href: '/About/',
    })
  })

  it('keeps the FIRST value when an attribute is repeated', () => {
    expect(parseAttrs('content="one" content="two"').content).toBe('one')
  })

  it('decodes entities in values, so an href compares as the browser sees it', () => {
    expect(parseAttrs('href="/a?x=1&amp;y=2"').href).toBe('/a?x=1&y=2')
  })
})

describe('isBundleAsset', () => {
  it('recognizes both builds’ hashed output', () => {
    expect(isBundleAsset('_astro/index.Bx1.js')).toBe(true)
    expect(isBundleAsset('assets/islands-DEADBEEF.js')).toBe(true)
    expect(isBundleAsset('.vite/manifest.json')).toBe(true)
    expect(isBundleAsset('workbox-1a2b3c4d.js')).toBe(true)
  })

  it('does not swallow content — that is the difference between WARN and FAIL', () => {
    expect(isBundleAsset('index.html')).toBe(false)
    expect(isBundleAsset('schema/chassis.json')).toBe(false)
    expect(isBundleAsset('llms.txt')).toBe(false)
    expect(isBundleAsset('sitemap-0.xml')).toBe(false)
    // A nested file merely NAMED like the workbox chunk is content.
    expect(isBundleAsset('schema/workbox-1a2b.js')).toBe(false)
  })
})

describe('NON_SSR_ISLANDS', () => {
  it('lists exactly the islands DESIGN.md marks ssr:false', () => {
    expect([...NON_SSR_ISLANDS].sort()).toEqual([
      'MobileNavIsland',
      'MobileSearchIsland',
      'OgCardIsland',
      'ReferenceEntityIsland',
      'SearchIsland',
      'SearchResultsIsland',
    ])
  })

  it('excludes the two islands whose server markup IS the page’s SEO content', () => {
    // Listing either here would stop the gate comparing the entity grid and
    // the colophon prose at all — the exclusion is symmetric, so it would hide
    // a real content regression on both sides at once.
    expect(NON_SSR_ISLANDS.has('SchemaViewerIsland')).toBe(false)
    expect(NON_SSR_ISLANDS.has('ColophonIsland')).toBe(false)
  })
})

describe('extractMainInner', () => {
  it('returns the inner html of the first <main>', () => {
    expect(
      extractMainInner('<body><main class="x"><p>hi</p></main><footer>f</footer></body>')
    ).toBe('<p>hi</p>')
  })

  it('returns null for a page with no <main>', () => {
    // Both sides being null is "not a difference"; one side null is a finding.
    expect(extractMainInner('<html><body><p>bare document</p></body></html>')).toBeNull()
  })

  it('balances a nested <main> instead of stopping at the first close tag', () => {
    expect(extractMainInner('<main>a<main>b</main>c</main>after')).toBe('a<main>b</main>c')
  })

  it('tolerates a `>` inside a quoted attribute on the opening tag', () => {
    expect(extractMainInner('<main data-x="a>b"><p>hi</p></main>')).toBe('<p>hi</p>')
  })

  it('falls back to the rest of the document when <main> is never closed', () => {
    expect(extractMainInner('<main><p>hi</p>')).toBe('<p>hi</p>')
  })
})

describe('stripNonSsrIslands', () => {
  it('drops an Astro <astro-island> whose component is ssr:false', () => {
    const { html, count } = stripNonSsrIslands(
      '<p>keep</p><astro-island component-export="SearchIsland"><input/></astro-island><p>keep2</p>'
    )
    expect(html).toBe('<p>keep</p><p>keep2</p>')
    expect(count).toBe(1)
  })

  it('drops a new-SSG placeholder by name when it carries no data-ssr', () => {
    const { html, count } = stripNonSsrIslands(
      '<div data-island="MobileNavIsland" data-client="idle" data-island-id="i0">nav</div><p>keep</p>'
    )
    expect(html).toBe('<p>keep</p>')
    expect(count).toBe(1)
  })

  it('prefers an explicit data-ssr over the name list, in both directions', () => {
    const stripped = stripNonSsrIslands(
      '<div data-island="SchemaViewerIsland" data-ssr="false">x</div>'
    )
    expect(stripped.count).toBe(1)

    const kept = stripNonSsrIslands('<div data-island="SearchIsland" data-ssr="true">x</div>')
    expect(kept.count).toBe(0)
    expect(kept.html).toContain('x')
  })

  it('keeps the subtree of an island that IS server-rendered', () => {
    const { html, count } = stripNonSsrIslands(
      '<div data-island="SchemaViewerIsland" data-client="visible"><h2>Chassis</h2></div>'
    )
    expect(html).toContain('<h2>Chassis</h2>')
    expect(count).toBe(0)
  })

  it('is a cheap no-op on markup with no islands at all', () => {
    const input = '<p>nothing to do</p>'
    expect(stripNonSsrIslands(input)).toEqual({ html: input, count: 0 })
  })
})

describe('normalizeText', () => {
  it('drops markup and collapses every flavour of whitespace', () => {
    expect(normalizeText('  <p>a</p>\n\t<p>b</p>  ')).toBe('a b')
    expect(normalizeText('a  b　c')).toBe('a b c')
  })

  it('decodes entities so `&amp;` and `&` compare equal', () => {
    expect(normalizeText('<p>Salvage &amp; Union</p>')).toBe('Salvage & Union')
  })

  it('drops doctypes, comments-as-tags and closing tags alike', () => {
    expect(normalizeText('<!doctype html><div class="a>b">x</div>')).toBe('x')
  })
})

describe('extractHeadMeta', () => {
  const html =
    '<html><head><title>  Aegis —\n  Chassis </title>' +
    '<meta name="description" content="A chassis.">' +
    '<meta name="robots" content="noindex, nofollow">' +
    '<link rel="CANONICAL" href="https://salvageunion.io/a/">' +
    '<meta property="og:title" content="Aegis">' +
    '<meta property="og:image" content="/a.png">' +
    '<meta property="og:image" content="/b.png">' +
    '<meta name="twitter:card" content="summary_large_image">' +
    '</head><body><meta property="og:title" content="IN BODY"><title>body title</title></body></html>'

  it('collapses whitespace in the title', () => {
    expect(extractHeadMeta(html).title).toBe('Aegis — Chassis')
  })

  it('reads description, robots and a case-insensitive rel=canonical', () => {
    const meta = extractHeadMeta(html)
    expect(meta.description).toBe('A chassis.')
    expect(meta.robots).toBe('noindex, nofollow')
    expect(meta.canonical).toBe('https://salvageunion.io/a/')
  })

  it('buckets every og:/twitter: key, keeping repeats in document order', () => {
    expect(extractHeadMeta(html).social).toEqual({
      'og:title': ['Aegis'],
      'og:image': ['/a.png', '/b.png'],
      'twitter:card': ['summary_large_image'],
    })
  })

  it('ignores everything below </head>', () => {
    // Otherwise a stray meta in the body would be compared as head metadata.
    expect(extractHeadMeta(html).social['og:title']).not.toContain('IN BODY')
  })

  it('reports nulls for a document with no head metadata', () => {
    expect(extractHeadMeta('<html><body><p>x</p></body></html>')).toEqual({
      title: null,
      description: null,
      canonical: null,
      robots: null,
      social: {},
    })
  })
})

describe('extractJsonLd', () => {
  it('parses every ld+json block and ignores other scripts', () => {
    const blocks = extractJsonLd(
      '<script>var x = 1</script>' +
        '<script type="application/ld+json">{"@type":"WebSite"}</script>' +
        '<script type="application/json" data-island-props>{"i0":{}}</script>' +
        '<script type="APPLICATION/LD+JSON">{"@type":"Product"}</script>'
    )
    expect(blocks).toEqual([
      { ok: true, value: { '@type': 'WebSite' } },
      { ok: true, value: { '@type': 'Product' } },
    ])
  })

  it('records a parse failure instead of throwing', () => {
    const [block] = extractJsonLd('<script type="application/ld+json">{nope}</script>')
    expect(block?.ok).toBe(false)
    expect(block && !block.ok ? block.raw : '').toBe('{nope}')
  })

  it('stops at a closing tag carrying junk, not at the next well-formed one', () => {
    // `</script foo>` closes a script for a real parser. Matching only
    // `</script>` would run past it and hand JSON.parse the following markup.
    const blocks = extractJsonLd(
      '<script type="application/ld+json">{"a":1}</script foo>' +
        '<p>between</p><script>ignored</script>'
    )
    expect(blocks).toEqual([{ ok: true, value: { a: 1 } }])
  })
})

// ---------------------------------------------------------------------------
// Deep comparison
// ---------------------------------------------------------------------------

describe('canonicalize', () => {
  it('is insensitive to key order but not to array order', () => {
    expect(canonicalize({ b: 1, a: 2 })).toBe(canonicalize({ a: 2, b: 1 }))
    expect(canonicalize([1, 2])).not.toBe(canonicalize([2, 1]))
  })

  it('folds null and undefined together, and recurses through nesting', () => {
    expect(canonicalize(null)).toBe('null')
    expect(canonicalize(undefined)).toBe('null')
    expect(canonicalize({ a: { b: [1, 'x'] } })).toBe('{"a":{"b":[1,"x"]}}')
  })
})

describe('firstJsonDiff', () => {
  it('returns null for values that differ only in key order', () => {
    expect(firstJsonDiff({ a: 1, b: 2 }, { b: 2, a: 1 })).toBeNull()
  })

  it('names the path of the first differing scalar', () => {
    expect(firstJsonDiff({ a: { b: 1 } }, { a: { b: 2 } })).toEqual({
      path: '$.a.b',
      baseline: '1',
      candidate: '2',
    })
  })

  it('reports an array length change as a length diff, not element noise', () => {
    expect(firstJsonDiff([1, 2], [1, 2, 3])).toEqual({
      path: '$.length',
      baseline: '2',
      candidate: '3',
    })
  })

  it('indexes into the array element that changed', () => {
    expect(firstJsonDiff([1, 2, 3], [1, 9, 3])?.path).toBe('$[1]')
  })

  it('marks an added or removed key as <absent> on the right side', () => {
    expect(firstJsonDiff({}, { a: 1 })).toEqual({
      path: '$.a',
      baseline: '<absent>',
      candidate: '1',
    })
    expect(firstJsonDiff({ a: 1 }, {})).toEqual({
      path: '$.a',
      baseline: '1',
      candidate: '<absent>',
    })
  })
})

describe('textExcerpt', () => {
  it('points at the first differing character and windows around it', () => {
    const excerpt = textExcerpt('the quick brown fox', 'the quick brown cat')
    expect(excerpt.at).toBe(16)
    expect(excerpt.baseline).toContain('fox')
    expect(excerpt.candidate).toContain('cat')
  })

  it('reports the common length when one side is a prefix of the other', () => {
    expect(textExcerpt('abc', 'abcdef').at).toBe(3)
  })
})

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

describe('parseArgs', () => {
  it('defaults the baseline to SRD_PARITY_BASELINE, else the in-app fallback', () => {
    // The default used to be an absolute path inside the agent job directory
    // that first produced the baseline, so the gate exited 2 for everyone else.
    // It is now env-driven with a repo-relative fallback; pin both branches.
    const previous = process.env.SRD_PARITY_BASELINE
    try {
      process.env.SRD_PARITY_BASELINE = '/tmp/some-baseline'
      // parseArgs reads the module-level default, resolved at import time, so
      // assert on the shape rather than re-importing: what matters is that the
      // fallback is inside this app and is not somebody's scratch directory.
      const opts = parseArgs([])
      expect(opts.baseline).not.toContain('/.claude/jobs/')
      expect(opts.candidate.endsWith('/apps/srd/dist/')).toBe(true)
      expect(opts).toMatchObject({ limit: 20, ignoreIslandText: true, strictAssets: false })
    } finally {
      if (previous === undefined) delete process.env.SRD_PARITY_BASELINE
      else process.env.SRD_PARITY_BASELINE = previous
    }
  })

  it('accepts `--flag value` and `--flag=value` alike', () => {
    expect(parseArgs(['--baseline', '/b', '--candidate', '/c'])).toMatchObject({
      baseline: '/b',
      candidate: '/c',
    })
    expect(parseArgs(['--baseline=/b', '--candidate=/c'])).toMatchObject({
      baseline: '/b',
      candidate: '/c',
    })
  })

  it('parses --limit and falls back to 20 on a non-number', () => {
    expect(parseArgs(['--limit', '3']).limit).toBe(3)
    expect(parseArgs(['--limit', 'lots']).limit).toBe(20)
  })

  it('toggles the two comparison options', () => {
    expect(parseArgs(['--no-ignore-island-text']).ignoreIslandText).toBe(false)
    expect(parseArgs(['--no-ignore-island-text', '--ignore-island-text']).ignoreIslandText).toBe(
      true
    )
    expect(parseArgs(['--strict-assets']).strictAssets).toBe(true)
  })

  it('exits 2 on an unknown flag rather than ignoring it', () => {
    // A silently-ignored `--strict-asset` would run the gate in its permissive
    // mode while the operator believed it was strict.
    const { code, stderr } = withExitCaptured(() => parseArgs(['--strict-asset']))
    expect(code).toBe(2)
    expect(stderr).toContain('unknown flag --strict-asset')
  })

  it('prints usage and exits 0 for --help', () => {
    const { code, stdout } = withExitCaptured(() => parseArgs(['--help']))
    expect(code).toBe(0)
    for (const flag of [
      '--baseline',
      '--candidate',
      '--limit',
      '--no-ignore-island-text',
      '--strict-assets',
    ])
      expect(stdout).toContain(flag)
  })
})

/** Sentinel thrown in place of `process.exit`, so the test process survives. */
class Exited extends Error {
  constructor(readonly code: number) {
    super(`process.exit(${code})`)
  }
}

function withExitCaptured(body: () => unknown): { code: number; stdout: string; stderr: string } {
  const out: string[] = []
  const err: string[] = []
  const sink =
    (into: string[]) =>
    (chunk: unknown): boolean => {
      into.push(String(chunk))
      return true
    }
  const outSpy = spyOn(process.stdout, 'write').mockImplementation(
    sink(out) as typeof process.stdout.write
  )
  const errSpy = spyOn(process.stderr, 'write').mockImplementation(
    sink(err) as typeof process.stderr.write
  )
  const exitSpy = spyOn(process, 'exit').mockImplementation(((code?: number) => {
    throw new Exited(code ?? 0)
  }) as typeof process.exit)
  try {
    body()
    throw new Error('expected parseArgs to exit')
  } catch (error) {
    if (!(error instanceof Exited)) throw error
    return { code: error.code, stdout: out.join(''), stderr: err.join('') }
  } finally {
    outSpy.mockRestore()
    errSpy.mockRestore()
    exitSpy.mockRestore()
  }
}

// ---------------------------------------------------------------------------
// The gate, end to end
// ---------------------------------------------------------------------------

describe('run — the gate passes only on real agreement', () => {
  it('passes on semantically identical trees that differ in markup and bundles', async () => {
    const baseline: Tree = {
      'index.html': page({ main: '<h1>Aegis</h1>' }),
      'schema/chassis.json': '{"items":[{"id":"aegis","hp":10}]}',
      'llms.txt': '# Salvage Union\n',
      '_astro/index.Bx1.js': 'console.log(1)',
    }
    const candidate: Tree = {
      // Different wrapper markup, different attribute order, entity-encoded
      // text, extra whitespace — all of which the gate must see through.
      'index.html': page({ main: '<section><h1>Aegis</h1>\n  </section>' }),
      'schema/chassis.json': '{"items":[{"hp":10,"id":"aegis"}]}',
      'llms.txt': '# Salvage Union\n',
      'assets/index-DEADBEEF.js': 'console.log(1)',
    }

    const { code, stdout } = await runGate(baseline, candidate)

    expect(code).toBe(0)
    expect(stdout).toContain('PARITY OK')
    expect(stdout).toContain('zero differences')
    // The bundle difference is reported, deliberately, as non-fatal.
    expect(statusOf(stdout, 'file set — hashed bundle output')).toBe('WARN')
  })

  it('returns 2 when either directory is missing, without comparing anything', async () => {
    const out: string[] = []
    const err: string[] = []
    const sink =
      (into: string[]) =>
      (chunk: unknown): boolean => {
        into.push(String(chunk))
        return true
      }
    const outSpy = spyOn(process.stdout, 'write').mockImplementation(
      sink(out) as typeof process.stdout.write
    )
    const errSpy = spyOn(process.stderr, 'write').mockImplementation(
      sink(err) as typeof process.stderr.write
    )
    try {
      const code = await run({
        baseline: join(tmpdir(), 'srd-parity-does-not-exist'),
        candidate: join(tmpdir(), 'srd-parity-does-not-exist-either'),
        limit: 20,
        ignoreIslandText: true,
        strictAssets: false,
      })
      expect(code).toBe(2)
      expect(err.join('')).toContain('baseline directory does not exist')
      expect(out.join('')).toBe('')
    } finally {
      outSpy.mockRestore()
      errSpy.mockRestore()
    }
  })
})

describe('run — each fatal category bites', () => {
  it('catches a changed <title> / description / canonical', async () => {
    const { code, stdout } = await runGate(
      { 'index.html': page() },
      { 'index.html': page({ title: 'Aegis Mk II' }) }
    )

    expect(code).toBe(1)
    expect(statusOf(stdout, 'head metadata')).toBe('FAIL')
    expect(stdout).toContain('<title>: baseline="Aegis" candidate="Aegis Mk II"')
    expect(stdout).toContain('PARITY FAILED')
  })

  it('catches a dropped og: tag', async () => {
    const withOg = page()
    const { code, stdout } = await runGate(
      { 'index.html': withOg },
      { 'index.html': withOg.replace('<meta property="og:title" content="Aegis">', '') }
    )

    expect(code).toBe(1)
    expect(stdout).toContain('meta[og:title]')
    expect(stdout).toContain('<absent>')
  })

  it('catches a changed JSON-LD block, naming the path that moved', async () => {
    const ld = (name: string): string =>
      page().replace(
        '</head>',
        `<script type="application/ld+json">{"@type":"Product","name":"${name}"}</script></head>`
      )

    const { code, stdout } = await runGate(
      { 'index.html': ld('Aegis') },
      { 'index.html': ld('Argos') }
    )

    expect(code).toBe(1)
    expect(statusOf(stdout, 'JSON-LD blocks')).toBe('FAIL')
    expect(stdout).toContain('$.name')
  })

  it('catches a dropped JSON-LD block', async () => {
    const ld = page().replace(
      '</head>',
      '<script type="application/ld+json">{"@type":"Product"}</script></head>'
    )
    const { code, stdout } = await runGate({ 'index.html': ld }, { 'index.html': page() })

    expect(code).toBe(1)
    expect(stdout).toContain('ld+json block count: baseline=1 candidate=0')
  })

  it('catches a content regression inside <main>', async () => {
    const { code, stdout } = await runGate(
      { 'index.html': page({ main: '<p>Structure Points: 20</p>' }) },
      { 'index.html': page({ main: '<p>Structure Points: 2</p>' }) }
    )

    expect(code).toBe(1)
    expect(statusOf(stdout, '<main> visible text')).toBe('FAIL')
    expect(stdout).toContain('first difference at char')
  })

  it('catches <main> disappearing from one side', async () => {
    const { code, stdout } = await runGate(
      { 'index.html': page() },
      { 'index.html': '<html><head><title>Aegis</title></head><body><p>x</p></body></html>' }
    )

    expect(code).toBe(1)
    expect(stdout).toContain('<main> present in baseline only')
  })

  it('catches a JSON endpoint whose data changed', async () => {
    const { code, stdout } = await runGate(
      { 'schema/chassis.json': '{"items":[{"id":"aegis","sp":20}]}' },
      { 'schema/chassis.json': '{"items":[{"id":"aegis","sp":18}]}' }
    )

    expect(code).toBe(1)
    expect(statusOf(stdout, 'JSON endpoints')).toBe('FAIL')
    expect(stdout).toContain('$.items[0].sp')
  })

  it('catches an endpoint that stopped being valid JSON', async () => {
    const { code, stdout } = await runGate(
      { 'schema/chassis.json': '{"ok":true}' },
      { 'schema/chassis.json': '<!doctype html>' }
    )

    expect(code).toBe(1)
    expect(stdout).toContain('candidate is not valid JSON')
  })

  it('catches llms.txt differing by a single byte', async () => {
    const { code, stdout } = await runGate({ 'llms.txt': 'a\n' }, { 'llms.txt': 'a\n\n' })

    expect(code).toBe(1)
    expect(statusOf(stdout, 'llms.txt (byte-identical)')).toBe('FAIL')
    expect(stdout).toContain('not byte-identical')
  })

  it('catches llms.txt vanishing', async () => {
    const { code, stdout } = await runGate({ 'llms.txt': 'a\n' }, {})

    expect(code).toBe(1)
    expect(stdout).toContain('present in baseline only')
  })

  it('catches a page that stopped being emitted, and one that appeared', async () => {
    const { code, stdout } = await runGate(
      { 'index.html': page(), 'about/index.html': page() },
      { 'index.html': page(), 'api/index.html': page() }
    )

    expect(code).toBe(1)
    expect(statusOf(stdout, 'file set — missing from candidate')).toBe('FAIL')
    expect(statusOf(stdout, 'file set — extra in candidate')).toBe('FAIL')
    expect(stdout).toContain('about/index.html')
    expect(stdout).toContain('api/index.html')
  })
})

describe('run — the deliberate tolerances', () => {
  it('ignores ssr:false island text by default, and sees it with --no-ignore-island-text', async () => {
    // Astro server-rendered the search box; the new SSG emits an empty
    // placeholder and mounts client-side. That is the migration working, not a
    // regression — but the exclusion is symmetric, so it must be switchable.
    const baseline: Tree = {
      'index.html': page({
        main: '<h1>Aegis</h1><astro-island component-export="SearchIsland"><label>Search the SRD</label></astro-island>',
      }),
    }
    const candidate: Tree = {
      'index.html': page({
        main: '<h1>Aegis</h1><div data-island="SearchIsland" data-client="idle" data-island-id="i0"></div>',
      }),
    }

    const tolerant = await runGate(baseline, candidate)
    expect(tolerant.code).toBe(0)
    expect(tolerant.stdout).toContain('island subtrees excluded across both sides')

    const strict = await runGate(baseline, candidate, { ignoreIslandText: false })
    expect(strict.code).toBe(1)
    expect(statusOf(strict.stdout, '<main> visible text')).toBe('FAIL')
    expect(strict.stdout).toContain('--no-ignore-island-text')
  })

  it('escalates a bundle-path difference to fatal under --strict-assets', async () => {
    const trees: [Tree, Tree] = [
      { 'index.html': page(), '_astro/a.Bx1.js': 'x' },
      { 'index.html': page(), 'assets/a-DEADBEEF.js': 'x' },
    ]

    const lenient = await runGate(trees[0], trees[1])
    expect(lenient.code).toBe(0)
    expect(lenient.stdout).toContain('re-run with --strict-assets to enforce')

    const strict = await runGate(trees[0], trees[1], { strictAssets: true })
    expect(strict.code).toBe(1)
    expect(statusOf(strict.stdout, 'file set — hashed bundle output')).toBe('FAIL')
  })

  it('counts a page with no <main> on either side as agreement', async () => {
    const bare = '<html><head><title>og</title></head><body><p>x</p></body></html>'
    const { code, stdout } = await runGate(
      { 'og-card/index.html': bare },
      { 'og-card/index.html': bare }
    )

    expect(code).toBe(0)
    expect(stdout).toContain('pages with no <main>   : 1')
  })
})

describe('run — the report', () => {
  it('ranks the worst offenders and truncates the list at --limit', async () => {
    const baseline: Tree = {}
    const candidate: Tree = {}
    for (const slug of ['a', 'b', 'c']) {
      baseline[`${slug}/index.html`] = page({ title: slug, main: `<p>${slug}</p>` })
      // `a` differs in head AND body; `b` in body only; `c` not at all.
      candidate[`${slug}/index.html`] = page({
        title: slug === 'a' ? 'CHANGED' : slug,
        main: slug === 'c' ? '<p>c</p>' : `<p>${slug} changed</p>`,
      })
    }

    const { code, stdout } = await runGate(baseline, candidate, { limit: 1 })

    expect(code).toBe(1)
    expect(stdout).toContain('Worst offenders (2 pages with at least one difference)')
    // limit=1 shows one example per category and one worst-offender row.
    expect(stdout).toContain('… and 1 more')
    // `a` scores 3: <title>, og:title, and the <main> text.
    expect(stdout).toContain('3  a/index.html')
  })

  it('states its scope so a run against an empty tree cannot look like a pass', async () => {
    const { stdout } = await runGate({ 'index.html': page() }, { 'index.html': page() })

    expect(stdout).toContain('HTML pages compared    : 1')
    expect(stdout).toContain('JSON endpoints compared: 0')
    expect(stdout).toContain('files in baseline      : 1')
  })
})

// ---------------------------------------------------------------------------
// Append-only pages (/changelog)
// ---------------------------------------------------------------------------

describe('isInsertionOf', () => {
  it('accepts one contiguous block inserted at the head — the changelog shape', () => {
    // release-please PREPENDS, so the baseline's entries move down intact.
    expect(isInsertionOf('Releases v1 old', 'Releases v2 new v1 old')).toBe(true)
  })

  it('accepts identical text and a pure append at the end', () => {
    expect(isInsertionOf('same', 'same')).toBe(true)
    expect(isInsertionOf('head', 'head tail')).toBe(true)
  })

  it('rejects deletion, reordering and rewording of baseline content', () => {
    // An old entry removed.
    expect(isInsertionOf('a b c', 'a c')).toBe(false)
    // Entries reordered.
    expect(isInsertionOf('a b c', 'a c b')).toBe(false)
    // An old entry reworded.
    expect(isInsertionOf('v1 fixed the parser', 'v1 fixed the lexer')).toBe(false)
    // Candidate shorter than baseline can never be an insertion.
    expect(isInsertionOf('a b c', 'a b')).toBe(false)
  })
})

describe('append-only pages', () => {
  const changelog = (main: string): string => page({ title: 'Changelog', main })

  it('passes when /changelog has grown, and says so in the scope block', async () => {
    const { code, stdout } = await runGate(
      { 'changelog/index.html': changelog('<p>v1 old entry</p>') },
      { 'changelog/index.html': changelog('<p>v2 new entry</p><p>v1 old entry</p>') }
    )

    expect(code).toBe(0)
    expect(statusOf(stdout, '<main> visible text')).toBe('PASS')
    // Growth must be REPORTED, not silently swallowed — an exemption nobody can
    // see is indistinguishable from the gate not running.
    expect(stdout).toContain('append-only growth on  : 1 page(s)')
  })

  it('still FAILS /changelog when a historical entry is altered', async () => {
    const { code, stdout } = await runGate(
      { 'changelog/index.html': changelog('<p>v1 fixed the parser</p>') },
      { 'changelog/index.html': changelog('<p>v2 new</p><p>v1 fixed the lexer</p>') }
    )

    expect(code).toBe(1)
    expect(statusOf(stdout, '<main> visible text')).toBe('FAIL')
    expect(stdout).toContain('this page is append-only')
  })

  it('does not extend the exemption to any other page', async () => {
    const { code, stdout } = await runGate(
      { 'about/index.html': page({ main: '<p>old</p>' }) },
      { 'about/index.html': page({ main: '<p>new</p><p>old</p>' }) }
    )

    expect(code).toBe(1)
    expect(statusOf(stdout, '<main> visible text')).toBe('FAIL')
    expect(stdout).not.toContain('append-only')
  })
})
