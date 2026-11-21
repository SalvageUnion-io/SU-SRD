/**
 * The Peek's TRIGGER BEHAVIOUR, as plain DOM listeners on the document: which
 * element is peeked, and when. It knows nothing of React or of entities, so one
 * host serves every trigger on the page, server-rendered ones included.
 *
 * - Hover (a mouse or a pen): opens after a short rest, closes shortly after
 *   the pointer leaves both the trigger and the popup (so the pointer can
 *   cross into the popup and read it).
 * - Keyboard focus: opens at once; blur closes. Focus that a pointer press
 *   gave does not (the press is a click: it follows the link).
 * - Touch: a long press opens it and swallows the click and the callout the
 *   press would otherwise make; a tap elsewhere closes it.
 * - A press on a trigger marked `data-peek-press` opens it at once: a button
 *   that does nothing else, and a reference term that links to its entry
 *   (E27). The term's link is not followed by that press; the next press on
 *   it (the Peek now open), a modified press or the keyboard's Enter follows it.
 * - Escape closes it, and only it: the dialog or page under it stays.
 *
 * A trigger inside the popup never peeks (E16: a Peek is terminal).
 */

import { PEEK_ATTRIBUTE, PEEK_PRESS_ATTRIBUTE } from './peekContext'

/** The attribute the popup carries, so the controller can tell inside from out. */
export const PEEK_POPUP_ATTRIBUTE = 'data-peek-popup'

const PEEK_OPEN_DELAY = 300
const PEEK_CLOSE_DELAY = 150
const PEEK_LONG_PRESS = 500
/** A press that travels further than this is a scroll, not a long press. */
const PRESS_SLOP = 10
/** A press this soon after its trigger's Peek closed was made on the open Peek. */
const PRESS_ON_OPEN_WINDOW = 700
/** Focus this soon after a pointer press came from the press. */
const POINTER_FOCUS_WINDOW = 600

export type PeekControllerCallbacks = {
  open: (trigger: HTMLElement, address: string) => void
  close: () => void
}

function elementOf(target: EventTarget | null): Element | null {
  return target instanceof Element ? target : null
}

function insidePopup(target: EventTarget | null): boolean {
  return !!elementOf(target)?.closest(`[${PEEK_POPUP_ATTRIBUTE}]`)
}

/** The trigger an event landed in, unless it landed inside the popup. */
function triggerOf(target: EventTarget | null): HTMLElement | null {
  const element = elementOf(target)
  if (!element || insidePopup(element)) return null
  const trigger = element.closest(`[${PEEK_ATTRIBUTE}]`)
  return trigger instanceof HTMLElement ? trigger : null
}

