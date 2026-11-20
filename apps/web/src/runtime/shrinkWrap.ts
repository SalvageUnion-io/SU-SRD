/**
 * Fits a cut-out's paper to its words. A wrapped paragraph's box keeps the
 * width it was offered even when its lines (balanced by `text-wrap`) are
 * shorter; this measures each line's box and sets the paper to the longest,
 * so no cut-out stands wider than its text. Re-measured on resize: the width
 * is let go first, so the text wraps at the room it has, then fitted again.
 */
export function shrinkWrap(root: ParentNode, selector: string): void {
  const boxes = [...root.querySelectorAll<HTMLElement>(selector)]
  if (boxes.length === 0) return
  const fit = () => {
    for (const box of boxes) {
      box.style.removeProperty('inline-size')
      const range = document.createRange()
      range.selectNodeContents(box)
      const lines = [...range.getClientRects()]
      if (lines.length === 0) continue
      const widest = Math.max(...lines.map((line) => line.width))
      const style = getComputedStyle(box)
      const inset = Number.parseFloat(style.paddingLeft) + Number.parseFloat(style.paddingRight)
      box.style.setProperty('inline-size', `${Math.ceil(widest + inset)}px`)
    }
  }
  fit()
  let frame = 0
  window.addEventListener('resize', () => {
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(fit)
  })
}
