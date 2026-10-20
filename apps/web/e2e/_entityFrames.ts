import type { Page } from '@playwright/test'

/**
 * The frame-colour law (ruleset §4.3, EDL E21; owner, 2026-10-20) as the
 * rendered page draws it: every entity's frame (a Row's, Tile's, Card's, a
 * choice option's, a Token's pill and a contentful Token's body, a
 * TokenGroup's) wears the subtle `--color-ink-40` the sheets' panels wear,
 * never solid ink or the entity's tone. Only `--su-row-frame` colours one: an
 * ability tree's tier, a pattern's colour. `findFrameFaults` returns one
 * `frame:` line per frame whose drawn edges are another colour. Report-only
 * until the screens hold it (`_pendingRules.ts`); the static half is
 * `chrome-tokens/entity-frame-ink`.
 */
export const ENTITY_FRAMES = [
  '.su-entity-row__frame',
  '.su-entity-tile__frame',
  '.su-ec-frame',
  '[data-option-frame]',
  '.su-entity-token__pill',
  '.su-entity-token__body',
  '.su-token-group',
].join(',')

/** `--color-ink-40` as computed: warm ink at 0.4. */
export const SUBTLE = 'rgba(40, 32, 25, 0.4)'

/** Runs in the page; returns plain data. */
export function scanFrames({ frames, subtle }: { frames: string; subtle: string }): string[] {
  const faults: string[] = []
  const describe = (el: Element) =>
    (
      el.closest(
        '.su-entity-row, .su-entity-token, .su-entity-tile, .su-ec, [data-option-frame]'
      ) ?? el
    ).textContent
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
    if (s.getPropertyValue('--su-row-frame').trim() !== '') continue
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
export function findFrameFaults(page: Page): Promise<string[]> {
  return page.evaluate(scanFrames, { frames: ENTITY_FRAMES, subtle: SUBTLE })
}
