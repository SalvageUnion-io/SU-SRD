import type { Page } from '@playwright/test'
import type { Finding } from './_findings'
import { fromFaults } from './_findings'

/**
 * EDL E6 ("Nested contentful and Peek heads link"; Modes: a link is the whole
 * surface, contentful its head), as the rendered page draws it. Where
 * an entity links to its Page but cannot be one `<a>` (a contentful card met
 * inside another, whose body reads; a Mini with controls, which never nest in
 * a link), its name's link stretches over the whole head: every point of the
 * head opens the entity, but a control or Peek of the head's own. The heads
 * read are a card's band whose name links (`CardTitleLink`) and the pill of a
 * Mini with controls whose name links (`[data-acts]`).
 *
 * `findLinkHeads` probes a grid of points across each head (scrolled into
 * view; a point something else covers, a sticky bar, is skipped) and returns
 * one `dead:` line per head with a point that hits neither its link nor one
 * of its controls.
 */

/** Runs in the page; returns plain data. */
function scanLinkHeads(): string[] {
  const LINK = ":is(a, [role='button'])"
  const CONTROL =
    "a, button, input, select, textarea, [role='button'], [tabindex]:not([tabindex='-1']), [data-peek]"
  const heads: { head: Element; link: Element }[] = []
  for (const link of document.querySelectorAll(`${LINK}.su-card-title-link`)) {
    const head = link.closest('.su-entity-compact__head')
    if (head) heads.push({ head, link })
  }
  for (const link of document.querySelectorAll(`[data-acts] ${LINK}.su-entity-mini__link`)) {
    const head = link.closest('.su-entity-mini__pill')
    if (head) heads.push({ head, link })
  }
  const faults: string[] = []
  for (const { head, link } of heads) {
    if (head.closest('[aria-hidden="true"], [inert]')) continue
    head.scrollIntoView({ block: 'center', inline: 'nearest' })
    const r = head.getBoundingClientRect()
    if (r.width < 8 || r.height < 8) continue
    const dead: string[] = []
    for (const fx of [0.1, 0.3, 0.5, 0.7, 0.9]) {
      for (const fy of [0.25, 0.5, 0.75]) {
        const x = r.left + r.width * fx
        const y = r.top + r.height * fy
        const hit = document.elementFromPoint(x, y)
        if (!hit || !head.contains(hit)) continue
        if (hit === link || link.contains(hit)) continue
        const control = hit.closest(CONTROL)
        if (control && head.contains(control)) continue
        const tag = hit.classList[0] ?? hit.tagName.toLowerCase()
        dead.push(`${Math.round(fx * 100)}%,${Math.round(fy * 100)}% (${tag})`)
      }
    }
    if (dead.length > 0) {
      const name = (link.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40)
      faults.push(`dead: "${name}"'s head opens nothing at ${dead.join(', ')}`)
    }
  }
  return faults
}

/** Every linked head on the page with a point that opens nothing. */
export async function findLinkHeads(page: Page): Promise<Finding[]> {
  return fromFaults(await page.evaluate(scanLinkHeads))
}

/** How many linked heads the page has, so a gate can tell it read some. */
export async function countLinkHeads(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      document.querySelectorAll(
        ":is(a, [role='button']).su-card-title-link, [data-acts] :is(a, [role='button']).su-entity-mini__link"
      ).length
  )
}

/** An entity's link surfaces that are real anchors: every form's, and the heads above. */
const ENTITY_ANCHORS = [
  'a.su-entity-compact',
  'a.su-entity-compact__cover',
  'a.su-entity-index',
  'a.su-entity-mini',
  'a.su-entity-mini__head',
  'a.su-entity-mini__link',
  'a.su-card-title-link',
  'a.su-pattern-rows__head',
  'a.su-class-path__link',
].join(',')

/**
 * Every entity link on the page (scoped to `within`, a dialog) that opens no
 * page: one `route:` line per href that answers an error or draws the app's
 * Page Not Found (the app's shell answers every path under its base, so the
 * status alone cannot tell; an SRD path inside the app was one).
 */
export async function findDeadLinks(page: Page, within = 'body'): Promise<Finding[]> {
  const hrefs = await page.evaluate(
    ({ within, anchors }) => [
      ...new Set(
        [...(document.querySelector(within)?.querySelectorAll(anchors) ?? [])].map(
          (a) => (a as HTMLAnchorElement).href
        )
      ),
    ],
    { within, anchors: ENTITY_ANCHORS }
  )
  const faults: string[] = []
  const probe = await page.context().newPage()
  try {
    for (const href of hrefs) {
      const response = await probe.goto(href, { waitUntil: 'networkidle' })
      const status = response?.status() ?? 0
      const notFound =
        status >= 400 ||
        (await probe
          .locator('.su-not-found')
          .first()
          .waitFor({ timeout: 2_000 })
          .then(() => true)
          .catch(() => false))
      if (notFound) faults.push(`route: ${new URL(href).pathname} opens no page (${status})`)
    }
  } finally {
    await probe.close()
  }
  return fromFaults(faults)
}
