/**
 * The profile banners: the "SALVAGE UNION.io" wordmark (beside the SU mark on
 * Ko-fi's cover) on the ink ground with paper flecks, the "YOU'RE IN THE UNION
 * NOW!" kicker in pilot orange, and the chapter colours along the foot: the
 * mark's own materials at banner width.
 *
 * `bannerHtml` is a page `build.ts` screenshots at the banner's exact size,
 * because the wordmark is set in Barlow Semi Condensed (inlined from
 * fontsource) and only a browser sets it as the site does.
 */
import { readFileSync } from 'node:fs'
import { color } from '../../src/ui/design/tokens'
import { markSvg } from './mark'

const FOOT = [color.wkLine, color.pilot, color.mech, color.crawler, color.denizenBand]

export type BannerLayout = {
  width: number
  height: number
  /**
   * `right`: the lockup sits right, clear of Discord's profile avatar, which
   * covers the bottom left; the kicker takes the top left. `center`: kicker
   * over the wordmark, the lockup centred, for Ko-fi's cover, which crops
   * its sides on a phone.
   */
  align: 'right' | 'center'
  /**
   * The mark's size in px, or 0 for none: Discord lays the avatar (the mark)
   * over its banner, so the banner carries only the wordmark.
   */
  mark: number
  /** The wordmark's font size, in px. */
  word: number
  kicker: number
}

export const BANNERS: Record<string, BannerLayout> = {
  'apps/discord-bot/brand/banner.png': {
    width: 680,
    height: 240,
    align: 'right',
    mark: 0,
    word: 76,
    kicker: 22,
  },
  'apps/discord-bot/brand/kofi-cover.png': {
    width: 1500,
    height: 500,
    align: 'center',
    mark: 250,
    word: 118,
    kicker: 34,
  },
}

function font(weight: 700 | 800): string {
  const file = Bun.resolveSync(
    `@fontsource/barlow-semi-condensed/files/barlow-semi-condensed-latin-${weight}-normal.woff2`,
    import.meta.dir
  )
  const data = readFileSync(file).toString('base64')
  return `@font-face{font-family:'Barlow Semi Condensed';font-weight:${weight};src:url(data:font/woff2;base64,${data}) format('woff2')}`
}

function flecks(width: number, height: number): string {
  let seed = 11
  const next = () => {
    seed = (seed * 9301 + 49297) % 233280
    return seed / 233280
  }
  const dots: string[] = []
  for (let i = 0; i < Math.round((width * height) / 900); i++) {
    const r = (0.5 + next() * 0.9).toFixed(2)
    dots.push(
      `<circle cx="${(next() * width).toFixed(1)}" cy="${(next() * height).toFixed(1)}" r="${r}"/>`
    )
  }
  return `<svg class="flecks" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><g fill="${color.paper}" opacity="0.14">${dots.join('')}</g></svg>`
}

export function bannerHtml(layout: BannerLayout): string {
  const { width, height, align, mark, word, kicker } = layout
  const foot = Math.round(height * 0.06)
  const kickerText = 'YOU’RE IN THE UNION NOW!'
  const icon = mark > 0 ? markSvg({ title: '', flecks: true, px: mark }) : ''
  const wordmark = `<div class="word">SALVAGE<br>UNION<span class="io">.io</span></div>`
  const lockup =
    align === 'right'
      ? `<div class="kicker top">${kickerText}</div><div class="lockup">${icon}${wordmark}</div>`
      : `<div class="lockup">${icon}<div><div class="kicker">${kickerText}</div>${wordmark}</div></div>`
  return `<!doctype html><html><head><meta charset="utf-8"><style>
${font(700)}${font(800)}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${width}px;height:${height}px;overflow:hidden;background:${color.inkDeep}}
body{position:relative;font-family:'Barlow Semi Condensed',sans-serif;color:${color.paper}}
.flecks{position:absolute;inset:0}
.stage{position:absolute;left:0;top:0;right:0;bottom:${foot}px;display:flex;align-items:center;
  justify-content:${align === 'right' ? 'flex-end' : 'center'};padding:0 ${Math.round(height * 0.12)}px}
.lockup{display:flex;align-items:center;gap:${Math.round(mark * 0.16)}px}
.lockup svg{flex:none;display:block}
.word{font-weight:800;font-size:${word}px;line-height:.9;letter-spacing:.01em}
.io{font-size:.46em;opacity:.6;font-weight:700;letter-spacing:0}
.kicker{font-weight:800;font-size:${kicker}px;line-height:1.05;letter-spacing:.06em;color:${color.pilot};margin-bottom:${Math.round(kicker * 0.5)}px}
.kicker.top{position:absolute;left:${Math.round(height * 0.1)}px;top:${Math.round(height * 0.1)}px;width:${Math.round(kicker * 7)}px}
.foot{position:absolute;left:0;right:0;bottom:0;height:${foot}px;display:flex}
.foot i{flex:1}
</style></head><body>${flecks(width, height)}<div class="stage">${lockup}</div>
<div class="foot">${FOOT.map((c) => `<i style="background:${c}"></i>`).join('')}</div></body></html>`
}
