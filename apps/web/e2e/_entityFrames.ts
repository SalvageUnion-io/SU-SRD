import type { Page } from '@playwright/test'
import type { Finding } from './_findings'
import { fromFaults } from './_findings'

/**
 * The frame-colour law (ruleset §4.3, EDL E21) as the
 * rendered page draws it: every entity's frame (a Compact's, CompactIndex's, Card's,
 * a choice option's `Box`, a Mini's pill and a contentful Mini's body, a
 * MiniGroup's) wears the subtle `--color-ink-40` the sheets' panels wear,
 * never solid ink or the entity's tone. Only `--su-compact-frame` colours one: an
 * ability tree's tier, a pattern's colour. `findFrames` returns one
 * `frame:` line per frame whose drawn edges are another colour, and each
 * fails; the static half is `chrome-tokens/entity-frame-ink`.
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
    // A tree's tier or a pattern's colour, through the one hook.
    if (s.getPropertyValue('--su-compact-frame').trim() !== '') continue
    const off = new Set<string>()
    for (const side of ['top', 'right', 'bottom', 'left']) {
      const width = Number.parseFloat(s.getPropertyValue(`border-${side}-width`)) || 0
      const style = s.getPropertyValue(`border-${side}-style`)
      const colour = s.getPropertyValue(`border-${side}-color`).trim()
      if (width === 0 || style === 'none' || style === 'hidden') continue
      if (/^rgba\(.*,\s*0\)$|^transparent$/.test(colour)) continue
      if (colour !== subtle) off.add(colour)
    }
    if (off.size > 0) {
      faults.push(
        `frame: "${describe(el)}" (${el.classList[0] ?? el.tagName.toLowerCase()}) is ${[...off].join(' / ')}, not the subtle ink-40`
      )
    }
  }
  return faults
}

/** Every entity frame on the page that is not the subtle ink-40. */
export async function findFrames(page: Page): Promise<Finding[]> {
  return fromFaults(await page.evaluate(scanFrames, { frames: ENTITY_FRAMES, subtle: SUBTLE }))
}
