import { describe, expect, it } from 'bun:test'
import { applyMeta, metaForSnapshot, renderMeta } from '../shellMeta'

/**
 * The shell's per-route metadata.
 *
 * Every link to this client-rendered app unfurled as the bare string "In The
 * Union Now" — confirmed against production with a `Discordbot/2.0` user agent.
 * A crawler runs no JavaScript, so nothing a route sets at runtime can fix it;
 * the values have to be in the served bytes.
 */

const SHELL = `<!doctype html>
<html lang="en">
  <head>
    <title>In The Union Now</title>
    <!-- itun:meta:start -->
    <meta name="description" content="default" />
    <meta property="og:title" content="In The Union Now" />
    <!-- itun:meta:end -->
  </head>
  <body><div id="root"></div></body>
</html>`

const META = {
  title: 'Rusty — Pilot',
  description: 'Pilot: Rusty. A shared Salvage Union sheet.',
  url: 'https://intheunionnow.com/s/AAAAAAAA',
  image: 'https://intheunionnow.com/icon-512.png',
}

describe('applyMeta', () => {
  it('replaces the whole default block, leaving no duplicate og:title', () => {
    const out = applyMeta(SHELL, META)
    // The failure this guards: a default tag and a per-route tag both surviving,
    // with the parser free to pick either.
    expect(out.match(/property="og:title"/g)).toHaveLength(1)
    expect(out).toContain('content="Rusty — Pilot"')
    expect(out).not.toContain('content="default"')
  })

  it('rewrites the <title> too', () => {
    const out = applyMeta(SHELL, META)
    expect(out).toContain('<title>Rusty — Pilot</title>')
    expect(out.match(/<title>/g)).toHaveLength(1)
  })

  it('adds a per-route canonical', () => {
    expect(applyMeta(SHELL, META)).toContain(
      '<link rel="canonical" href="https://intheunionnow.com/s/AAAAAAAA" />'
    )
  })

  it('leaves a shell without markers untouched', () => {
    // Degrade to the sitewide defaults rather than to a broken document.
    const bare = '<!doctype html><html><head><title>x</title></head><body></body></html>'
    expect(applyMeta(bare, META)).toBe(bare)
  })

  it('escapes a name that would otherwise break out of the attribute', () => {
    // Sheet names are user-controlled and reach the served HTML.
    const out = applyMeta(SHELL, { ...META, title: 'Rusty" onload="alert(1)' })
    expect(out).not.toContain('onload="alert(1)"')
    expect(out).toContain('&quot;')
  })
})

describe('renderMeta', () => {
  it('caps a very long title rather than letting it bloat the head', () => {
    const out = renderMeta({ ...META, title: 'A'.repeat(200) })
    const title = out.match(/og:title" content="([^"]*)"/)?.[1] ?? ''
    expect(title.length).toBeLessThanOrEqual(70)
    expect(title.endsWith('…')).toBe(true)
  })
})

describe('metaForSnapshot', () => {
  const defaults = { image: 'https://intheunionnow.com/icon-512.png' }

  it('summarises a pilot snapshot', () => {
    const meta = metaForSnapshot(
      { kind: 'pilot', entity: { name: 'Rusty' } },
      'https://intheunionnow.com/s/AAAAAAAA',
      defaults
    )
    expect(meta?.title).toBe('Rusty — Pilot')
    expect(meta?.description).toContain('Pilot: Rusty')
  })

  it('names a crawler with the game’s own term', () => {
    const meta = metaForSnapshot({ kind: 'crawler', entity: { name: 'Haven' } }, 'u', defaults)
    expect(meta?.title).toBe('Haven — Union Crawler')
  })

  it('includes the chassis when a mech snapshot carries one', () => {
    const meta = metaForSnapshot(
      { kind: 'mech', entity: { name: 'Bruiser', chassis: 'Aegis' } },
      'u',
      defaults
    )
    expect(meta?.description).toContain('Chassis: Aegis')
  })

  for (const [label, payload] of [
    ['null', null],
    ['a non-object', 'nonsense'],
    ['no entity', { kind: 'pilot' }],
    ['an unnamed entity', { kind: 'pilot', entity: {} }],
    ['a blank name', { kind: 'pilot', entity: { name: '   ' } }],
  ] as const) {
    it(`falls back to the defaults for ${label}`, () => {
      // A snapshot that cannot be summarised must degrade, never throw: an
      // unfurl is not worth a 500 on a page that would otherwise render.
      expect(metaForSnapshot(payload, 'u', defaults)).toBeNull()
    })
  }

  it('still summarises a snapshot whose kind is unknown', () => {
    // Older snapshots and future kinds both land here; a generic label beats
    // dropping the metadata entirely.
    const meta = metaForSnapshot({ kind: 'zzz', entity: { name: 'Thing' } }, 'u', defaults)
    expect(meta?.title).toBe('Thing — Sheet')
  })
})

/**
 * The tags that decide how the rendered card is PRESENTED, as opposed to which
 * image is used. Getting these wrong wastes the render rather than breaking it,
 * which is why they are asserted rather than left to inspection: a 1200x630
 * card shown as a small square thumbnail looks like a design choice, not a bug.
 */
describe('unfurl presentation', () => {
  const meta = {
    title: 'Rusty — Pilot',
    description: 'A shared sheet.',
    url: 'https://intheunionnow.com/s/AAAAAAAA',
    image: 'https://intheunionnow.com/og/s/AAAAAAAA.png',
  }

  it('asks for the large card, not the thumbnail', () => {
    expect(renderMeta(meta)).toContain('name="twitter:card" content="summary_large_image"')
  })

  it('declares the card dimensions so a consumer need not fetch to lay it out', () => {
    const html = renderMeta(meta)
    expect(html).toContain('property="og:image:width" content="1200"')
    expect(html).toContain('property="og:image:height" content="630"')
  })

  it('differs from index.html on purpose — that default is a square icon', () => {
    // If someone ever "fixes the inconsistency" by making these match, one of
    // the two is then wrong: the shell default points at the 512x512 app icon,
    // which a large card would letterbox.
    expect(renderMeta(meta)).not.toContain('content="summary"')
  })
})
