import type { OgCardProps } from 'component-lib'
import { OgCard } from 'component-lib'
import { useQuery } from 'convex/react'
import type { CSSProperties } from 'react'
import { useEffect } from 'react'
import { api } from '../../../convex/_generated/api'
import { fullSheetCard } from '../../lib/linkPreview/previewStats'
import type { PreviewKind } from '../../lib/linkPreview/previewSummary'
import { inviteCard, isPreviewKind, privateCard } from '../../lib/linkPreview/previewSummary'

/**
 * The render surface a player thing's link preview is screenshotted from
 * (issue 1280): `/og/$kind/$id`, `/og/invite/$code` and `/og/private`.
 *
 * The Worker's picture route (`src/worker/linkPreview.ts`) points Cloudflare
 * Browser Rendering here at 1200 × 630 and waits for `data-og-ready` on
 * `<html>`, which this sets once the card, its data and its fonts are in. It
 * draws `OgCard` — the same parts as the page — from the same public answers
 * the Worker's words come from, so the picture and the text beside it agree.
 *
 * It asks the same queries a stranger would (`publicSheet.preview`,
 * `publicSheet.invitePreview`), so it can never draw more than the page
 * would show one. The root renders it without the app's chrome.
 */

/** The card, pinned to the viewport's top-left at its own size. */
const FRAME = { inset: 0, position: 'fixed' } satisfies CSSProperties

/** The address the card's foot prints: this origin's host, and the page's path. */
function host(): string {
  return typeof window === 'undefined' ? '' : window.location.host
}

/** Draw the card, then tell the screenshotter it is ready. */
function Ready({ card }: { card: OgCardProps }) {
  useEffect(() => {
    let live = true
    const root = document.documentElement
    void Promise.all([
      // `document.fonts` is absent outside a real browser (the test DOM).
      document.fonts?.ready,
      ...Array.from(document.querySelectorAll<HTMLImageElement>('[data-og-card] img')).map((img) =>
        img.decode().catch(() => undefined)
      ),
    ]).then(() => {
      if (live) root.setAttribute('data-og-ready', '')
    })
    return () => {
      live = false
      root.removeAttribute('data-og-ready')
    }
  }, [])
  return (
    <div style={FRAME}>
      <OgCard {...card} />
    </div>
  )
}

function SheetSurface({ kind, id }: { kind: PreviewKind; id: string }) {
  const answer = useQuery(api.publicSheet.preview, { kind, appId: id })
  if (answer === undefined) return null
  const card =
    answer === null
      ? privateCard(host())
      : fullSheetCard({ ...answer, kind: answer.kind }, `${host()}/p/${kind}/${id}`)
  return <Ready card={card} />
}

function InviteSurface({ code }: { code: string }) {
  const answer = useQuery(api.publicSheet.invitePreview, { code })
  if (answer === undefined || answer === null) return null
  return <Ready card={inviteCard(answer, host())} />
}

export function LinkPreviewSurface({ kind, id }: { kind: string; id?: string }) {
  if (kind === 'invite' && id) return <InviteSurface code={id} />
  if (isPreviewKind(kind) && id) return <SheetSurface kind={kind} id={id} />
  return <Ready card={privateCard(host())} />
}
