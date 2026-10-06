/**
 * The og:image card, as an SVG document.
 *
 * ## Why this is its own module
 *
 * `ogImage.ts` imports two TTFs and a 2.4 MB `.wasm`, resolved by wrangler's
 * module rules at build time. Nothing outside wrangler can load it — `bun test`
 * has no such rules and dies on the first binary import. Keeping the layout
 * here, where the only inputs are strings, is what makes the card assertable at
 * all: the escaping, the line breaking and the truncation are the parts with
 * decisions in them, and they are pure.
 *
 * ## Why hand-authored SVG rather than satori
 *
 * The obvious build is satori (JSX → SVG) + resvg (SVG → PNG), and it was tried
 * first. **Satori cannot run in workerd.** It shapes text with `harfbuzzjs`,
 * whose emscripten wrapper fetches its OWN wasm by URL during module init and
 * dies on `Cannot read properties of undefined (reading 'href')` — there is no
 * `document.currentScript` and no module-relative URL to read. That is a
 * property of how harfbuzz ships, not a configuration mistake, and no
 * compatibility flag fixes it.
 *
 * resvg has no such problem: `initWasm` takes the module explicitly, which is
 * exactly what a Worker can provide. And since this card is a fixed layout we
 * control, satori's job — turning a flexbox tree into SVG — is work we do not
 * need done. Writing the SVG directly removes satori, harfbuzz and ~1 MB of
 * bundle, and leaves one dependency whose loading model fits the runtime.
 *
 * The cost is real and worth naming: SVG 1.1 `<text>` does not wrap. Line
 * breaking is done here by measurement-free heuristics tuned to this one card
 * (see `fitName`), rather than by a layout engine. That is affordable only
 * because the card has exactly one variable-length string in it.
 */

import { color } from 'component-lib/design/tokens'

/** The canonical unfurl size. Discord, Slack and Twitter all crop to ~1.91:1. */
export const WIDTH = 1200
export const HEIGHT = 630
const PAD = 72

/**
 * The book palette, read from the token scale rather than copied out of it.
 *
 * This is what `tokens.ts` was built for — its own header names "a canvas, a
 * PDF generator, or a Node script that has no DOM at all" as consumers, and a
 * Worker rasterising SVG through resvg is exactly that: there is no stylesheet
 * here, so `var(--su-*)` cannot resolve and the colour has to arrive as a
 * value. Four hex literals would have been the easy version, and they would
 * have been four copies that no longer move when the palette does.
 *
 * The tokens used here are comma-separated rgb triples, which is SVG 1.1's own
 * colour syntax. Do NOT reach for one of the scale's translucent tokens: those
 * are written in the CSS Color 4 space-separated-with-alpha form, resvg does not
 * parse it, and an unparsed fill renders silently black. Where this card needs a
 * held-back colour it uses `fill-opacity` instead, which SVG does understand.
 */
const INK = color.inkDeep
const PAPER = color.paper
const RUST = color.rust

/**
 * The detail row is paper held back, not a colour of its own.
 *
 * Expressed as `fill-opacity` on `PAPER` rather than as a fourth constant,
 * because the muted blue-grey this used to be was in the scale nowhere — it was
 * invented for this card and would have drifted alone.
 */
const MUTED_OPACITY = '0.62'

/**
 * XML-escape. The sheet name is user-controlled and goes straight into markup —
 * without this a name containing `<` produces an unparseable document and the
 * render throws, which is a strange way to find out.
 */
function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Break the name into at most two lines and pick a size that fits.
 *
 * SVG `<text>` does not wrap, and with no shaping engine there are no glyph
 * metrics to measure with — so this estimates from character count. Barlow Semi
 * Condensed Bold averages near 0.46em of advance, which is what the divisor
 * encodes. It is an approximation, and the truncation is what keeps an
 * approximation safe: a long name is cut rather than allowed to run off the
 * canvas.
 */
export function fitName(name: string): { lines: string[]; size: number } {
  const usable = WIDTH - PAD * 2
  for (const size of [116, 96, 80, 68]) {
    const perLine = Math.floor(usable / (size * 0.46))
    if (name.length <= perLine) return { lines: [name], size }

    // Break on the last space that fits, so a word is not split mid-way.
    const head = name.slice(0, perLine)
    const cut = head.lastIndexOf(' ')
    const first = cut > perLine * 0.4 ? head.slice(0, cut) : head
    const rest = name.slice(first.length).trim()
    if (rest.length <= perLine) return { lines: [first, rest], size }
  }
  const size = 68
  const perLine = Math.floor(usable / (size * 0.46))
  return { lines: [name.slice(0, perLine), `${name.slice(perLine, perLine * 2 - 1)}…`], size }
}

/**
 * Trim a line to fit, breaking on a word.
 *
 * A hard `slice` cuts mid-word — the first render of this card ended "…sheet on
 * In The Union", losing the "Now." and reading like a truncated bug rather than
 * a deliberate summary.
 */
export function clip(text: string, max: number): string {
  if (text.length <= max) return text
  const head = text.slice(0, max)
  const cut = head.lastIndexOf(' ')
  return `${(cut > max * 0.6 ? head.slice(0, cut) : head).replace(/[.,;:]$/, '')}…`
}

/** The card, as an SVG document. */
export function cardSvg(name: string, kind: string, detail: string | null): string {
  const { lines, size } = fitName(name)
  const nameTop = 260
  const nameSpans = lines
    .map(
      (line, i) =>
        `<text x="${PAD}" y="${Math.round(nameTop + i * size * 1.05)}" font-family="Barlow Semi Condensed" font-weight="700" font-size="${size}" fill="${PAPER}">${esc(line)}</text>`
    )
    .join('\n')

  const detailY = Math.round(nameTop + lines.length * size * 1.05 + 20)
  const detailText = detail
    ? `<text x="${PAD}" y="${detailY}" font-family="Barlow" font-size="32" fill="${PAPER}" fill-opacity="${MUTED_OPACITY}">${esc(clip(detail, 66))}</text>`
    : ''

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
<rect width="${WIDTH}" height="${HEIGHT}" fill="${INK}"/>
<text x="${PAD}" y="120" font-family="Barlow Semi Condensed" font-weight="700" font-size="30" letter-spacing="4" fill="${RUST}">${esc(kind.toUpperCase())}</text>
<rect x="${PAD}" y="152" width="96" height="6" fill="${RUST}"/>
${nameSpans}
${detailText}
<text x="${PAD}" y="${HEIGHT - 54}" font-family="Barlow" font-size="28" fill="${PAPER}" fill-opacity="${MUTED_OPACITY}">intheunionnow.com</text>
<text x="${WIDTH - PAD}" y="${HEIGHT - 54}" text-anchor="end" font-family="Barlow Semi Condensed" font-weight="700" font-size="28" letter-spacing="3" fill="${PAPER}" fill-opacity="${MUTED_OPACITY}">SALVAGE UNION</text>
</svg>`
}
