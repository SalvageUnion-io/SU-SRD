/**
 * Run `work` once the reader is looking at this page: now, or, for a page the
 * browser prerendered from a hovered link (`BaseLayout`'s speculation rules),
 * when it is shown. A prerender the reader never opens does no background work.
 *
 * `work` is always called with no arguments. Handing it to `addEventListener`
 * directly would pass it the `prerenderingchange` Event, and a `work` with an
 * optional first parameter (`registerSiteWorker(host = window)`) would take
 * the Event as that parameter.
 */

/** The slice of `document` `whenShown` reads; tests pass a stand-in. */
type ShownDocument = {
  prerendering?: boolean
  addEventListener: (
    type: 'prerenderingchange',
    listener: () => void,
    options: { once: true }
  ) => void
}

export function whenShown(work: () => void, doc: ShownDocument = document as ShownDocument): void {
  if (doc.prerendering) {
    doc.addEventListener('prerenderingchange', () => work(), { once: true })
  } else {
    work()
  }
}
