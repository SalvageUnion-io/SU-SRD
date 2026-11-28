/**
 * `client:interaction` — Astro's directive for an island whose server
 * markup is the finished page: it hydrates only when a reader reaches for it
 * (`../interaction.ts`), and what they did meanwhile is played back once the
 * island has swapped in over its stand-in (`../clientSwap.tsx`).
 *
 * An island that cannot wait (`../mountNow.ts`) hydrates as soon as it is in
 * view; a listing, at once. Registered by `astro/build/islandDirectives.ts`; Astro inlines it into
 * every page that uses it, so it stays free of React.
 */

import type { ClientDirective } from 'astro'
import { replayInteraction, watchInteraction } from '../interaction'
import { ISLAND_COMMIT } from '../islandCommit'
import { mountsNow, mountsUnseen } from '../mountNow'

/** The directive's value: `client:interaction={{ … }}` (`Islands.astro`). */
export type InteractionOptions = {
  /** Which island, and the props `mountsNow` reads, to ask whether it can wait. */
  name: string
  props?: Record<string, unknown>
  /** Wake on intent toward any element matching this selector, page-wide (the Peek). */
  trigger?: string
}

/** On an island that mounts at once, until its first commit. */
const PENDING_ATTRIBUTE = 'data-island-pending'

/** The longest a pending island's stale markup stays out of sight. */
const PENDING_LIMIT_MS = 4000

/** The island's own element (`clientSwap`), and its stand-in's root inside Astro's slot. */
function standInRoot(el: HTMLElement): HTMLElement {
  const own = el.querySelector<HTMLElement>(':scope > [data-island]') ?? el
  return own.querySelector<HTMLElement>(':scope > astro-slot') ?? own
}

/**
 * The first element at or under `el` that draws a box. `astro-island` and an
 * island that is its page's rows (`.su-listing-shell`) are `display: contents`,
 * and an element with no box never intersects anything.
 */
function boxOf(el: Element): Element {
  let node = el
  while (getComputedStyle(node).display === 'contents' && node.firstElementChild)
    node = node.firstElementChild
  return node
}

const interaction: ClientDirective = (load, options, el) => {
  const { name, props = {}, trigger } = (options.value ?? {}) as unknown as InteractionOptions
  const hydrate = async () => {
    const run = await load()
    await run()
  }

  if (mountsNow(name, props)) {
    // The server's markup is not what this visit shows (a filtered or sorted
    // listing): mark the island until its first commit, so the stylesheet can
    // keep the wrong rows out of sight in their place instead of flashing
    // them (`[data-island-pending]`). Lifted too if the island never comes.
    el.setAttribute(PENDING_ATTRIBUTE, '')
    const settle = () => el.removeAttribute(PENDING_ATTRIBUTE)
    el.addEventListener(ISLAND_COMMIT, settle, { once: true })
    setTimeout(settle, PENDING_LIMIT_MS)
    // A listing mounts at once: the browser restores Back's scroll over the
    // served rows, held in place, and the listing's own rows replace them.
    if (mountsUnseen(name)) {
      hydrate().catch(settle)
      return
    }
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return
      observer.disconnect()
      hydrate().catch(settle)
    })
    observer.observe(boxOf(el))
    return
  }

  const root = standInRoot(el)
  const watch = watchInteraction(
    root,
    () => {
      el.addEventListener(
        ISLAND_COMMIT,
        () => {
          const own = el.querySelector<HTMLElement>(':scope > [data-island]') ?? el
          replayInteraction(own, watch.finish())
        },
        { once: true }
      )
      void hydrate()
    },
    { trigger }
  )
}

/** Astro loads it by path (`astro/build/islandDirectives.ts`). @public */
export default interaction
