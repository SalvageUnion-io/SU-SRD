/**
 * `bun run brand` — writes every brand file from `mark.ts`.
 *
 * One run replaces the SU mark everywhere it is a file: the Union bar and
 * link-preview logo (`logos/su-cargo-dark.svg` in srd, ITUN and the catalog),
 * srd's favicon set and `favicon.ico`, ITUN's favicon and PWA icons, and the
 * Discord bot's profile icon. It lives in srd because srd owns sharp.
 *
 * `bun run brand:discord` (this file with `--upload-discord`) also sets the
 * bot's app icon and user avatar through the Discord API. The bot token is
 * `DISCORD_TOKEN` when set, else read from 1Password with the `op` CLI at
 * `DISCORD_TOKEN_REF`, the reference `apps/discord-bot/.env.example` uses.
 * Without the flag nothing leaves the machine.
 *
 * Not covered: the Discord banner (`apps/discord-bot/brand/banner.png`) and the
 * default link previews (`og-image.png`) carry no mark, and the Ko-fi page has
 * no API, so its avatar is uploaded by hand from `icon.png`.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import sharp from 'sharp'
import { ICO_FILE, ICO_SIZES, PNG_FILES, SVG_FILES } from './files'
import { markSvg } from './mark'

const ROOT = join(import.meta.dir, '../../../..')

function log(message: string) {
  // biome-ignore lint/suspicious/noConsole: CLI script — progress on stdout is the point
  console.log(message)
}

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

/** The bot token in 1Password, by vault and item id (its "Bot Token" field). */
const DISCORD_TOKEN_REF = 'op://3g5es2rt55ulrfxbs3d3j5fvje/m6vojy66gkpq2xxqi6g27bve3m/Bot Token'

function readOnePassword(ref: string): string {
  const read = Bun.spawnSync(['op', 'read', ref], { stderr: 'inherit' })
  const value = read.stdout.toString().trim()
  if (!read.success || !value) throw new Error(`could not read ${ref}: sign in with \`op signin\``)
  return value
}

async function uploadDiscord(icon: Buffer) {
  const token = process.env.DISCORD_TOKEN ?? readOnePassword(DISCORD_TOKEN_REF)
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
