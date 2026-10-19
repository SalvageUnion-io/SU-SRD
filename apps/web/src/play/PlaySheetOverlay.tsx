/**
 * PlaySheetOverlay — what "Sheet ⤢" on a unit box opens (play.md §4): that
 * unit's live sheet as an overlay over Play, so play is one press away when
 * it closes. The sheet is the sheet route's own body (`SheetView`): yours to
 * edit with its Read | Edit band, a crewmate's or a Game crawler you do not
 * run read-only, exactly as at `/sheet/$kind/$id`.
 *
 * A full-screen `ModalShell` (level 0, a frame of its own: play.md §12),
 * portalled to the page rather than into the scaled canvas, so the sheet lays
 * out at the page's size. Base UI traps focus in it, closes it on Escape and
 * hands focus back to the button that opened it. The sheet names the tab
 * after its unit; the Play title comes back when the overlay closes. It is a
 * Live Sheet, not Play, so it wears the sheet's texture back over Play's flat
 * surface.
 */

import type { SheetKind } from 'game-domain/entityKinds'
import type { CSSProperties } from 'react'
import { useEffect } from 'react'
import { SheetView } from '../build/sheet/SheetView'
import { capsLabel } from '../components/atoms/capsLabel'
import { CloseButton, EntitySurfaceProvider, ModalShell, tokens } from '../components/index'

const FRAME = {
  background: 'var(--color-wk-bg)',
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  minHeight: 0,
} satisfies CSSProperties

const HEAD = {
  alignItems: 'center',
  background: 'var(--color-band-cream)',
  display: 'flex',
  flexShrink: 0,
  gap: tokens.space[10],
  padding: `${tokens.space[6]} ${tokens.space[12]}`,
} satisfies CSSProperties

const TITLE = {
  flex: '1 1 0%',
  margin: 0,
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
} satisfies CSSProperties
const TITLE_CAPS = capsLabel({ size: 'readout' })

const BODY = { flex: '1 1 0%', minHeight: 0, overflowY: 'auto' } satisfies CSSProperties

/** The sheet's own materials over Play's flat surface (ruleset §3.5.1). */
const TEXTURED = { texture: true } as const

/** The unit an overlay shows: its kind, its id and its name for the title. */
export type SheetTarget = { kind: SheetKind; id: string; name: string }

export function PlaySheetOverlay({
  sheet,
  onClose,
}: {
  /** The unit whose sheet is open, or null when the overlay is shut. */
  sheet: SheetTarget | null
  onClose: () => void
}) {
  const open = sheet !== null
  // The sheet renames the tab after its unit; give Play's title back on close.
  useEffect(() => {
    if (!open) return
    const title = document.title
    return () => {
      document.title = title
    }
  }, [open])

  return (
    <ModalShell
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      title={sheet ? `${sheet.name} sheet` : 'Sheet'}
      fullscreen
      bare
    >
      {sheet ? (
        <div style={FRAME}>
          <div style={HEAD}>
            <h2 className={TITLE_CAPS} style={TITLE}>
              {sheet.name}
            </h2>
            <CloseButton label="Back to Play" onClick={onClose} />
          </div>
          <div style={BODY}>
            <EntitySurfaceProvider value={TEXTURED}>
              <SheetView kind={sheet.kind} id={sheet.id} />
            </EntitySurfaceProvider>
          </div>
        </div>
      ) : null}
    </ModalShell>
  )
}
