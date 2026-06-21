/**
 * Build-time Open Graph card renderer.
 *
 * Renders a branded 1200×630 PNG that *represents* an entity's reference card —
 * name, schema, tech level, key stats, traits, source — using the site's Barlow
 * type and Salvage Union palette. Used as the og:image for every entity page so
 * social/link previews show the entity rather than a generic banner.
 *
 * Pipeline: Satori (element tree → SVG with embedded text) → resvg (SVG → PNG).
 * Fonts are read once from the local @fontsource WOFF files (Satori supports
 * TTF/OTF/WOFF — not WOFF2) and cached for the whole build.
 */
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import satori from 'satori'
import { Resvg } from '@resvg/resvg-js'

const OG_WIDTH = 1200
const OG_HEIGHT = 630

// --- Palette (mirrors packages/suref-react/src/styles/theme.css) -------------
const SU_BLACK = 'rgb(40,32,25)'
const SU_WHITE = 'rgb(255,255,255)'
const SU_ORANGE = 'rgb(239,137,79)'
const SU_BLUE = 'rgb(143,195,216)'
const SU_BLUE_LIGHT = 'rgb(199,223,231)'
const SU_GREY = 'rgb(150,150,150)'

// Tech-level badge colors (mirror --color-tl-* + the B/N aliases) ------------
const TL_COLORS: Record<string, { bg: string; fg: string }> = {
  '1': { bg: 'rgb(115,201,230)', fg: SU_BLACK },
  '2': { bg: 'rgb(87,169,200)', fg: SU_BLACK },
  '3': { bg: 'rgb(68,135,162)', fg: SU_WHITE },
  '4': { bg: 'rgb(48,107,128)', fg: SU_WHITE },
  '5': { bg: 'rgb(30,83,100)', fg: SU_WHITE },
  '6': { bg: 'rgb(6,52,65)', fg: SU_WHITE },
  B: { bg: 'rgb(215,195,125)', fg: SU_BLACK },
  N: { bg: 'rgb(192,192,192)', fg: SU_BLACK },
}

function techLevelLabel(tl: number | 'B' | 'N'): string {
  if (tl === 'B') return 'BIO'
  if (tl === 'N') return 'NANITE'
  return `TL${tl}`
}

// --- Fonts (loaded once per build) ------------------------------------------
const require = createRequire(import.meta.url)
const font = (pkg: string, file: string) => readFileSync(require.resolve(`${pkg}/files/${file}`))

let fontCache: { name: string; data: Buffer; weight: 400 | 600 | 700; style: 'normal' }[] | null =
  null

function fonts() {
  if (fontCache) return fontCache
  const B = '@fontsource/barlow'
  const C = '@fontsource/barlow-semi-condensed'
  fontCache = [
    { name: 'Barlow', data: font(B, 'barlow-latin-400-normal.woff'), weight: 400, style: 'normal' },
    { name: 'Barlow', data: font(B, 'barlow-latin-600-normal.woff'), weight: 600, style: 'normal' },
    { name: 'Barlow', data: font(B, 'barlow-latin-700-normal.woff'), weight: 700, style: 'normal' },
    {
      name: 'Barlow Semi Condensed',
      data: font(C, 'barlow-semi-condensed-latin-600-normal.woff'),
      weight: 600,
      style: 'normal',
    },
    {
      name: 'Barlow Semi Condensed',
      data: font(C, 'barlow-semi-condensed-latin-700-normal.woff'),
      weight: 700,
      style: 'normal',
    },
  ]
  return fontCache
}

// --- Card data ---------------------------------------------------------------
type OgCardData = {
  name: string
  schemaName: string
  techLevel?: number | 'B' | 'N'
  description?: string
  stats: { label: string; value: string | number }[]
  traits: string[]
  source?: string
  page?: number
}

const truncate = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s)

// Minimal hyperscript so we can build the Satori tree without JSX/pragma config.
type El = { type: string; props: Record<string, unknown> }
const h = (type: string, style: Record<string, unknown>, children?: unknown): El => ({
  type,
  props: { style, children },
})

function statChip(label: string, value: string | number): El {
  return h('div', { display: 'flex', flexDirection: 'column' }, [
    h(
      'div',
      {
        fontFamily: 'Barlow Semi Condensed',
        fontWeight: 700,
        fontSize: 44,
        color: SU_ORANGE,
        lineHeight: 1,
      },
      String(value)
    ),
    h(
      'div',
      {
        fontFamily: 'Barlow',
        fontWeight: 600,
        fontSize: 19,
        color: SU_GREY,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginTop: 6,
      },
      label
    ),
  ])
}

