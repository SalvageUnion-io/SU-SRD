/**
 * A guide page's "On this page" contents mark the section the reader is in
 * (scroll-spy).
 *
 * Plain DOM, so both of srd's paths share it: `GuideSteps` starts it in an
 * effect where the card is a React island, and srd's client entry starts it
 * over a card served as static HTML, which never runs an effect. The current
 * entry is the last heading whose top has crossed the reading line near the
 * top of the viewport. Over the page's last screen the line slides down to
 * the viewport's foot, so the short steps at the end, which can never scroll
 * up to it, still take their turn. A followed contents link holds its entry
 * until the reader scrolls on their own. Its links, the phone's list and the
 * rail's alike, carry `aria-current="location"`, which the stylesheet styles.
 */

/** A guide page's root (`GuideSteps`'s `page`), which holds its contents. */
export const GUIDE_PAGE = '.su-guide--page'

/** The links the contents hold; each points at a heading's anchor. */
const GUIDE_CONTENTS_LINK = '.su-guide__toc-link'

/** The desktop rail, which scrolls on its own when the list is long. */
const GUIDE_RAIL = '.su-guide__rail'

/** A heading's anchor and its top, measured from the viewport's top. */
export type HeadingTop = { id: string; top: number }

/** The heading the reader is in: the last one at or above `line`; none above the first. */
export function currentHeading(headings: HeadingTop[], line: number): string | undefined {
  let current: string | undefined
  for (const heading of headings) {
    if (heading.top > line) break
    current = heading.id
  }
  return current
}

/**
 * The reading line, from the viewport's top: a fifth of the way down, sliding
 * to the foot of the viewport over the last screen of scroll, as `left` (the
 * scroll still left below) runs out.
 */
export function readingLine(viewport: number, left: number): number {
  const line = viewport / 5
  if (left >= viewport) return line
  return line + (viewport - line) * (1 - Math.max(left, 0) / viewport)
}

/** The reader scrolling on their own, which lets go of a followed link. */
const READER_SCROLLS = ['wheel', 'touchmove', 'keydown'] as const

/**
 * Watches the page's scroll and marks the current entry of the contents
 * inside `root`. Returns a function that stops watching, or `undefined` when
 * `root` holds no contents.
 */
export function watchGuideContents(root: ParentNode & Node): (() => void) | undefined {
  const doc = root.ownerDocument ?? (root as Document)
  const win = doc.defaultView
  const links = [...root.querySelectorAll<HTMLAnchorElement>(GUIDE_CONTENTS_LINK)]
  if (!win || links.length === 0) return undefined

  const linksById = new Map<string, HTMLAnchorElement[]>()
  const targets: HTMLElement[] = []
  for (const link of links) {
    const id = decodeURIComponent(link.hash.slice(1))
    const target = id ? doc.getElementById(id) : null
    if (!target) continue
    const group = linksById.get(id)
    if (group) {
      group.push(link)
    } else {
      linksById.set(id, [link])
      targets.push(target)
    }
  }
  if (targets.length === 0) return undefined

  let current: string | undefined
  let followed: string | undefined
  let frame = 0

  const update = () => {
    frame = 0
    const left = doc.documentElement.scrollHeight - win.innerHeight - win.scrollY
    const next =
      followed ??
      currentHeading(
        targets.map((target) => ({ id: target.id, top: target.getBoundingClientRect().top })),
        readingLine(win.innerHeight, left)
      )
    if (next === current) return
    for (const link of linksById.get(current ?? '') ?? []) link.removeAttribute('aria-current')
    current = next
    for (const link of linksById.get(current ?? '') ?? []) {
      link.setAttribute('aria-current', 'location')
      keepInRail(link)
    }
  }

  const schedule = () => {
    if (frame === 0) frame = win.requestAnimationFrame(update)
  }

  const follow = (event: Event) => {
    const id = decodeURIComponent((event.currentTarget as HTMLAnchorElement).hash.slice(1))
    followed = linksById.has(id) ? id : undefined
    schedule()
  }
  const letGo = () => {
    if (followed === undefined) return
    followed = undefined
    schedule()
  }

  for (const link of links) link.addEventListener('click', follow)
  for (const type of READER_SCROLLS) win.addEventListener(type, letGo, { passive: true })
  win.addEventListener('scroll', schedule, { passive: true })
  win.addEventListener('resize', schedule, { passive: true })
  update()

  return () => {
    for (const link of links) link.removeEventListener('click', follow)
    for (const type of READER_SCROLLS) win.removeEventListener(type, letGo)
    win.removeEventListener('scroll', schedule)
    win.removeEventListener('resize', schedule)
    if (frame !== 0) win.cancelAnimationFrame(frame)
  }
}

/**
 * Scrolls the rail, never the page, so its current entry stays in view when
 * the list is longer than the rail.
 */
function keepInRail(link: HTMLElement): void {
  const rail = link.closest<HTMLElement>(GUIDE_RAIL)
  if (!rail || rail.scrollHeight <= rail.clientHeight) return
  const railBox = rail.getBoundingClientRect()
  const linkBox = link.getBoundingClientRect()
  if (linkBox.top < railBox.top) {
    rail.scrollTop -= railBox.top - linkBox.top
  } else if (linkBox.bottom > railBox.bottom) {
    rail.scrollTop += linkBox.bottom - railBox.bottom
  }
}
