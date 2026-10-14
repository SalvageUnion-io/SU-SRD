/**
 * `bun run brand` — writes every brand file from `mark.ts`.
 *
 * One run replaces the SU mark everywhere it is a file: the Union bar and
 * link-preview logo (`logos/su-cargo-dark.svg` in srd, ITUN and the catalog),
 * srd's favicon set and `favicon.ico`, ITUN's favicon and PWA icons, and the
 * Discord bot's profile icon. It lives in srd because srd owns sharp.
 *
 * `bun scripts/brand/build.ts --upload-discord` (from apps/srd) also sets the bot's app icon and user avatar through the
 * Discord API, reading the bot token from `DISCORD_TOKEN` (the variable
 * `deploy-commands` reads). Without the flag nothing leaves the machine.
 *
 * Not covered: the Discord banner (`apps/discord-bot/brand/banner.png`) and the
 * default link previews (`og-image.png`) carry no mark, and the Ko-fi page has
 * no API, so its avatar is uploaded by hand from `icon.png`.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import sharp from 'sharp'
import { markSvg } from './mark'

const ROOT = join(import.meta.dir, '../../../..')

function log(message: string) {
  // biome-ignore lint/suspicious/noConsole: CLI script — progress on stdout is the point
  console.log(message)
}

/** Every SVG this script writes, by repo path. The drift test reads this list. */
export const SVG_FILES: Record<string, string> = {
  'apps/srd/public/logos/su-cargo-dark.svg': markSvg({ title: 'Salvage Union' }),
  'apps/itun/public/logos/su-cargo-dark.svg': markSvg({ title: 'Salvage Union' }),
  'apps/catalog/public/logos/su-cargo-dark.svg': markSvg({ title: 'Salvage Union' }),
  'apps/srd/public/favicons/su/favicon.svg': markSvg({ title: 'Salvage Union SRD' }),
  'apps/itun/public/favicon.svg': markSvg({ title: 'In the Union now' }),
  'apps/discord-bot/brand/icon.svg': markSvg({
    title: 'Salvage Union',
    avatar: true,
    flecks: true,
    px: 1024,
  }),
}

/** Rasters: [repo path, pixel size, source]. Flecks only from 180px up. */
const PNG_FILES: readonly [string, number, string][] = [
  ['apps/srd/public/favicons/su/favicon-16.png', 16, markSvg({ title: '' })],
  ['apps/srd/public/favicons/su/favicon-32.png', 32, markSvg({ title: '' })],
  ['apps/srd/public/favicons/su/favicon-180.png', 180, markSvg({ title: '', flecks: true })],
  ['apps/itun/public/icon-192.png', 192, markSvg({ title: '', flecks: true })],
  ['apps/itun/public/icon-512.png', 512, markSvg({ title: '', flecks: true })],
  ['apps/discord-bot/brand/icon.png', 1024, markSvg({ title: '', avatar: true, flecks: true })],
]

const ICO_SIZES = [16, 32, 48] as const
const ICO_FILE = 'apps/srd/public/favicon.ico'

function png(svg: string, size: number): Promise<Buffer> {
  return sharp(Buffer.from(svg), { density: (72 * size) / 512 })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toBuffer()
}

/** An ICO holding PNG images: a 6-byte header, a 16-byte entry each, then the PNGs. */
function ico(images: readonly { size: number; data: Buffer }[]): Buffer {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(images.length, 4)
  let offset = 6 + 16 * images.length
  const entries = images.map(({ size, data }) => {
    const entry = Buffer.alloc(16)
    entry.writeUInt8(size % 256, 0)
    entry.writeUInt8(size % 256, 1)
    entry.writeUInt16LE(1, 4)
    entry.writeUInt16LE(32, 6)
    entry.writeUInt32LE(data.length, 8)
    entry.writeUInt32LE(offset, 12)
    offset += data.length
    return entry
  })
  return Buffer.concat([header, ...entries, ...images.map((i) => i.data)])
}

function write(path: string, data: string | Buffer) {
  const abs = join(ROOT, path)
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, data)
  log(`wrote ${path}`)
}

async function uploadDiscord(icon: Buffer) {
  const token = process.env.DISCORD_TOKEN
  if (!token) throw new Error('--upload-discord needs DISCORD_TOKEN (the bot token)')
  const image = `data:image/png;base64,${icon.toString('base64')}`
  const calls: [string, Record<string, string>][] = [
    ['applications/@me', { icon: image }],
    ['users/@me', { avatar: image }],
  ]
  for (const [route, body] of calls) {
    const res = await fetch(`https://discord.com/api/v10/${route}`, {
      method: 'PATCH',
      headers: { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`PATCH /${route}: ${res.status} ${await res.text()}`)
    log(`updated Discord ${route}`)
  }
}

async function main() {
  for (const [path, svg] of Object.entries(SVG_FILES)) write(path, svg)
  let discordIcon: Buffer | undefined
  for (const [path, size, svg] of PNG_FILES) {
    const data = await png(svg, size)
    if (path.endsWith('discord-bot/brand/icon.png')) discordIcon = data
    write(path, data)
  }
  const plain = markSvg({ title: '' })
  const images = await Promise.all(
    ICO_SIZES.map(async (size) => ({ size, data: await png(plain, size) }))
  )
  write(ICO_FILE, ico(images))
  if (process.argv.includes('--upload-discord') && discordIcon) await uploadDiscord(discordIcon)
}

if (import.meta.main) await main()
