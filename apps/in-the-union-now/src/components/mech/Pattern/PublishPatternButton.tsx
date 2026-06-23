/**
 * PublishPatternButton — publishes a MechPattern as a cloneable anonymous
 * snapshot (REQ-026 / M4).
 *
 * Patterns are not a sheet kind, so they don't route through the sheet Share
 * Snapshot screen. This inline control reuses the existing kind-agnostic
 * snapshot backend directly: it probes the service (S6 feature-detect),
 * publishes a `{ kind: 'pattern', entity: <MechPattern> }` payload via
 * publishSnapshot, and surfaces the resulting `/s/:id` link with a copy
 * affordance. The snapshot backend stores arbitrary JSON, so no backend
 * change is needed.
 *
 * Dep-injection: publishFn / probeFn / clipboardWriter are overridable for
 * testing, mirroring ShareSnapshotScreen.
 */

import { useEffect, useState } from 'react'

import type { MechPattern } from '../../../lib/schemas/pattern'
import { probeSnapshotService, publishSnapshot } from '../../../lib/snapshot/client'
import type { PublishResult, SnapshotPayload } from '../../../lib/snapshot/client'
import { Button } from '../../ui/button'

type PublishPatternButtonProps = {
  pattern: MechPattern
  /** Injectable publish function for testing. */
  publishFn?: (payload: SnapshotPayload) => Promise<PublishResult>
  /** Injectable backend feature-detect for testing (S6). */
  probeFn?: () => Promise<boolean>
  /** Injectable clipboard writer for testing. */
  clipboardWriter?: (text: string) => Promise<void>
}

type ServiceState = 'checking' | 'available' | 'unavailable'

type PublishState =
  | { status: 'idle' }
  | { status: 'publishing' }
  | { status: 'published'; shareUrl: string }
  | { status: 'error'; message: string }

export function PublishPatternButton({
  pattern,
  publishFn = publishSnapshot,
  probeFn = probeSnapshotService,
  clipboardWriter = (text) => navigator.clipboard.writeText(text),
}: PublishPatternButtonProps) {
  const [service, setService] = useState<ServiceState>('checking')
  const [publishState, setPublishState] = useState<PublishState>({ status: 'idle' })
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    void probeFn().then((available) => {
      if (!cancelled) setService(available ? 'available' : 'unavailable')
    })
    return () => {
      cancelled = true
    }
  }, [probeFn])

  const shareUrl = publishState.status === 'published' ? publishState.shareUrl : null

  async function handlePublish() {
    setPublishState({ status: 'publishing' })
    setCopied(false)

    const payload: SnapshotPayload = {
      kind: 'pattern',
      entity: pattern as unknown as Record<string, unknown>,
    }

    try {
      const result = await publishFn(payload)
      setPublishState({
        status: 'published',
        shareUrl: `${window.location.origin}/s/${result.id}`,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setPublishState({ status: 'error', message: `Failed to publish: ${message}` })
    }
  }

  async function handleCopy() {
    if (!shareUrl) return
    try {
      await clipboardWriter(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Leave the link visible; the user can select and copy it manually.
    }
  }

  if (service === 'unavailable') {
    return (
      <p
        role="note"
        title="The snapshot service could not be reached — publishing needs the deployed /api/snapshots endpoint."
        className="text-xs text-muted-foreground"
      >
        Sharing unavailable
      </p>
    )
  }

  if (shareUrl) {
    return (
      <div className="flex flex-col items-end gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void handleCopy()}
          aria-label={`Copy share link for pattern ${pattern.name}`}
        >
          {copied ? 'Copied ✓' : 'Copy link'}
        </Button>
        <a
          href={shareUrl}
          className="max-w-[12rem] truncate text-xs text-muted-foreground underline"
          title={shareUrl}
        >
          {shareUrl}
        </a>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => void handlePublish()}
        disabled={service === 'checking' || publishState.status === 'publishing'}
        aria-label={`Share pattern ${pattern.name} as a snapshot`}
      >
        {publishState.status === 'publishing' ? 'Sharing…' : 'Share'}
      </Button>
      {publishState.status === 'error' && (
        <p className="text-xs text-destructive" role="alert">
          {publishState.message}
        </p>
      )}
    </div>
  )
}
