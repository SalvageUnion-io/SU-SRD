/**
 * Rendered `og:image` for a shared snapshot — the resvg half.
 *
 * ## Why this exists
 *
 * A shared sheet link pasted into Discord unfurled as the bare string "In The
 * Union Now" — the same for every sheet, with no image. The previous layer gave
 * each snapshot its own title and description at the edge; this gives it the
 * picture, which is the half people actually see in a channel.
 *
 * The card's layout lives in `ogCard.ts`, which imports nothing binary and is
 * therefore testable. This module is the part only wrangler can load: the wasm,
 * the fonts, and the call that turns one into the other.
 *
 * ## Fonts are TTF, and that is not a preference
 *
 * resvg resolves fonts through `fontdb` / `ttf-parser`, which read TTF and OTF
 * and **not WOFF** — WOFF being a zlib-compressed container around the same
 * tables. The failure mode is silent and expensive to diagnose: resvg loads
 * nothing, finds no family, and renders every glyph as nothing, producing a
 * valid PNG of the right size containing only the background, with a 200.
 * Measured during this work — a card with text came back byte-identical to a
 * card with none.
 *
 * `@fontsource` ships only `.woff` and `.woff2`, so `tools/woff-to-ttf.ts`
 * unwraps the installed `.woff` into the TTFs imported below. Same font, same
 * licence (OFL-1.1), same dependency — a different container.
 */

import { initWasm, Resvg } from '@resvg/resvg-wasm'
// `Data` / wasm rules in wrangler.jsonc turn these into binary at build time.
//
// They are cast at the use site rather than typed by a `declare module`,
// because this app also pulls in `vite/client`, which declares font and asset
// imports as `string` for the browser build — and that declaration wins in this
// graph. The cast is where the two build systems actually disagree, so it is
// where the disagreement is written down.
import barlow400 from './fonts/barlow-400.ttf'
import barlowCond700 from './fonts/barlow-cond-700.ttf'
import { cardSvg, WIDTH } from './ogCard'
import resvgWasm from '@resvg/resvg-wasm/index_bg.wasm'

const asBuffer = (imported: unknown): Uint8Array => new Uint8Array(imported as ArrayBuffer)
const asWasm = (imported: unknown): WebAssembly.Module => imported as WebAssembly.Module

/**
 * `initWasm` is one-shot per isolate and throws if called twice, so the PROMISE
 * is memoised rather than a boolean — two concurrent requests on a cold isolate
 * would both see `false` and both initialise.
 */
let wasmReady: Promise<void> | null = null
function ensureWasm(): Promise<void> {
  if (!wasmReady) {
    wasmReady = initWasm(asWasm(resvgWasm)).catch((error: unknown) => {
      // Let the next request retry rather than poisoning the isolate forever.
      wasmReady = null
      throw error
    })
  }
  return wasmReady
}

/**
 * Render one snapshot's preview as PNG bytes.
 *
 * Throws on failure — the caller decides what a failure means, and for an
 * unfurl the answer is always the static fallback rather than an error page.
 */
export async function renderOgImage(
  name: string,
  kind: string,
  detail: string | null
): Promise<Uint8Array> {
  await ensureWasm()

  const resvg = new Resvg(cardSvg(name, kind, detail), {
    fitTo: { mode: 'width', value: WIDTH },
    font: {
      fontBuffers: [asBuffer(barlow400), asBuffer(barlowCond700)],
      // Without an explicit default, resvg looks for a system font that does
      // not exist in workerd and every glyph renders as nothing — a blank card
      // that still returns 200, which is the worst kind of failure here.
      defaultFontFamily: 'Barlow',
      loadSystemFonts: false,
    },
  })

  return resvg.render().asPng()
}
