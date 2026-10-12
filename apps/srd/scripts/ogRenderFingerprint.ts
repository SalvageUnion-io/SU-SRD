/**
 * The OG card's render fingerprint: a hash of exactly the built bytes that draw
 * the card, so the OG cache (`og-screenshots.ts`) invalidates when the card's
 * rendering changes and only then.
 *
 * The closure is walked from the built `dist/og-card/index.html`, following
 * every file it references (stylesheet → fonts and images, islands entry →
 * its static imports → the `OgCardIsland` chunk and everything it imports),
 * with three exceptions that keep unrelated commits from invalidating it:
 *
 *   - **Data chunks** (one per `data/*.json`: `var e=…;export{e as default}`,
 *     importing nothing) are skipped: each entity's own JSON is already in its
 *     per-entity cache key.
 *   - **Other islands**: the islands entry is a registry of every island, so
 *     a chunk named `…Island` other than `OgCardIsland` is not followed.
 *   - **Content hashes in file names** (`Entity-Zsia8phX.js`) are stripped
 *     from paths and contents, and Vite's preload dependency map is dropped:
 *     both change whenever any chunk anywhere changes, while the referenced
 *     files' own bytes, which ARE hashed, are what actually renders.
 *
 * A single stylesheet serves every page, so any CSS change still invalidates
 * every card — conservative, never stale.
 */
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'

const OG_ISLAND = 'OgCardIsland'
// Files whose contents can reference other files.
const TEXT_EXT = /\.(?:html|js|mjs|css|svg|json|webmanifest)$/
// A path-like token ending in a file extension the card could load.
const REF =
  /(?:\.{0,2}\/)?[\w@.-]+(?:\/[\w@.-]+)*\.(?:js|mjs|css|woff2?|ttf|otf|webp|png|svg|jpe?g|avif|gif|json)(?![\w.])/g
// Rolldown's `[name]-[hash]` file names: an 8-character base64url hash.
const HASHED = /^(.+)-[A-Za-z0-9_-]{8}(\.\w+)$/
// A data module: one literal, exported, importing nothing.
const DATA_CHUNK = /^var \w+=[\s\S]*;export\{\w+ as default\};?\s*$/
const IMPORTS = /\bfrom"\.|\bimport\(/
// Vite's preload map (`m.f=[…]`) lists every island's dependencies, and its
// call sites index into it.
const PRELOAD_MAP = /m\.f=\[[^\]]*\]/g
const PRELOAD_CALL = /__vite__mapDeps\(\[[\d,]*\]\)/g

/** `Entity-Zsia8phX.js` → `Entity.js`; anything else unchanged. */
function stripHash(name: string): string {
  const match = HASHED.exec(name)
  return match ? `${match[1]}${match[2]}` : name
}

/** `dist/assets/Entity-Zsia8phX.js` → `Entity`. */
function baseName(file: string): string {
  return stripHash(file.split(sep).pop() ?? '').replace(/\.\w+$/, '')
}

function isOtherIsland(file: string): boolean {
  const base = baseName(file)
  return base.endsWith('Island') && base !== OG_ISLAND
}

function isDataChunk(file: string, text: string, dataNames: ReadonlySet<string>): boolean {
  return (
    file.endsWith('.js') &&
    dataNames.has(baseName(file)) &&
    DATA_CHUNK.test(text) &&
    !IMPORTS.test(text)
  )
}

/** Every hashed file name under `dist/assets`, for stripping out of contents. */
function hashedNames(distDir: string): Map<string, string> {
  const names = new Map<string, string>()
  let files: string[] = []
  try {
    files = readdirSync(join(distDir, 'assets'))
  } catch {
    // No assets dir: nothing to strip.
  }
  for (const name of files) {
    const stripped = stripHash(name)
    if (stripped !== name) names.set(name, stripped)
  }
  return names
}

function resolveRef(ref: string, from: string, distDir: string): string | undefined {
  const candidates = ref.startsWith('/')
    ? [join(distDir, ref)]
    : ref.startsWith('.')
      ? [resolve(dirname(from), ref)]
      : [resolve(dirname(from), ref), join(distDir, ref)]
  for (const path of candidates) {
    if (!path.startsWith(distDir + sep)) continue
    try {
      if (statSync(path).isFile()) return path
    } catch {
      // Not a file in dist: a URL fragment, an external host, prose.
    }
  }
  return undefined
}

/**
 * The fingerprint of `distDir/og-card/index.html`'s render closure.
 * `dataNames` are the game-data modules' names (`chassis`, `meld`, … — the
 * reference package's `data/*.json` basenames). Throws if the page is missing:
 * the caller decides what an unknown renderer means.
 */
export function ogRenderFingerprint(distDir: string, dataNames: ReadonlySet<string>): string {
  const root = resolve(distDir)
  const entry = join(root, 'og-card', 'index.html')
  const hashed = hashedNames(root)
  const normalize = (text: string): string =>
    text
      .replace(PRELOAD_MAP, 'm.f=[]')
      .replace(PRELOAD_CALL, '__vite__mapDeps([])')
      .replace(/[\w.-]+-[A-Za-z0-9_-]{8}\.\w+/g, (name) => hashed.get(name) ?? name)

  const seen = new Map<string, string>() // dist-relative, hash-stripped path → content digest
  const queue = [entry]
  readFileSync(entry) // missing page: throw now, not hash an empty closure
  for (let file = queue.pop(); file !== undefined; file = queue.pop()) {
    const key = relative(root, file).split(sep).map(stripHash).join('/')
    if (seen.has(key)) continue
    const bytes = readFileSync(file)
    const digest = createHash('sha256')
    if (TEXT_EXT.test(file)) {
      const text = bytes.toString('utf8')
      if (isDataChunk(file, text, dataNames)) continue
      // Drop the preload map before scanning, so its list of every island's
      // dependencies is not followed either.
      const body = normalize(text)
      digest.update(body)
      for (const ref of text.replace(PRELOAD_MAP, '').match(REF) ?? []) {
        const target = resolveRef(ref, file, root)
        if (target && !isOtherIsland(target)) queue.push(target)
      }
    } else {
      digest.update(bytes)
    }
    seen.set(key, digest.digest('hex'))
  }

  const out = createHash('sha256')
  for (const key of [...seen.keys()].sort()) out.update(`${key}\0${seen.get(key)}\n`)
  return out.digest('hex')
}
