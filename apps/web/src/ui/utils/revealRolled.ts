/**
 * Whether `el` is wholly on screen: inside the viewport and inside every
 * ancestor that clips it (a scrolling panel, a phone frame).
 */
function whollyVisible(el: Element): boolean {
  const box = el.getBoundingClientRect()
  let top = 0
  let bottom = window.innerHeight
  // The body and root scroll the viewport itself, already counted.
  for (let at = el.parentElement; at && at !== document.body; at = at.parentElement) {
    if (getComputedStyle(at).overflowY === 'visible') continue
    const clip = at.getBoundingClientRect()
    top = Math.max(top, clip.top)
    bottom = Math.min(bottom, clip.bottom)
  }
  return box.top >= top && box.bottom <= bottom
}

function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/**
 * Bring a roll's result (the marked row or cell) to the reader, wherever it
 * is on the page: centred, and only when some of it is off screen. Smooth,
 * or instant for a reader who prefers reduced motion. Focus stays where it
 * is, on the Roll, so a keyboard reader can roll again at once.
 */
export function revealRolled(el: Element | null | undefined): void {
  if (!el || typeof el.scrollIntoView !== 'function' || whollyVisible(el)) return
  el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' })
}
