/**
 * Accessibility audit script using axe-core + puppeteer-core.
 * Scans pages of a running dev server and reports WCAG 2.1 AA violations.
 *
 * Usage: bun tools/a11y-scan.ts <base-url> <page1> <page2> ...
 */
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { join } from 'node:path'

const AXE_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.8.4/axe.min.js'

// Inject axe-core from the local install when available so the scan needs no
// network egress — the Claude Code sandbox does not allow-list the CDN host.
// Falls back to AXE_CDN for standalone use outside the repo. Requires axe-core
// to be a (dev)dependency for the local path to resolve.
const require = createRequire(import.meta.url)
let AXE_LOCAL_PATH: string | null = null
try {
  AXE_LOCAL_PATH = require.resolve('axe-core/axe.min.js')
} catch {
  AXE_LOCAL_PATH = null
}

// Chrome under the Claude Code sandbox: relocate Chrome's temp dir out of the
// macOS per-user temp (confstr _CS_DARWIN_USER_TEMP_DIR -> /var/folders/.../T),
// which the sandbox denies writes to. Chrome's ProcessSingleton creates its
// control socket there and aborts launch when it can't ("Failed to create
// socket directory" / "Failed to bind()"). macOS Chrome reads MAC_CHROMIUM_TMPDIR
// for this (it ignores $TMPDIR). The chosen dir must ALSO be listed in
// sandbox.network.allowUnixSockets so the singleton socket can bind — see
// .claude/settings.json. Harmless off macOS / outside the sandbox.
const CHROME_TMP = join(homedir(), '.cache', 'chrome-a11y')
mkdirSync(CHROME_TMP, { recursive: true })
process.env.MAC_CHROMIUM_TMPDIR = CHROME_TMP

type AxeNode = {
  html: string
  target: string[]
  failureSummary: string
}

type AxeViolation = {
  id: string
  impact: string
  description: string
  helpUrl: string
  nodes: AxeNode[]
}

type PageResult = {
  page: string
  violations: number
  passes: number
  incomplete: number
  details: AxeViolation[]
}

async function scanPage(
  page: Awaited<ReturnType<Awaited<ReturnType<typeof puppeteer.launch>>['newPage']>>,
  url: string,
  pathname: string
): Promise<PageResult> {
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 })
  // Wait for content to settle
  await new Promise((r) => setTimeout(r, 2000))

  // Inject axe-core — local copy when resolvable (no network), else CDN.
  if (AXE_LOCAL_PATH) {
    await page.addScriptTag({ path: AXE_LOCAL_PATH })
  } else {
    await page.addScriptTag({ url: AXE_CDN })
  }
  await new Promise((r) => setTimeout(r, 1000))

  const results = await page.evaluate(async () => {
    // @ts-expect-error axe is injected via script tag
    const res = await window.axe.run(document, {
      runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'],
    })
    return {
      violations: res.violations.length,
      passes: res.passes.length,
      incomplete: res.incomplete.length,
      details: res.violations.map(
        (v: {
          id: string
          impact: string
          description: string
          helpUrl: string
          nodes: { html: string; target: string[]; failureSummary: string }[]
        }) => ({
          id: v.id,
          impact: v.impact,
          description: v.description,
          helpUrl: v.helpUrl,
          nodes: v.nodes.slice(0, 5).map((n) => ({
            html: n.html.substring(0, 200),
            target: n.target,
            failureSummary: n.failureSummary,
          })),
        })
      ),
    }
  })

  return { page: pathname, ...results }
}

async function main() {
  const [baseUrl, ...pages] = process.argv.slice(2)
  if (!baseUrl || pages.length === 0) {
    console.error('Usage: bun tools/a11y-scan.ts <base-url> <page1> <page2> ...')
    process.exit(1)
  }

  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    userDataDir: join(CHROME_TMP, 'profile'),
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      `--disk-cache-dir=${join(CHROME_TMP, 'cache')}`,
      '--no-first-run',
      '--no-default-browser-check',
      // Crashpad/breakpad write to ~/Library/Application Support/Google and
      // register a Mach service, both sandbox-denied (non-fatal but noisy).
      '--disable-crash-reporter',
      '--disable-breakpad',
      // Avoid the macOS login keychain (sandbox-gated) for Chrome Safe Storage.
      '--use-mock-keychain',
      '--password-store=basic',
    ],
  })

  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 900 })

  const allResults: PageResult[] = []

  for (const pathname of pages) {
    const url = `${baseUrl}${pathname}`
    console.error(`Scanning ${url}...`)
    try {
      const result = await scanPage(page, url, pathname)
      allResults.push(result)
    } catch (err) {
      console.error(`  Error scanning ${pathname}: ${err}`)
      allResults.push({
        page: pathname,
        violations: -1,
        passes: 0,
        incomplete: 0,
        details: [],
      })
    }
  }

  await browser.close()

  // Output JSON results
  console.log(JSON.stringify(allResults, null, 2))
}

main()
