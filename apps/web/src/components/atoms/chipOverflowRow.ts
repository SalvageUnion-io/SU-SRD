/**
 * A contentful head's overflow row (C2b; `chipFill.ts`): the copies of what
 * left its head, laid as its body's first row, their buttons pressing the
 * head's own.
 */

/** What each overflow row last drew: the items it copies, so an unchanged fit writes nothing. */
const drawnRow = new WeakMap<HTMLElement, { items: readonly HTMLElement[]; said: string }>()

/** The attributes a fit writes on an item, cleared from its copy. */
const FIT_ATTRIBUTES = ['data-fill-item', 'data-fill-line', 'data-fill-corner', 'data-fill-out']

/**
 * Lay what left a contentful head in its body's first row (C2b): a copy of
 * each item that is out, in class order, each in a lane of its class (C2a),
 * so the row reads as a strip of its own; hidden while nothing is out. The
 * copies carry no ids, and nothing a fit wrote: what they link or Peek is
 * the document's (a link, the Peek's attributes), so they work as the chip.
 */
export function writeOverflowRow(row: HTMLElement, out: readonly HTMLElement[]): void {
  const drawn = drawnRow.get(row)
  // A stepped value reads anew: the same items, their text changed.
  const said = out.map((item) => item.textContent ?? '').join('\u0000')
  if (
    drawn &&
    drawn.said === said &&
    drawn.items.length === out.length &&
    drawn.items.every((item, i) => item === out[i])
  ) {
    row.hidden = out.length === 0
    return
  }
  drawnRow.set(row, { items: [...out], said })
  const lanes: HTMLElement[] = []
  for (const item of out) {
    const cls = item.closest('[data-chip-class]')?.getAttribute('data-chip-class') ?? ''
    let lane = lanes[lanes.length - 1]
    if (!lane || lane.getAttribute('data-chip-class') !== cls) {
      lane = document.createElement('span')
      lane.className = 'su-chip-lane'
      lane.setAttribute('data-chip-class', cls)
      lanes.push(lane)
    }
    const copy = item.cloneNode(true) as HTMLElement
    for (const el of [copy, ...copy.querySelectorAll<HTMLElement>('*')]) {
      el.removeAttribute('id')
      for (const attr of FIT_ATTRIBUTES) el.removeAttribute(attr)
      el.style?.removeProperty('--su-fill')
      el.style?.removeProperty('--su-corner-max')
    }
    forwardClicks(copy, item)
    lane.append(copy)
  }
  row.replaceChildren(...lanes)
  row.hidden = out.length === 0
}

/**
 * A copy's buttons press the item's own (`forwards`): its handlers are the
 * item's, which the copy cannot carry, and the item re-renders its value,
 * which the next fit copies again.
 */
function forwardClicks(copy: HTMLElement, item: HTMLElement): void {
  const own = [...(item.matches('button') ? [item] : []), ...item.querySelectorAll('button')]
  if (own.length === 0) return
  const copies = [...(copy.matches('button') ? [copy] : []), ...copy.querySelectorAll('button')]
  copy.addEventListener('click', (event) => {
    const pressed = (event.target as Element | null)?.closest('button')
    const index = pressed ? copies.indexOf(pressed) : -1
    if (index < 0) return
    event.preventDefault()
    ;(own[index] as HTMLButtonElement | undefined)?.click()
  })
}
