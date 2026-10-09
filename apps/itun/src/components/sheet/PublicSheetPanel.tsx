/**
 * PublicSheetPanel — turn one sheet into a public, always-current page
 * ([ADR-032](../../../../../docs/ARCHITECTURE.md#adr-032)).
 *
 * The whole of sharing
 * ([ADR-036](../../../../../docs/ARCHITECTURE.md#adr-036)): this live,
 * read-only page is the only account-free way to hand somebody a sheet — a
 * toggle, the `/p/:kind/:appId` link, a copy button and a QR of it.
 *
 * It is headed **"Live public sheet"**, and the first word still earns its
 * place: the page follows the sheet as it changes, which is what a reader
 * needs to know about a link somebody sent them.
 *
 * Connected-only, and the gate lives in the PARENT rather than here: this
 * component calls `useQuery`/`useMutation`, which cannot be called
 * conditionally (Rules of Hooks), so returning null from inside would still
 * run them.
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
import { LinkQr } from './LinkQr'

type PublicSheetPanelProps = {
  kind: 'pilot' | 'mech' | 'crawler'
  /** The app-level entity id — what the public route is addressed by. */
  appId: string
  entityName: string
  headingClass?: string
  /** Injectable clipboard writer for testing. */
  clipboardWriter?: (text: string) => Promise<void>
}

export function PublicSheetPanel({
  kind,
  appId,
  entityName,
  headingClass,
  clipboardWriter = (text) => navigator.clipboard.writeText(text),
}: PublicSheetPanelProps) {
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
      await clipboardWriter(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Could not copy. Select the link and copy it manually.')
    }
  }

  return (
    // A plain section, not a Panel. Its one consumer is ShareStatusDialog,
    // which is already inside ModalShell's Card — a Panel here would be a
    // border inside a border.
    <section>
      <h2 className={headingClass}>Live public sheet</h2>

      <p className="text-wk-muted mb-3 font-body text-caption leading-relaxed">
        {isPublic === true ? (
          <>
            On. Anyone with this link reads {entityName} as it stands right now, and it follows
            every edit you make. Stopping sharing revokes it, immediately and everywhere.
          </>
        ) : (
          <>
            Off. Publishing gives {entityName} one page that follows the sheet as you play — no
            account needed to read it, and no new link to send when something changes. Everything on
            the sheet goes with it, including bio and appearance text.
          </>
        )}
      </p>

      {isPublic === true && (
        <div className="mb-3 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <code className="text-wk-muted min-w-0 flex-1 truncate font-body text-caption">
              {url}
            </code>
            <Button
              size="compact"
              onClick={() => void copy()}
              aria-label="Copy public sheet link"
              className="shrink-0"
            >
              {copied ? '✓' : '⧉'}
            </Button>
          </div>
          {/*
            Passing a phone across a table is the actual use, so the QR needs
            no heading and no placeholder — it is simply there while there is a
            public link to encode.
          */}
          <div className="flex items-center gap-3">
            <LinkQr url={url} />
            <p className="text-wk-muted mb-0 font-body text-caption">
              Scan to open on another device.
            </p>
          </div>
        </div>
      )}

      <Button
        size="compact"
        variant={isPublic === true ? 'ghost' : 'default'}
        disabled={busy || isPublic === null}
        onClick={() => void toggle(isPublic !== true)}
      >
        {/* "Stop sharing" is accurate: this switch is the whole of sharing. */}
        {isPublic === null ? 'Checking…' : isPublic ? 'Stop sharing' : 'Publish live sheet'}
      </Button>

      {error !== null && <FieldError className="mt-2">{error}</FieldError>}
    </section>
  )
}
