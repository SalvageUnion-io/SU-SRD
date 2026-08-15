/**
 * PublicSheetPanel — turn one sheet into a public, always-current page
 * ([ADR-032](../../../../../docs/adrs/ADR-032-public-read-only-sheets.md)).
 *
 * Sits below the snapshot section in `ShareStatusDialog` because the two answer
 * different questions and a player choosing between them should see both:
 * a snapshot is a **frozen** copy of this build, and this is a **live** view
 * that follows the sheet as it changes.
 *
 * Connected-only, and the gate lives in the PARENT rather than here. That is
 * not a style choice: this component calls `useQuery`/`useMutation`, which
 * cannot be called conditionally (Rules of Hooks) and throw outright without a
 * Convex provider — which is exactly the situation in Solo, and in every test
 * that renders the share dialog. Returning null from inside would therefore
 * still have run the hooks and still have thrown. The parent not mounting it is
 * the only correct shape.
 *
 * `publicRead` is a Convex column, so a Solo player has no server row to
 * publish and the panel is absent rather than present and broken — which is how
 * every other account-shaped surface in the app behaves.
 *
 * The copy is deliberately blunt about what publishing means. "Share" would
 * undersell it: a published pilot's callsign, pronouns, motto, keepsake,
 * appearance and background become readable by anyone with the link, and the
 * person deciding should be told that rather than left to infer it.
 */

import { Button, FieldError } from 'component-lib'
import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { isServerRefusal, serverMessage } from '../../lib/connection/serverError'

type PublicSheetPanelProps = {
  kind: 'pilot' | 'mech' | 'crawler'
  /** The app-level entity id — what the public route is addressed by. */
  appId: string
  entityName: string
  headingClass?: string
}

export function PublicSheetPanel({ kind, appId, entityName, headingClass }: PublicSheetPanelProps) {
  const setPublic = useMutation(api.publicSheet.setPublic)
  const published = useQuery(api.publicSheet.get, { kind, appId })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // `undefined` is still loading; `null` is a real "not published".
  const isPublic = published === undefined ? null : published !== null
  const url = typeof window === 'undefined' ? '' : `${window.location.origin}/p/${kind}/${appId}`

  async function toggle(next: boolean): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      await setPublic({ kind, appId, isPublic: next })
    } catch (err) {
      // Server refusals carry a message meant for the player; anything else
      // does not, and rendering String(err) would leak a redacted stack.
      setError(isServerRefusal(err) ? serverMessage(err) : 'That could not be saved. Try again.')
    } finally {
      setBusy(false)
    }
  }

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Could not copy. Select the link and copy it manually.')
    }
  }

  return (
    // A plain section, not a Panel. Its one consumer is ShareStatusDialog,
    // which is already inside ModalShell's Card — a Panel here would be a
    // border inside a border. It kept the Panel while it sat on the share
    // screen's bare grid, where the frame was the only thing separating it.
    <section>
      <h2 className={headingClass}>Public sheet</h2>

      <p className="text-wk-muted mb-3 font-body text-caption leading-relaxed">
        {isPublic === true ? (
          <>
            Anyone with this link can read {entityName}, with no account. It stays current as you
            play. Turning it off takes effect immediately, everywhere.
          </>
        ) : (
          <>
            Publish {entityName} to a page anyone can read without an account. Unlike a snapshot it
            stays current as you play — and everything on the sheet, including bio and appearance
            text, becomes readable by anyone with the link.
          </>
        )}
      </p>

      {isPublic === true && (
        <div className="mb-3 flex items-center gap-2">
          <code className="text-wk-muted min-w-0 flex-1 truncate font-body text-caption">
            {url}
          </code>
          <Button size="compact" onClick={() => void copy()} aria-label="Copy public sheet link">
            {copied ? '✓' : '⧉'}
          </Button>
        </div>
      )}

      <Button
        size="compact"
        variant={isPublic === true ? 'ghost' : 'default'}
        disabled={busy || isPublic === null}
        onClick={() => void toggle(isPublic !== true)}
      >
        {isPublic === null ? 'Checking…' : isPublic ? 'Stop sharing' : 'Publish public sheet'}
      </Button>

      {error !== null && <FieldError className="mt-2">{error}</FieldError>}
    </section>
  )
}
