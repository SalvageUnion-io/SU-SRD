/**
 * A toast holds while the focus is on it, as it does under the pointer (chrome
 * K5; r5 C3). Sonner pauses its timers while its list is hovered, never while
 * it holds the focus, so a keyboard player tabbing to Undo would see it leave
 * under them: the focus coming in tells the list the pointer did, and the
 * focus going out (with no pointer over it) tells it the pointer left.
 */

const LIST = '[data-sonner-toaster]'

/** Hold the document's toasts while one has the focus; answers the release. */
export function holdToastsOnFocus(doc: Document = document): () => void {
  const listOf = (target: EventTarget | null): Element | null =>
    target instanceof Element ? target.closest(LIST) : null
  const onIn = (event: FocusEvent) => {
    const list = listOf(event.target)
    if (list === null || listOf(event.relatedTarget) === list) return
    list.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, relatedTarget: null }))
  }
  const onOut = (event: FocusEvent) => {
    const list = listOf(event.target)
    if (list === null || listOf(event.relatedTarget) === list || list.matches(':hover')) return
    list.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: doc.body }))
  }
  doc.addEventListener('focusin', onIn)
  doc.addEventListener('focusout', onOut)
  return () => {
    doc.removeEventListener('focusin', onIn)
    doc.removeEventListener('focusout', onOut)
  }
}
