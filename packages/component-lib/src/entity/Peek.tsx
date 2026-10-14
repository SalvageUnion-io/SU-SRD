import { lazy, Suspense, useCallback, useEffect, useId, useRef, useState } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { PEEK_DOWN_ATTRIBUTE, parsePeekAddress } from './peekContext'
import { installPeekController } from './peekController'

/** The popup, the card inside it and the data it reads load on the first Peek. */
const PeekPopup = lazy(() => import('./PeekPopup').then((m) => ({ default: m.PeekPopup })))

/** Make one schema readable. The default loads exactly that schema. */
export type PeekLoader = (schemaName: string) => Promise<void>

const loadOneSchema: PeekLoader = (schemaName) => SalvageUnionReference.preload([schemaName])

type Active = { anchor: HTMLElement; schemaName: string; id: string; down: boolean }

/** Only the first host on a page listens; a second would open every Peek twice. */
let hostMounted = false

/**
 * PEEK HOST — the page's one Peek (entity display language E4, E16): a
 * compact, read-only Card of the entity a Mention or a Tag names, shown on
 * hover, keyboard focus or a long press, hidden on leave, blur or Escape.
 *
 * Triggers carry only their entity's address (`data-peek`, set by `Mention`
 * and `Tags`), and this host listens for them on the whole document. So a
 * trigger costs one attribute, a server-rendered page Peeks as well as a live
 * one, and a Peek can never open inside a Peek: the popup's triggers are inert
 * and the host ignores anything inside the popup.
 *
 * Nothing loads until the first Peek: the popup and its card are a lazy chunk,
 * and the entity's schema is read through `load` (one schema by default; the
 * SRD passes the schemas its card reads). The trigger is described by the
 * popup while it is open (`aria-describedby`); focus never moves into it.
 *
 * Mount one per app, at its root (ITUN), or as a page island (the SRD).
 */
export function PeekHost({ load = loadOneSchema }: { load?: PeekLoader }) {
  const [active, setActive] = useState<Active | null>(null)
  const popupId = `peek-${useId().replace(/:/g, '')}`
  const controller = useRef<ReturnType<typeof installPeekController> | null>(null)

  useEffect(() => {
    if (hostMounted) return
    hostMounted = true
    controller.current = installPeekController(document, {
      open: (anchor, address) => {
        const target = parsePeekAddress(address)
        const down = anchor.hasAttribute(PEEK_DOWN_ATTRIBUTE)
        setActive(target ? { anchor, ...target, down } : null)
      },
      close: () => setActive(null),
    })
    return () => {
      controller.current?.uninstall()
      controller.current = null
      hostMounted = false
    }
  }, [])

  // The open trigger is DESCRIBED by the popup, for as long as it is open.
  useEffect(() => {
    if (!active) return
    const { anchor } = active
    const before = anchor.getAttribute('aria-describedby')
    anchor.setAttribute('aria-describedby', before ? `${before} ${popupId}` : popupId)
    return () => {
      if (before === null) anchor.removeAttribute('aria-describedby')
      else anchor.setAttribute('aria-describedby', before)
    }
  }, [active, popupId])

  const dismiss = useCallback(() => controller.current?.close(), [])

  if (!active) return null
  return (
    <Suspense fallback={null}>
      <PeekPopup
        // Another entity is another popup: its load starts over.
        key={`${active.schemaName}:${active.id}:${active.down}`}
        id={popupId}
        anchor={active.anchor}
        schemaName={active.schemaName}
        entityId={active.id}
        down={active.down}
        load={load}
        onDismiss={dismiss}
      />
    </Suspense>
  )
}
