/**
 * What `bun run brand` writes, and from which mark. Kept apart from `build.ts`
 * so the drift test reads it without loading sharp.
 */
import { markSvg } from './mark'

/** Every SVG `build.ts` writes, by repo path. The drift test reads this list. */
export const SVG_FILES: Record<string, string> = {
  'apps/web/public/logos/su-cargo-dark.svg': markSvg({ title: 'Salvage Union' }),
  'apps/web/public/favicons/su/favicon.svg': markSvg({ title: 'Salvage Union' }),
  'apps/discord-bot/brand/icon.svg': markSvg({
    title: 'Salvage Union',
    avatar: true,
    flecks: true,
    px: 1024,
  }),
}

/** Rasters: [repo path, pixel size, source]. Flecks only from 180px up. */
export const PNG_FILES: readonly [string, number, string][] = [
  ['apps/web/public/favicons/su/favicon-16.png', 16, markSvg({ title: '' })],
  ['apps/web/public/favicons/su/favicon-32.png', 32, markSvg({ title: '' })],
  ['apps/web/public/favicons/su/favicon-180.png', 180, markSvg({ title: '', flecks: true })],
  ['apps/web/public/web-app-manifest-192x192.png', 192, markSvg({ title: '', flecks: true })],
  ['apps/web/public/web-app-manifest-512x512.png', 512, markSvg({ title: '', flecks: true })],
  ['apps/discord-bot/brand/icon.png', 1024, markSvg({ title: '', avatar: true, flecks: true })],
]

export const ICO_SIZES = [16, 32, 48] as const
export const ICO_FILE = 'apps/web/public/favicon.ico'
