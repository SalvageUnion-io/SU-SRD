import type { Page } from '@playwright/test'
import type { Finding } from './_findings'
import { fromFaults } from './_findings'

/**
 * The frame-colour law (ruleset §4.3, EDL E21) as the
 * rendered page draws it: every entity's frame (a Compact's, CompactIndex's, Card's,
 * a contentful Mini's pill and body) wears its head's band paint (`--su-band`),
 * never the old neutral grey; a frame with no band (a `Box`, a MiniGroup) wears
 * the subtle `--color-ink-40`. `--su-compact-frame` overrides both: an
 * ability tree's tier, a pattern's colour. `findFrames` returns one
 * `frame:` line per frame whose drawn edges are another colour, and a
 * `bottom-edge:` line per Compact that is its head alone (`data-bodyless`) yet
 * draws an edge beneath it (R42); each fails. The static half is
 * `chrome-tokens/entity-frame-ink`.
 */
const ENTITY_FRAMES = [
  '.su-entity-compact__frame',
  '.su-entity-index__frame',
  '.su-ec-frame',
  '.su-entity-mini__pill',
  '.su-entity-mini__body',
  '.su-mini-group',
].join(',')

/** `--color-ink-40` as computed: warm ink at 0.4. */
const SUBTLE = 'rgba(40, 32, 25, 0.4)'

/** Runs in the page; returns plain data. */
function scanFrames({ frames, subtle }: { frames: string; subtle: string }): string[] {
  const faults: string[] = []
  // The colour this frame owes: its band's, resolved by a probe that reads the
  // same `--su-band` the frame inherits; a MiniGroup has no head, so no band.
  const owed = (el: Element) => {
    if (el.matches('.su-mini-group')) return subtle
    const probe = document.createElement('i')
    probe.style.cssText =
      'position:absolute;visibility:hidden;border-top:1px solid var(--su-band, var(--color-ink-40))'
    el.append(probe)
    const colour = getComputedStyle(probe).borderTopColor
    probe.remove()
    return colour
  }
  const describe = (el: Element) =>
    (el.closest('.su-entity-compact, .su-entity-mini, .su-entity-index, .su-ec') ?? el).textContent
      ?.trim()
      .replace(/\s+/g, ' ')
      .slice(0, 40) ?? ''
  for (const el of document.querySelectorAll(frames)) {
    if (el.closest('[aria-hidden="true"], [inert]')) continue
    const r = el.getBoundingClientRect()
    if (r.width < 1 || r.height < 1) continue
    const s = getComputedStyle(el)
    if (s.visibility === 'hidden' || s.display === 'none') continue
    // A Compact that is its head alone draws no edge beneath it (R42).
    if (el.matches('[data-bodyless]')) {
      const bottom = Number.parseFloat(s.getPropertyValue('border-bottom-width')) || 0
      const colour = s.getPropertyValue('border-bottom-color').trim()
      const drawn =
        bottom > 0 && !/^(?:none|hidden)$/.test(s.getPropertyValue('border-bottom-style'))
      if (drawn && !/^rgba\(.*,\s*0\)$|^transparent$/.test(colour)) {
        faults.push(
          `bottom-edge: "${describe(el)}" is its head alone, yet draws ${colour} beneath it`
        )
      }
    }
    // A tree's tier or a pattern's colour, through the one hook.
    if (s.getPropertyValue('--su-compact-frame').trim() !== '') continue
    const off = new Set<string>()
    const expected = owed(el)
    for (const side of ['top', 'right', 'bottom', 'left']) {
      const width = Number.parseFloat(s.getPropertyValue(`border-${side}-width`)) || 0
      const style = s.getPropertyValue(`border-${side}-style`)
      const colour = s.getPropertyValue(`border-${side}-color`).trim()
      if (width === 0 || style === 'none' || style === 'hidden') continue
      if (/^rgba\(.*,\s*0\)$|^transparent$/.test(colour)) continue
      if (colour !== expected) off.add(colour)
    }
    if (off.size > 0) {
      faults.push(
        `frame: "${describe(el)}" (${el.classList[0] ?? el.tagName.toLowerCase()}) is ${[...off].join(' / ')}, not its band's ${expected}`
      )
    }
  }
  return faults
}

/** Every entity frame on the page that does not wear its band's colour. */
export async function findFrames(page: Page): Promise<Finding[]> {
  return fromFaults(await page.evaluate(scanFrames, { frames: ENTITY_FRAMES, subtle: SUBTLE }))
}