/** Install the listeners on `doc`; returns the uninstaller. */
export function installPeekController(doc: Document, callbacks: PeekControllerCallbacks) {
  let current: HTMLElement | null = null
  let pending: HTMLElement | null = null
  let openTimer: ReturnType<typeof setTimeout> | undefined
  let closeTimer: ReturnType<typeof setTimeout> | undefined
  let pressTimer: ReturnType<typeof setTimeout> | undefined
  let pressAt: { x: number; y: number } | undefined
  let swallowClick = false
  let lastPress = Number.NEGATIVE_INFINITY
  // The trigger whose Peek last closed, and when: a press on an open Peek's
  // term can close the Peek (the popup's own outside-press) before its click.
  let closed: { trigger: HTMLElement; at: number } | undefined

  const clearOpen = () => {
    clearTimeout(openTimer)
    openTimer = undefined
    pending = null
  }
  const clearClose = () => {
    clearTimeout(closeTimer)
    closeTimer = undefined
  }
  const clearPress = () => {
    clearTimeout(pressTimer)
    pressTimer = undefined
    pressAt = undefined
  }

  const openNow = (trigger: HTMLElement) => {
    clearOpen()
    clearClose()
    const address = trigger.getAttribute(PEEK_ATTRIBUTE)
    if (!address) return
    current = trigger
    callbacks.open(trigger, address)
  }
  const closeNow = () => {
    clearOpen()
    clearClose()
    if (!current) return
    closed = { trigger: current, at: performance.now() }
    current = null
    callbacks.close()
  }
  const scheduleClose = () => {
    if (!current || closeTimer) return
    closeTimer = setTimeout(closeNow, PEEK_CLOSE_DELAY)
  }

  const onPointerOver = (event: PointerEvent) => {
    if (event.pointerType === 'touch') return
    if (insidePopup(event.target)) {
      clearClose()
      return
    }
    const trigger = triggerOf(event.target)
    if (!trigger) return
    if (trigger === current) {
      clearClose()
      return
    }
    if (trigger === pending) return
    clearOpen()
    pending = trigger
    openTimer = setTimeout(() => openNow(trigger), PEEK_OPEN_DELAY)
  }

  const onPointerOut = (event: PointerEvent) => {
    if (event.pointerType === 'touch') return
    const to = event.relatedTarget
    const from = triggerOf(event.target)
    // Still within the same trigger, or crossing into the popup.
    if (from && elementOf(to) && from.contains(elementOf(to))) return
    if (insidePopup(to)) return
    if (from && from === pending) clearOpen()
    if (from === current || insidePopup(event.target)) scheduleClose()
  }

  const onFocusIn = (event: FocusEvent) => {
    const trigger = triggerOf(event.target)
    if (!trigger) return
    if (performance.now() - lastPress < POINTER_FOCUS_WINDOW) return
    openNow(trigger)
  }

  const onFocusOut = (event: FocusEvent) => {
    if (current && event.target === current) scheduleClose()
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || !current) return
    // The Peek is the topmost thing: Escape dismisses it and nothing beneath.
    event.stopPropagation()
    closeNow()
  }

  const onPointerDown = (event: PointerEvent) => {
    lastPress = performance.now()
    swallowClick = false
    const trigger = triggerOf(event.target)
    if (current && !insidePopup(event.target) && trigger !== current) closeNow()
    if (event.pointerType !== 'touch' || !trigger) return
    clearPress()
    pressAt = { x: event.clientX, y: event.clientY }
    pressTimer = setTimeout(() => {
      pressTimer = undefined
      swallowClick = true
      openNow(trigger)
    }, PEEK_LONG_PRESS)
  }

  const onPointerMove = (event: PointerEvent) => {
    if (!pressAt) return
    if (Math.hypot(event.clientX - pressAt.x, event.clientY - pressAt.y) > PRESS_SLOP) clearPress()
  }

  const onPointerEnd = () => clearPress()

  const onClick = (event: MouseEvent) => {
    if (!swallowClick) {
      const trigger = triggerOf(event.target)
      if (!trigger?.hasAttribute(PEEK_PRESS_ATTRIBUTE)) return
      if (trigger instanceof HTMLAnchorElement && trigger.hasAttribute('href')) {
        // A term's link (E27). Its Peek already open (hover, focus, an earlier
        // press), or a press that asks for a new tab or window: the link's.
        const modified = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
        const wasOpen =
          trigger === current ||
          (closed?.trigger === trigger && performance.now() - closed.at < PRESS_ON_OPEN_WINDOW)
        if (wasOpen || event.button !== 0 || modified) return
        event.preventDefault()
        event.stopPropagation()
      }
      // A trigger whose press does nothing else opens its Peek.
      openNow(trigger)
      return
    }
    // The long press opened the Peek: the click it ends with must not follow
    // the link as well.
    swallowClick = false
    event.preventDefault()
    event.stopPropagation()
  }

  const onContextMenu = (event: MouseEvent) => {
    if ((pressTimer || swallowClick) && triggerOf(event.target)) event.preventDefault()
  }

  const listeners: [string, EventListener, boolean][] = [
    ['pointerover', onPointerOver as EventListener, false],
    ['pointerout', onPointerOut as EventListener, false],
    ['focusin', onFocusIn as EventListener, false],
    ['focusout', onFocusOut as EventListener, false],
    ['keydown', onKeyDown as EventListener, true],
    ['pointerdown', onPointerDown as EventListener, true],
    ['pointermove', onPointerMove as EventListener, true],
    ['pointerup', onPointerEnd, true],
    ['pointercancel', onPointerEnd, true],
    ['click', onClick as EventListener, true],
    ['contextmenu', onContextMenu as EventListener, true],
  ]
  for (const [type, listener, capture] of listeners) doc.addEventListener(type, listener, capture)

  return {
    /** Close it now (the popup's own dismissal, a route change). */
    close: closeNow,
    uninstall: () => {
      clearOpen()
      clearClose()
      clearPress()
      for (const [type, listener, capture] of listeners) {
        doc.removeEventListener(type, listener, capture)
      }
    },
  }
}
