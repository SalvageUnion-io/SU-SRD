import { describe, expect, it } from 'bun:test'
import { cardSvg, clip, fitName, HEIGHT, WIDTH } from '../ogCard'

/**
 * The og:image card's layout.
 *
 * **This is deliberately not a render test.** `renderOgImage` lives in
 * `ogImage.ts`, which imports two TTFs and a 2.4 MB `.wasm` through wrangler's
 * module rules — `bun test` has no such rules and cannot load that module at
 * all. What is asserted here is everything upstream of resvg: the escaping, the
 * line breaking, the truncation. The render itself was verified by eye against
 * `wrangler dev`, which is the only place it can run.
 *
 * The one failure this cannot catch is worth naming, because it is the failure
 * that actually happened: resvg reads TTF and OTF and **not WOFF**, and given a
 * WOFF it renders every glyph as nothing while still returning a valid PNG of
 * the correct size with a 200. A card with text came back byte-identical to a
 * card with none. No assertion on the SVG can see that — the SVG was correct
 * both times.
 */
describe('fitName', () => {
  it('keeps a short name on one line at the largest size', () => {
    const { lines, size } = fitName('Rusty Kilgore')
    expect(lines).toEqual(['Rusty Kilgore'])
    expect(size).toBe(116)
  })

  it('breaks a long name on a space rather than mid-word', () => {
    const { lines } = fitName('Bartholomew Kilgore the Third of Detroit')
    expect(lines.length).toBe(2)
    // Every emitted line is whole words: rejoining reproduces the input.
    expect(lines.join(' ')).toBe('Bartholomew Kilgore the Third of Detroit')
  })

  it('wraps at the largest size rather than shrinking to stay on one line', () => {
    // The policy, stated because it is a choice and not an accident: a name
    // that overflows gets a second line at the SAME size, and the size only
    // steps down when two lines will not hold it either. On a 1200x630 card
    // read at thumbnail size in a Discord channel, two lines of 116 beat one
    // line of 68.
    const { lines, size } = fitName('Cassiopeia Vantablackery')
    expect(lines).toEqual(['Cassiopeia', 'Vantablackery'])
    expect(size).toBe(116)
  })

  it('truncates a name too long for two lines at the smallest size', () => {
    const absurd = 'Q'.repeat(300)
    const { lines, size } = fitName(absurd)
    expect(size).toBe(68)
    expect(lines.length).toBe(2)
    expect(lines[1]?.endsWith('…')).toBe(true)
    // The point of truncating: nothing runs off a 1200px canvas.
    for (const line of lines) expect(line.length).toBeLessThan(50)
  })

  it('survives a name with no spaces to break on', () => {
    const { lines } = fitName('Q'.repeat(40))
    expect(lines.join('').replace(/…/g, '').length).toBeGreaterThan(0)
  })
})

describe('clip', () => {
  it('leaves a string that already fits alone', () => {
    expect(clip('short', 66)).toBe('short')
  })

  it('breaks on a word and marks the cut', () => {
    const long = 'A shared Salvage Union sheet on In The Union Now, which is a website'
    const out = clip(long, 40)
    expect(out.endsWith('…')).toBe(true)
    // No half-words: everything before the ellipsis is a prefix of the input at
    // a space boundary.
    const body = out.slice(0, -1)
    expect(long.startsWith(body)).toBe(true)
    expect(long[body.length]).toBe(' ')
  })

  it('drops a trailing comma rather than printing ",…"', () => {
    expect(clip('one two three, four five', 14)).toBe('one two three…')
  })

  it('falls back to a hard cut when there is no late space', () => {
    const out = clip(`x ${'y'.repeat(80)}`, 20)
    expect(out.endsWith('…')).toBe(true)
    expect(out.length).toBe(21)
  })
})

describe('cardSvg', () => {
  it('is a well-formed SVG at the unfurl size', () => {
    const svg = cardSvg('Rusty Kilgore', 'Pilot', 'A shared sheet.')
    expect(svg.startsWith('<svg ')).toBe(true)
    expect(svg.trimEnd().endsWith('</svg>')).toBe(true)
    expect(svg).toContain(`width="${WIDTH}" height="${HEIGHT}"`)
  })

  it('renders the kind as an uppercase eyebrow', () => {
    expect(cardSvg('Mule', 'pilot', null)).toContain('>PILOT<')
  })

  it('omits the detail row entirely when there is none', () => {
    const svg = cardSvg('Mule', 'Pilot', null)
    expect(svg).toContain('intheunionnow.com')
    // Barlow 32 is the detail row's size and nothing else's.
    expect(svg).not.toContain('font-size="32"')
  })

  it('escapes a hostile name instead of emitting markup', () => {
    // The sheet name is user-controlled and goes straight into a document. An
    // unescaped `<` here does not produce a clever card, it produces an
    // unparseable one, and resvg throws — which is a strange way to find out.
    const svg = cardSvg('</text><script>alert(1)</script>', 'Pilot', null)
    expect(svg).not.toContain('<script>')
    expect(svg).toContain('&lt;/text&gt;&lt;script&gt;')
  })

  it('escapes ampersands and quotes in both the name and the detail', () => {
    const svg = cardSvg('Bell & "Boo"', 'Pilot', 'Crew of Bell & Boo')
    expect(svg).toContain('Bell &amp; &quot;Boo&quot;')
    expect(svg).toContain('Bell &amp; Boo')
  })

  it('moves the detail row down when the name takes two lines', () => {
    const oneY = /font-size="32"[^>]*>/.exec(cardSvg('Mule', 'Pilot', 'detail'))
    const twoLine = cardSvg('Bartholomew Kilgore the Third of Detroit', 'Pilot', 'detail')
    expect(oneY).not.toBeNull()
    // Both cards have a detail row; the two-line one sits lower.
    const y = (svg: string) => Number(/y="(\d+)"[^>]*font-size="32"/.exec(svg)?.[1] ?? 0)
    expect(y(twoLine)).toBeGreaterThan(y(cardSvg('Mule', 'Pilot', 'detail')))
  })
})
