/**
 * `bun run brand` — writes every brand file from `mark.ts`.
 *
 * One run replaces the SU mark everywhere it is a file: the Union bar and
 * link-preview logo (`logos/su-cargo-dark.svg` in srd, ITUN and the catalog),
 * srd's favicon set and `favicon.ico`, ITUN's favicon and PWA icons, and the
 * Discord bot's profile icon. It lives in srd because srd owns sharp.
 *
 * It also screenshots the profile banners (`banner.ts`): Discord's and the Ko-fi
 * cover, `apps/discord-bot/brand/{banner,kofi-cover}.png`.
 *
 * `bun run brand:discord` (this file with `--upload-discord`) also sets the
 * bot's app icon, user avatar and profile banner through the Discord API. The bot token is
 * `DISCORD_TOKEN` when set, else read from 1Password with the `op` CLI at
 * `DISCORD_TOKEN_REF`, the reference `apps/discord-bot/.env.example` uses.
 * Without the flag nothing leaves the machine.
 *
 * Not covered: the default link previews (`og-image.png`) carry no mark, and
 * Ko-fi has no API, so its avatar (`icon.png`) and cover go up by hand.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { launchBrowser } from 'gates/lib/chromium'
import sharp from 'sharp'
import { BANNERS, bannerHtml } from './banner'
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

/** Screenshots each banner page at its exact size; the wordmark needs a browser's text. */
async function banners(): Promise<Map<string, Buffer>> {
  const browser = await launchBrowser()
  const out = new Map<string, Buffer>()
  for (const [path, layout] of Object.entries(BANNERS)) {
    const page = await browser.newPage({ viewport: { width: layout.width, height: layout.height } })
    await page.setContent(bannerHtml(layout))
    await page.evaluate(() => document.fonts.ready)
    out.set(
      path,
      await sharp(await page.screenshot())
        .png({ palette: true, compressionLevel: 9 })
        .toBuffer()
    )
    await page.close()
  }
  await browser.close()
  return out
}

function write(path: string, data: string | Buffer) {
  const abs = join(ROOT, path)
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, data)
  log(`wrote ${path}`)
}

/** The bot token in 1Password (vault SUSRD, item discord-bot, field Bot Token). */
const DISCORD_TOKEN_REF = 'op://SUSRD/discord-bot/Bot Token'

function readOnePassword(ref: string): string {
  const read = Bun.spawnSync(['op', 'read', ref], { stderr: 'inherit' })
  const value = read.stdout.toString().trim()
  if (!read.success || !value) throw new Error(`could not read ${ref}: sign in with \`op signin\``)
  return value
}

/** One PATCH, retried once when the connection drops (Discord resets some uploads). */
async function patchDiscord(token: string, route: string, body: Record<string, string>) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(`https://discord.com/api/v10/${route}`, {
        method: 'PATCH',
        headers: { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(`PATCH /${route}: ${res.status} ${await res.text()}`)
      log(`updated Discord ${route} (${Object.keys(body).join(', ')})`)
      return
    } catch (error) {
      if (attempt >= 2 || (error instanceof Error && error.message.startsWith('PATCH'))) throw error
      log(`retrying ${route}: ${String(error)}`)
      await Bun.sleep(2000)
    }
  }
}

async function uploadDiscord(icon: Buffer, banner: Buffer) {
  const token = process.env.DISCORD_TOKEN ?? readOnePassword(DISCORD_TOKEN_REF)
  const dataUri = (png: Buffer) => `data:image/png;base64,${png.toString('base64')}`
  // One image per request: the avatar and banner together were reset mid-upload.
  await patchDiscord(token, 'applications/@me', { icon: dataUri(icon) })
  await patchDiscord(token, 'users/@me', { avatar: dataUri(icon) })
  await patchDiscord(token, 'users/@me', { banner: dataUri(banner) })
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
  const rendered = await banners()
  for (const [path, data] of rendered) write(path, data)
  const discordBanner = rendered.get('apps/discord-bot/brand/banner.png')
  if (process.argv.includes('--upload-discord') && discordIcon && discordBanner) {
    await uploadDiscord(discordIcon, discordBanner)
  }
}

if (import.meta.main) await main()
