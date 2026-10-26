/**
 * `client:interaction` — Astro's directive for an island whose server
 * markup is the finished page: it hydrates only when a reader reaches for it
 * (`../interaction.ts`), and what they did meanwhile is played back once the
 * island has swapped in over its stand-in (`../clientSwap.tsx`).
 *
 * An island that cannot wait (`../mountNow.ts`) hydrates as soon as it is in
 * view. Registered by `astro/build/islandDirectives.ts`; Astro inlines it into
 * every page that uses it, so it stays free of React.
 */

import type { ClientDirective } from 'astro'
import { replayInteraction, watchInteraction } from '../interaction'
import { ISLAND_COMMIT } from '../islandCommit'
import { mountsNow } from '../mountNow'

/** The directive's value: `client:interaction={{ … }}` (`Islands.astro`). */
export type InteractionOptions = {
  /** Which island, and the props `mountsNow` reads, to ask whether it can wait. */
  name: string
  props?: Record<string, unknown>
  /** Wake on intent toward any element matching this selector, page-wide (the Peek). */
  trigger?: string
}

/** The island's own element (`clientSwap`), and its stand-in's root inside Astro's slot. */
function standInRoot(el: HTMLElement): HTMLElement {
  const own = el.querySelector<HTMLElement>(':scope > [data-island]') ?? el
  return own.querySelector<HTMLElement>(':scope > astro-slot') ?? own
}

const interaction: ClientDirective = (load, options, el) => {
  const { name, props = {}, trigger } = (options.value ?? {}) as unknown as InteractionOptions
  const hydrate = async () => {
    const run = await load()
    await run()
  }

  if (mountsNow(name, props)) {
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return
      observer.disconnect()
      void hydrate()
    })
    observer.observe(el)
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
