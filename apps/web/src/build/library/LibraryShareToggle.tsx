/**
 * LibraryShareToggle — "List it in the Homebrew library", under the link in a
 * pattern's or a built NPC's "Who can see it" (ADR-053). It shows only while
 * anyone with the link may read the thing, because the library lists nothing
 * more public than its link; going back to a narrower answer delists it on
 * the server.
 *
 * One on/off, so a `Toggle`, writing as it is pressed (`library.setListed`)
 * and read back from `library.status`. A listing a site admin took down says
 * so, and cannot be listed again.
 */

import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { FieldError, Stack, Text, Toggle } from '../../components/index'
import { AppLink } from '../../components/shared/AppLink'
import { useServerAction } from '../../lib/connection/useServerAction'
import type { LibraryKind } from '../../lib/library/library'

export function LibraryShareToggle({ kind, appId }: { kind: LibraryKind; appId: string }) {
  const status = useQuery(api.library.status, { kind, appId })
  const setListed = useMutation(api.library.setListed)
  const list = useServerAction((listed: boolean) => setListed({ kind, appId, listed }), {
    failure: 'That could not be saved. Try again.',
  })

  if (status === undefined) return null
  if (status.hidden) {
    return (
      <Text variant="hint">
        A site admin took this out of the Homebrew library. Its link still works.
      </Text>
    )
  }
  return (
    <Stack gap={8}>
      <div>
        <Toggle
          pressed={status.listed}
          disabled={list.pending}
          onClick={() => void list.run(!status.listed)}
        >
          List it in the Homebrew library
        </Toggle>
      </div>
      <Text variant="hint">
        {status.listed ? (
          <>
            Listed in the <AppLink href="/library">Homebrew library</AppLink>, where anyone can find
            it and copy it.
          </>
        ) : (
          'Anyone could find it in the Homebrew library and copy it to their Training Bay.'
        )}
      </Text>
      {list.error !== null && <FieldError>{list.error}</FieldError>}
    </Stack>
  )
}
