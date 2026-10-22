import type { Page } from '@playwright/test'

/**
 * The cut-out head on a CONTENTFUL Mini (N3), as the rendered page draws it.
 * Every Mini, Compact and index Compact sets its name on a tab of the paper notched into
 * its band's foot; a contentful Mini's tab opens into its body's paper, as a
 * Compact's opens into its body, so no rule runs between head and body.
 * `findMiniCutoutFaults` returns one line per fault:
 *
 * - **tab** the name is not on the cut-out (`.su-entity-mini__notch`).
 * - **paper** the tab is not the paper.
 * - **strip** less than `MIN_STRIP` of the paint shows above the tab: the
 *   head reads as a flat bar with the name on it.
 * - **open** the tab does not meet the body: a rule (the pill's edge) or a
 *   gap runs between them.
 * - **ground** the body is not the paper, so the tab stands on it as a box
 *   instead of being cut from it.
 *
 * The body's frame is R38's (the subtle ink-40), read by `_entityFrames.ts`.
 *
 * A Mini that is not drawn (a closed tab, a collapsed section) is not read,
 * nor a body that is empty (`:empty` hides it).
 */
export type MiniCutoutSelectors = {
  token: string
  pill: string
  notch: string
  body: string
}

export const TOKEN_CUTOUT_SELECTORS: MiniCutoutSelectors = {
  token: '.su-entity-mini[data-contentful]',
  pill: '.su-entity-mini__pill',
  notch: '.su-entity-mini__notch',
  body: ':scope > .su-entity-mini__body',
}

/** The paint above the tab, in CSS px: the header-only Mini's strip, its edge and padding. */
export const MIN_STRIP = 3

/** Runs in the page and returns plain data: everything it needs is declared inside it. */
export function scanMiniCutouts({
  a,
  minStrip,
}: {
  a: MiniCutoutSelectors
  minStrip: number
}): string[] {
  // The paper as the page resolves it, in the form computed styles report.
  const probe = document.createElement('span')
  probe.style.backgroundColor = 'var(--color-paper)'
  document.body.append(probe)
  const paper = getComputedStyle(probe).backgroundColor
  probe.remove()
  const faults: string[] = []
  for (const token of document.querySelectorAll<HTMLElement>(a.token)) {
    const pill = token.querySelector<HTMLElement>(a.pill)
    if (!pill) continue
    const pr = pill.getBoundingClientRect()
    if (pr.width === 0 || pr.height === 0) continue
    const name = (token.querySelector('[class*="__name"]')?.textContent ?? pill.textContent ?? '')
      .trim()
      .slice(0, 40)
    const notch = pill.querySelector<HTMLElement>(`:scope > ${a.notch}`)
    if (!notch) {
      faults.push(`tab: ${name}'s name is not on the cut-out`)
      continue
    }
    const ns = getComputedStyle(notch)
    if (ns.backgroundColor !== paper) {
      faults.push(`paper: ${name}'s tab is ${ns.backgroundColor}, not the paper`)
    }
    const ps = getComputedStyle(pill)
    const nr = notch.getBoundingClientRect()
    const strip = nr.top - (pr.top + Number.parseFloat(ps.borderTopWidth || '0'))
    if (strip < minStrip - 0.25) {
      faults.push(`strip: ${name} shows ${strip.toFixed(1)}px of paint over its tab`)
    }
    const body = token.querySelector<HTMLElement>(a.body)
    const br = body?.getBoundingClientRect()
    if (!body || !br || br.height === 0) continue
    if (Math.abs(br.top - nr.bottom) > 0.5) {
      faults.push(`open: ${name}'s tab stops ${(br.top - nr.bottom).toFixed(1)}px above its body`)
    }
    const ground = getComputedStyle(body).backgroundColor
    if (ground !== paper) {
      faults.push(`ground: ${name}'s body is ${ground}, not the paper its tab is cut from`)
    }
  }
  return faults
}

/** Every contentful Mini's cut-out fault on the page. */
export function findMiniCutoutFaults(page: Page): Promise<string[]> {
  return page.evaluate(scanMiniCutouts, { a: TOKEN_CUTOUT_SELECTORS, minStrip: MIN_STRIP })
}
