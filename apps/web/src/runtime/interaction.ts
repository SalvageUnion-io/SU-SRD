/**
 * interaction — the `interaction` directive: an island whose server markup is
 * the finished page mounts only when a reader reaches for it, and what they
 * did in the meantime is carried across the mount.
 *
 * React, the island's chunk and its data are fetched on the reader's first
 * intent: a pointer over the island, a press, focus or a key inside it, or,
 * for an island that listens to the whole page (`trigger`), the same on any
 * element matching that selector. Until then the page has run no React at all.
 *
 * Fetching takes a moment, so the gesture that asked for the island usually
 * lands on the server markup, where nothing listens. Three things are carried:
 *
 * - **A press** on a button-like control is held (its default prevented) and
 *   clicked again on the same control once the island has committed.
 * - **Focus** that the mount dropped goes back to the same control.
 * - **A menu choice** (`<select>`, which has no `name` to carry it by) is
 *   chosen again on the same menu.
 * - **Hover and focus on a `trigger`** are announced again, so a host that
 *   reacts to `pointerover` or `focusin` (the Peek) sees the one that woke it.
 *
 * Controls are found again by their position under the stand-in: the
 * island's first commit draws the markup the server drew, so the same path
 * names the same control (`clientSwap`). Text a reader typed is carried by
 * `clientSwap`'s own form-state carry, by `name`.
 *
 * Its own module, free of React, because Astro inlines its directive
 * (`directives/interaction.ts`) into every page, and the point is that a page
 * nobody touches never loads React.
 */

/** Gestures that mean a reader is reaching for the island. */
const INTENT_EVENTS = ['pointerover', 'pointerdown', 'touchstart', 'focusin', 'keydown'] as const

/** A press on one of these does nothing until the island listens, so it is held for the replay. */
const PRESSABLE = 'button, [role="button"], [role="tab"], [role="switch"], summary'

/** A child-index path from a root down to one element in it. */
export type ElementPath = readonly number[]

/** The path from `root` to `el`, or null when `el` is not inside `root`. */
export function pathTo(root: Element, el: Element): ElementPath | null {
  const path: number[] = []
  let node: Element | null = el
  while (node && node !== root) {
    const parent: Element | null = node.parentElement
    if (!parent) return null
    path.unshift(Array.prototype.indexOf.call(parent.children, node))
    node = parent
  }
  return node === root ? path : null
}

/** The element at `path` under `root`, if the markup still has one there. */
export function elementAt(root: Element, path: ElementPath): Element | null {
  let node: Element | null = root
  for (const index of path) {
    node = node?.children.item(index) ?? null
    if (!node) return null
  }
  return node
}

/** What a reader did before the island was listening. */
export type PendingInteraction = {
  /** The control they pressed, under the placeholder. */
  press: ElementPath | null
  /** The control that had focus when the island was asked for, under the stand-in. */
  focus: ElementPath | null
  /**
   * Menus the reader changed, by position: a `<select>` has no `name` for
   * `clientSwap`'s form carry, and the island's first commit resets it.
   */
  changes: { path: ElementPath; value: string }[]
  /** The page-wide trigger (`trigger` islands) whose hover or focus woke the island. */
  trigger: Element | null
}

export type InteractionWatch = {
  /** Stop listening; returns what was gathered. Call once the island has committed. */
  finish(): PendingInteraction
}

type WatchOptions = {
  /**
   * Watch the whole document for intent on elements matching this selector,
   * instead of the placeholder's own subtree: an island that serves the page
   * (the Peek) rather than a region of it.
   */
  trigger?: string
}

/**
 * Calls `onIntent` once, on the first gesture toward `el` (or, with `trigger`,
 * toward a matching element anywhere in `doc`), and gathers what the reader
 * does until `finish()`.
 */
export function watchInteraction(
  el: HTMLElement,
  onIntent: () => void,
  { trigger }: WatchOptions = {},
  doc: Document = el.ownerDocument
): InteractionWatch {
  const pending: PendingInteraction = { press: null, focus: null, changes: [], trigger: null }
  let woken = false

  /** The element this gesture is aimed at, when it is one the island answers. */
  const aimedAt = (target: EventTarget | null): Element | null => {
    if (!(target instanceof Element)) return null
    if (trigger) return target.closest(trigger)
    return el.contains(target) ? target : null
  }

  const onIntentEvent = (event: Event) => {
    const aimed = aimedAt(event.target)
    if (!aimed) return
    if (trigger) pending.trigger = aimed
    else if (event.type === 'focusin') pending.focus = pathTo(el, aimed)
    if (woken) return
    woken = true
    onIntent()
  }

  // Capture, so a press is held before anything else on the page sees it.
  const onClick = (event: Event) => {
    if (trigger) return
    const aimed = aimedAt(event.target)
    const control = aimed?.closest(PRESSABLE)
    if (!control || !el.contains(control)) return
    event.preventDefault()
    event.stopPropagation()
    pending.press = pathTo(el, control)
  }

  const onChange = (event: Event) => {
    const menu = event.target
    if (!(menu instanceof HTMLSelectElement)) return
    const path = pathTo(el, menu)
    if (!path) return
    pending.changes = pending.changes.filter((change) => change.path.join() !== path.join())
    pending.changes.push({ path, value: menu.value })
  }

  const scope: Document | HTMLElement = trigger ? doc : el
  for (const type of INTENT_EVENTS)
    scope.addEventListener(type, onIntentEvent, { capture: true, passive: true })
  if (!trigger) {
    el.addEventListener('click', onClick, true)
    el.addEventListener('change', onChange, true)
  }

  return {
    finish() {
      for (const type of INTENT_EVENTS) scope.removeEventListener(type, onIntentEvent, true)
      if (!trigger) {
        el.removeEventListener('click', onClick, true)
        el.removeEventListener('change', onChange, true)
      }
      return pending
    },
  }
}

/**
 * Sets a menu's value the way choosing does, so a controlled React `<select>`
 * sees it: through the prototype's setter (React's value tracker wraps the
 * instance's), then a `change` event, which React's `onChange` listens for.
 */
function chooseValue(menu: HTMLSelectElement, value: string): void {
  Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set?.call(menu, value)
  menu.dispatchEvent(new Event('change', { bubbles: true }))
}

/**
 * Plays `pending` back on the island in `el`, now that it listens: focus
 * first (a press on a control focuses it), then the menus, then the press,
 * then the trigger's hover or focus, re-announced for a host that missed it.
 */
export function replayInteraction(el: HTMLElement, pending: PendingInteraction): void {
  const doc = el.ownerDocument
  const active = doc.activeElement
  const dropped = !active || active === doc.body
  if (pending.focus && dropped) {
    const control = elementAt(el, pending.focus)
    if (control instanceof HTMLElement) control.focus({ preventScroll: true })
  }
  for (const { path, value } of pending.changes) {
    const menu = elementAt(el, path)
    if (menu instanceof HTMLSelectElement && menu.value !== value) chooseValue(menu, value)
  }
  if (pending.press) {
    const control = elementAt(el, pending.press)
    if (control instanceof HTMLElement) control.click()
  }
  const target = pending.trigger
  if (!target?.isConnected) return
  if (target.matches(':hover')) {
    target.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' }))
  }
  if (target === doc.activeElement || target.contains(doc.activeElement)) {
    ;(doc.activeElement ?? target).dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
  }
}
