/**
 * PublishButton — sheet header action that publishes an entity snapshot
 * to the backend and opens ShareURLDialog with the resulting share URL.
 *
 * Dep-injection:
 *   - `publishFn` replaces publishSnapshot (for testing — no mock.module())
 *   - `entityStore` replaces the real Zustand store (same pattern as Sheet.tsx)
 *
 * The share URL returned by the server is an absolute URL constructed from
 * window.location.origin + the path `/s/<id>`.
 */

import { useState } from 'react'

import { useEntityStore } from '../../stores/entityStore'
import type { EntityLookup } from './Sheet'
import { publishSnapshot } from '../../lib/snapshot/client'
import type { SnapshotPayload, PublishResult } from '../../lib/snapshot/client'
import { ShareURLDialog } from './ShareURLDialog'
import { Button } from '../ui/button'
import type { EntityRef } from '../../lib/schemas/entity'

type PublishButtonProps = {
  entityKind: EntityRef['type']
  entityId: string
  /**
   * Injectable publish function for testing.
   * Defaults to the real publishSnapshot from snapshot/client.
   */
  publishFn?: (payload: SnapshotPayload) => Promise<PublishResult>
  /**
   * Injectable entity store for testing.
   * When omitted, uses the real Zustand useEntityStore.
   */
  entityStore?: EntityLookup
}

type PublishState =
  | { status: 'idle' }
  | { status: 'publishing' }
  | { status: 'success'; shareUrl: string }
  | { status: 'error'; message: string }

export function PublishButton({
  entityKind,
  entityId,
  publishFn = publishSnapshot,
  entityStore: entityStoreOverride,
}: PublishButtonProps) {
  const [publishState, setPublishState] = useState<PublishState>({ status: 'idle' })

  const realStore = useEntityStore()
  const store: EntityLookup = entityStoreOverride ?? {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    get: (type, id) => realStore.get(type as any, id) as any,
  }

  async function handlePublish() {
    setPublishState({ status: 'publishing' })

    const entity = store.get(entityKind, entityId)
    if (!entity) {
      setPublishState({ status: 'error', message: 'Entity not found — cannot publish.' })
      return
    }

    // Build the snapshot payload: just the entity for v1.
    // Bundling wired composition (linked mech + pilot + crawler) is a polish
    // iteration — left as a future improvement.
    const payload: SnapshotPayload = {
      kind: entityKind,
      entity: entity as unknown as Record<string, unknown>,
    }

    try {
      const result = await publishFn(payload)
      // Construct absolute share URL from the returned path
      const shareUrl = `${window.location.origin}/s/${result.id}`
      setPublishState({ status: 'success', shareUrl })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setPublishState({ status: 'error', message: `Failed to publish: ${message}` })
    }
  }

  function handleDialogClose() {
    setPublishState({ status: 'idle' })
  }

  const isPublishing = publishState.status === 'publishing'

  return (
    <>
      <div className="flex flex-col items-end gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void handlePublish()}
          disabled={isPublishing}
          aria-label="Publish snapshot and get share URL"
          className="min-h-11 sm:min-h-9"
        >
          {isPublishing ? 'Publishing…' : 'Share'}
        </Button>

        {publishState.status === 'error' && (
          <p role="alert" className="text-xs text-red-600 max-w-xs text-right">
            {publishState.message}
          </p>
        )}
      </div>

      {publishState.status === 'success' && (
        <ShareURLDialog url={publishState.shareUrl} onClose={handleDialogClose} />
      )}
    </>
  )
}
