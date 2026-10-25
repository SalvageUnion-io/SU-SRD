/**
 * When an island mounts, by its `data-client` directive (the island protocol in
 * apps/web/astro/DESIGN.md, item 5, Scheduling). Its own module so it can be tested without importing
 * `islands.client.ts`, which mounts every island on the page as it loads.
 */

/**
 * The longest an `idle` island waits for an idle period. Without it,
 * `requestIdleCallback` can wait indefinitely on a main thread that is never
 * idle — a busy page, or a CI worker under load, where the roll-table island
 * once sat unmounted past a 30 s test timeout.
 */
export const IDLE_MOUNT_TIMEOUT_MS = 2000

export function schedule(directive: string, el: Element, mount: () => void): void {
  if (directive === 'idle') {
    if ('requestIdleCallback' in window)
      window.requestIdleCallback(() => mount(), { timeout: IDLE_MOUNT_TIMEOUT_MS })
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
