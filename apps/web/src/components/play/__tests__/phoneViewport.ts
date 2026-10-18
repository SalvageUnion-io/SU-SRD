/**
 * A phone's viewport for a test of Play's phone form (play.md §11): the
 * window and the canvas host read 390×844 at 100% zoom, so `PlayCanvas`
 * draws its `phone` form (`isPhoneForm`). happy-dom lays nothing out, so the
 * host's own `clientWidth` (0 there) is stubbed with the window's.
 *
 * Returns the restore; call it in a `finally` or an `afterEach`.
 */

const WINDOW_PROPS = ['devicePixelRatio', 'innerHeight', 'innerWidth', 'outerWidth'] as const

export function phoneViewport(width = 390, height = 844): () => void {
  const proto = Object.getPrototypeOf(document.documentElement) as object
  const owner = [proto, HTMLElement.prototype, Element.prototype].find((p) =>
    Object.getOwnPropertyDescriptor(p, 'clientWidth')
  ) as object
  const clientWidth = Object.getOwnPropertyDescriptor(owner, 'clientWidth') as PropertyDescriptor
  const saved = WINDOW_PROPS.map((k) => [k, Object.getOwnPropertyDescriptor(window, k)] as const)
  const set = (k: string, value: number) =>
    Object.defineProperty(window, k, { configurable: true, value, writable: true })

  Object.defineProperty(owner, 'clientWidth', {
    configurable: true,
    get(this: Element) {
      if (this === document.documentElement || this.classList.contains('su-dash-root')) {
        return width
      }
      return clientWidth.get?.call(this)
    },
  })
  set('devicePixelRatio', 1)
  set('innerWidth', width)
  set('outerWidth', width)
  set('innerHeight', height)

  return () => {
    Object.defineProperty(owner, 'clientWidth', clientWidth)
    for (const [k, d] of saved) {
      if (d) Object.defineProperty(window, k, d)
      else delete (window as unknown as Record<string, unknown>)[k]
    }
  }
}
