import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { capsLabel, cn } from '../../components/index'
import { widthAtLeast } from '../../design/tokens'

/** The acts read in caps, as the rail's links do (ruleset §3.12). */
const CAPS = capsLabel({ weight: 'inherit', tracking: 'inherit' })

/**
 * A page's acts (Read | Edit | Play, Share, ⋯) ride
 * the area rail, right-aligned on the line of its links, in the links' own
 * style. Where there is no rail (under 64rem it is the drawer) they stay
 * where they were, the first row of the band, in the same plain style.
 *
 * A portal into the rail's slot (`AppBar`'s `[data-rail-acts]`): the acts keep
 * their handlers and state, only their place changes.
 */
const RAIL_QUERY = widthAtLeast('lg')

function findSlot(): HTMLElement | null {
  for (const slot of document.querySelectorAll<HTMLElement>('[data-rail-acts]')) {
    // Three rails are served, one shows: its slot has a box.
    if (slot.offsetParent !== null) return slot
  }
  return null
}

export function RailActs({ children }: { children: ReactNode }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null)

  useEffect(() => {
    const media = window.matchMedia(RAIL_QUERY)
    let frame = 0
    let tries = 0
    const place = () => {
      const found = media.matches ? findSlot() : null
      setSlot(found)
      // The bar can mount after the page: look again for a moment.
      if (media.matches && !found && tries < 60) {
        tries += 1
        frame = requestAnimationFrame(place)
      }
    }
    place()
    media.addEventListener('change', place)
    // The bar shows the rail of its `data-mode`, and that can change under an
    // open page (a pilot found to be in a Game reads under Play): follow it,
    // or the acts stay in a rail that no longer shows.
    const area = new MutationObserver(() => {
      tries = 0
      place()
    })
    area.observe(document.body, { attributes: true, attributeFilter: ['data-mode'], subtree: true })
    return () => {
      cancelAnimationFrame(frame)
      media.removeEventListener('change', place)
      area.disconnect()
    }
  }, [])

  const acts = <div className={cn('su-rail-acts', CAPS)}>{children}</div>
  return slot ? createPortal(acts, slot) : acts
}
