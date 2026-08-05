/**
 * islands.client — the one client entry every page loads.
 *
 * Scans `[data-island]` placeholders, resolves each one's chunk from
 * `islandRegistry`, and mounts it with **`createRoot`, never `hydrateRoot`**.
 *
 * That choice is the whole reason this migration is tractable (see
 * `ssg/DESIGN.md`): `useGameData`'s server snapshot is hardcoded `false`, so a
 * hydrating card renders its fallback on the client's first pass while the
 * server rendered the real thing — React #418. Client-only mounting has no
 * mismatch class at all, because the server markup is discarded rather than
 * matched. `el.replaceChildren()` below is what discards it, and is what keeps
 * an `ssr: true` island from double-rendering.
 */

import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { initBrowserObservability } from '../lib/observability'
import { islandRegistry } from './islandRegistry'

// Env-gated browser error tracking. BaseLayout.astro carried this as its own
// inline module script; with a single client entry there is one place for it.
void initBrowserObservability()

type PropsById = Record<string, Record<string, unknown>>

function readIslandProps(): PropsById {
  const script = document.querySelector('script[data-island-props]')
  if (!script?.textContent) return {}
  try {
    return JSON.parse(script.textContent) as PropsById
  } catch (error) {
    console.error('[islands] could not parse data-island-props', error)
    return {}
  }
}

function schedule(directive: string, el: Element, mount: () => void): void {
  if (directive === 'idle') {
    if ('requestIdleCallback' in window) window.requestIdleCallback(() => mount())
    else setTimeout(mount, 200)
    return
  }
  if (directive === 'visible') {
    if (!('IntersectionObserver' in window)) {
      mount()
      return
    }
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        observer.disconnect()
        mount()
        return
      }
    })
    observer.observe(el)
    return
  }
  // 'load' and 'only' both mean "as soon as this entry runs".
  mount()
}

function mountIslands(): void {
  const propsById = readIslandProps()

  for (const el of document.querySelectorAll<HTMLElement>('[data-island]')) {
    const name = el.dataset.island
    if (!name) continue
    const loader = islandRegistry[name]
    if (!loader) {
      console.error(`[islands] no registry entry for "${name}"`)
      continue
    }
    const id = el.dataset.islandId ?? ''
    const props = propsById[id] ?? {}
    const directive = el.dataset.client ?? 'load'

    schedule(directive, el, () => {
      loader()
        .then((Component) => {
          // Discard any ssr:true placeholder markup BEFORE mounting, so the
          // island renders once rather than appending beside its own SSR copy.
          el.replaceChildren()
          createRoot(el).render(createElement(Component, props))
        })
        .catch((error: unknown) => {
          console.error(`[islands] failed to load "${name}"`, error)
        })
    })
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountIslands, { once: true })
} else {
  mountIslands()
}
