import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { kindMatchCss } from '../../components/atoms/unionBarMatch'
import { contrastRatio as contrast, resolveColor, TEXT_CONTRAST } from '../../design/contrast'
import { color } from '../../design/tokens'

/**
 * K13: the footer matches the header. Both read one pair, the chrome: ink
 * deep under paper (`--color-ink-deep`, `--color-paper`), so neither can
 * drift from the other on any surface. This reads each one's rule in
 * `partials/shell.css`, the only place the bar and foot colours are set. The area rail
 * under the header stands on the page's band itself, its words in the band's
 * foreground, never a translucent wash that shifts the band's colour.
 */
const css = readFileSync(join(import.meta.dir, '..', 'best-site.css'), 'utf8')
const shell = readFileSync(join(import.meta.dir, '..', 'partials', 'shell.css'), 'utf8')

/** The declarations of the first rule whose selector starts the given text. */
function rule(selector: string, from = css): string {
  const at = from.indexOf(`${selector} {`)
  expect(at).toBeGreaterThan(-1)
  return from.slice(at, from.indexOf('}', at))
}

describe('the footer matches the header (K13)', () => {
  test('the header reads the chrome', () => {
    const header = rule('.su-union-bar', shell)
    expect(header).toContain('--su-bar-bg: var(--color-ink-deep)')
    expect(header).toContain('--su-bar-fg: var(--color-paper)')
  })

  test('the footer reads the same chrome', () => {
    const foot = rule('.su-chapter-foot', shell)
    expect(foot).toContain('--su-foot-bg: var(--color-ink-deep)')
    expect(foot).toContain('--su-foot-fg: var(--color-paper)')
  })

  test('the chrome’s ink reads on its ground', () => {
    const ink = resolveColor(color.paper)
    const ground = resolveColor(color.inkDeep)
    if (!ink || !ground) throw new Error('the chrome tokens resolve')
    expect(contrast(ink, ground)).toBeGreaterThanOrEqual(TEXT_CONTRAST)
  })
})

describe('the area rail wears the band (K13)', () => {
  test('its words are the band’s foreground', () => {
    const rail = rule('.su-union-bar[data-mode] .su-union-bar__rail[data-area]')
    for (const step of ['fg', 'fg-85', 'fg-70', 'fg-60']) {
      expect(rail).toContain(`--su-bar-${step}: var(--su-on-kind, var(--color-ink))`)
    }
  })

  test('no band lays a wash under it', () => {
    expect(css).not.toContain('--su-rail-ground')
    expect(kindMatchCss('k', 'var(--color-crawler-band)', 'paper')).not.toContain('rail')
  })
})