function buildCard(data: OgCardData): El {
  const headerRow = h(
    'div',
    {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    [
      h(
        'div',
        {
          fontFamily: 'Barlow Semi Condensed',
          fontWeight: 600,
          fontSize: 30,
          color: SU_ORANGE,
          textTransform: 'uppercase',
          letterSpacing: 3,
        },
        truncate(data.schemaName, 40)
      ),
      data.techLevel != null
        ? (() => {
            const c = TL_COLORS[String(data.techLevel)] ?? { bg: SU_ORANGE, fg: SU_BLACK }
            return h(
              'div',
              {
                display: 'flex',
                backgroundColor: c.bg,
                color: c.fg,
                fontFamily: 'Barlow Semi Condensed',
                fontWeight: 700,
                fontSize: 28,
                padding: '8px 20px',
                borderRadius: 12,
              },
              techLevelLabel(data.techLevel)
            )
          })()
        : h('div', { display: 'flex' }, ''),
    ]
  )

  const nameEl = h(
    'div',
    {
      fontFamily: 'Barlow Semi Condensed',
      fontWeight: 700,
      fontSize: data.name.length > 26 ? 72 : 92,
      color: SU_WHITE,
      lineHeight: 1.02,
      marginTop: 18,
    },
    truncate(data.name, 52)
  )

  const topGroup: unknown[] = [headerRow, nameEl]
  if (data.description) {
    topGroup.push(
      h(
        'div',
        {
          fontFamily: 'Barlow',
          fontWeight: 400,
          fontSize: 30,
          color: SU_BLUE_LIGHT,
          lineHeight: 1.3,
          marginTop: 18,
        },
        truncate(data.description, 150)
      )
    )
  }

  // Up to 4 stats; tech level already lives in the header badge.
  const chips = data.stats
    .filter((s) => s.label !== 'Tech Level')
    .slice(0, 4)
    .map((s) => statChip(s.label, s.value))

  const bottomGroup: unknown[] = []
  if (chips.length) {
    bottomGroup.push(
      h('div', { display: 'flex', flexDirection: 'row', gap: 48, alignItems: 'flex-end' }, chips)
    )
  }
  if (data.traits.length) {
    bottomGroup.push(
      h(
        'div',
        {
          fontFamily: 'Barlow',
          fontWeight: 600,
          fontSize: 24,
          color: SU_BLUE,
          marginTop: 22,
        },
        truncate(`Traits: ${data.traits.join(' · ')}`, 78)
      )
    )
  }

  const sourceText = data.source
    ? data.page != null
      ? `${data.source} · p.${data.page}`
      : data.source
    : ''
  const footer = h(
    'div',
    {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 26,
      paddingTop: 22,
      borderTop: `2px solid rgba(239,137,79,0.4)`,
    },
    [
      h(
        'div',
        {
          display: 'flex',
          flexDirection: 'row',
          gap: 12,
          fontFamily: 'Barlow Semi Condensed',
          fontWeight: 700,
          fontSize: 28,
          letterSpacing: 1,
        },
        [h('span', { color: SU_WHITE }, 'SALVAGE UNION'), h('span', { color: SU_ORANGE }, 'SRD')]
      ),
      h(
        'div',
        { display: 'flex', fontFamily: 'Barlow', fontWeight: 400, fontSize: 24, color: SU_GREY },
        sourceText
      ),
    ]
  )
  bottomGroup.push(footer)

  return h(
    'div',
    {
      width: OG_WIDTH,
      height: OG_HEIGHT,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      backgroundColor: SU_BLACK,
      padding: 64,
      position: 'relative',
    },
    [
      // Top accent stripe
      h('div', {
        position: 'absolute',
        top: 0,
        left: 0,
        width: OG_WIDTH,
        height: 14,
        backgroundColor: SU_ORANGE,
      }),
      h('div', { display: 'flex', flexDirection: 'column' }, topGroup),
      h('div', { display: 'flex', flexDirection: 'column' }, bottomGroup),
    ]
  )
}

/** Render an entity OG card to a PNG byte buffer. */
export async function renderOgCard(data: OgCardData): Promise<Uint8Array<ArrayBuffer>> {
  const svg = await satori(buildCard(data) as never, {
    width: OG_WIDTH,
    height: OG_HEIGHT,
    fonts: fonts(),
  })
  const png = new Resvg(svg).render().asPng()
  // Copy into a fresh ArrayBuffer-backed view so the type is Uint8Array<ArrayBuffer>
  // (resvg returns Uint8Array<ArrayBufferLike>, which BlobPart/BodyInit rejects).
  const out = new Uint8Array(png.byteLength)
  out.set(png)
  return out
}
