/**
 * The Peek's TRIGGER BEHAVIOUR, as plain DOM listeners on the document: which
 * element is peeked, and when. It knows nothing of React or of entities, so one
 * host serves every trigger on the page, server-rendered ones included.
 *
 * - Hover (a mouse or a pen): opens after a short rest, closes shortly after
 *   the pointer leaves both the trigger and the popup (so the pointer can
 *   cross into the popup and read it). Only a pointer that moved onto the
 *   trigger: content that scrolls or swaps in under a resting pointer opens
 *   nothing until the pointer moves (RR7-06, LG7-12).
 * - Keyboard focus: opens at once; blur closes. Focus that a pointer press
 *   gave does not (the press is a click: it follows the link), nor, on a
 *   screen with no hover, a list's row name's: there a tap on the name opens
 *   its page, always (r8 G4).
 * - Touch: a long press opens it and swallows the click and the callout the
 *   press would otherwise make; a tap elsewhere closes it.
 * - A press on a button marked `data-peek-press`, which does nothing else,
 *   opens it at once. A press on a link always follows the link, however
 *   soon (E27): a reference term's Peek is hover's and focus's. Touch has no
 *   hover, so there a tap on a term (a link marked `data-peek-press`)
 *   explains it in place: its Peek opens, Open page on it (r5 E4).
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
/** Focus this soon after a pointer press came from the press. */
const POINTER_FOCUS_WINDOW = 600

/** How a Peek was opened: a rest of the pointer, the keyboard's focus, or a press (a tap, a long press). */
export type PeekOpening = 'hover' | 'focus' | 'press'

export type PeekControllerCallbacks = {
  open: (trigger: HTMLElement, address: string, how: PeekOpening) => void
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

/** A list's row (a Ledger's): on a phone its name opens its page (r8 G4). */
const LIST_ROW = '.su-ledger__table tr'

/** A screen read by touch alone, with no hover. */
function noHover(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(hover: none)').matches
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
  /** The last press was a finger's: a tap on a term explains it rather than leaving. */
  let touched = false
  /** Where the pointer last moved to; unknown until it moves on this page. */
  let pointer: { x: number; y: number } | undefined
  /** A trigger that came under a resting pointer: it waits for the pointer to move. */
  let resting: HTMLElement | null = null

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

  const openNow = (trigger: HTMLElement, how: PeekOpening) => {
    clearOpen()
    clearClose()
    const address = trigger.getAttribute(PEEK_ATTRIBUTE)
    if (!address) return
    current = trigger
    callbacks.open(trigger, address, how)
  }
  const closeNow = () => {
    clearOpen()
    clearClose()
    if (!current) return
    current = null
    callbacks.close()
  }
  const scheduleClose = () => {
    if (!current || closeTimer) return
    closeTimer = setTimeout(closeNow, PEEK_CLOSE_DELAY)
  }

  /**
   * Whether the pointer is somewhere it was not when it last moved: a
   * boundary event at the same place came from the page moving under it. A
   * pointer not yet seen to move on this page counts as moving.
   */
  const moved = (event: PointerEvent) =>
    !pointer || pointer.x !== event.clientX || pointer.y !== event.clientY

  const armHover = (trigger: HTMLElement) => {
    resting = null
    if (trigger === pending) return
    clearOpen()
    pending = trigger
    openTimer = setTimeout(() => openNow(trigger, 'hover'), PEEK_OPEN_DELAY)
  }

  const onPointerOver = (event: PointerEvent) => {
    if (event.pointerType === 'touch') return
    const hasMoved = moved(event)
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
    // Brought under a still pointer (a scroll, a new screen): wait for a move.
    if (!hasMoved) {
      resting = trigger
      return
    }
    armHover(trigger)
  }

  const onPointerOut = (event: PointerEvent) => {
    if (event.pointerType === 'touch') return
    const to = event.relatedTarget
    const from = triggerOf(event.target)
    // Still within the same trigger, or crossing into the popup.
    if (from && elementOf(to) && from.contains(elementOf(to))) return
    if (insidePopup(to)) return
    if (from && from === resting) resting = null
    if (from && from === pending) clearOpen()
    if (from === current || insidePopup(event.target)) scheduleClose()
  }

  const onFocusIn = (event: FocusEvent) => {
    const trigger = triggerOf(event.target)
    if (!trigger) return
    if (performance.now() - lastPress < POINTER_FOCUS_WINDOW) return
    // A tap the controller never saw (it mounted under the finger) still opens the page.
    if (trigger.closest(LIST_ROW) && noHover()) return
    openNow(trigger, 'focus')
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
    touched = event.pointerType === 'touch'
    const trigger = triggerOf(event.target)
    if (current && !insidePopup(event.target) && trigger !== current) closeNow()
    if (event.pointerType !== 'touch' || !trigger) return
    clearPress()
    pressAt = { x: event.clientX, y: event.clientY }
    pressTimer = setTimeout(() => {
      pressTimer = undefined
      swallowClick = true
      openNow(trigger, 'press')
    }, PEEK_LONG_PRESS)
  }

  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerType !== 'touch') {
      pointer = { x: event.clientX, y: event.clientY }
      // The pointer moved on a trigger that came under it at rest: now it hovers.
      if (resting && triggerOf(event.target) === resting) armHover(resting)
      else resting = null
    }
    if (!pressAt) return
    if (Math.hypot(event.clientX - pressAt.x, event.clientY - pressAt.y) > PRESS_SLOP) clearPress()
  }

  const onPointerEnd = () => clearPress()

  const onClick = (event: MouseEvent) => {
    if (!swallowClick) {
      const trigger = triggerOf(event.target)
      if (!trigger?.hasAttribute(PEEK_PRESS_ATTRIBUTE)) return
      // A link is followed, never held (E27): a click costs one click.
      // Its Peek, open or on its way, goes: the reader is leaving for the page.
      // A finger's tap explains the term in place instead, Open page on its
      // Peek (r5 E4): touch has no hover to Peek it by.
      if (trigger instanceof HTMLAnchorElement && trigger.hasAttribute('href')) {
        if (!touched) {
          closeNow()
          return
        }
        event.preventDefault()
        event.stopPropagation()
      }
      // A trigger whose press does nothing else opens its Peek.
      openNow(trigger, 'press')
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
