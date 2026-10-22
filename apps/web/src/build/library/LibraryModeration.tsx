/**
 * LibraryModeration — a site admin's queue on the Homebrew library page
 * (ADR-056): the listings readers reported, most reported first, with their
 * reasons, to hide or dismiss; and the listings taken down, to put back.
 * Rendered only for a site admin (`library.moderation` answers null to
 * everyone else, and the server refuses their writes either way).
 */

import { useMutation } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { publicPath } from 'game-domain/entityKinds'
import type { CSSProperties } from 'react'
import { api } from '../../../convex/_generated/api'
import { Button, Cluster, SlabSection, Stack, Text, toast, tokens } from '../../components/index'
import { AppLink } from '../../components/shared/AppLink'
import { useServerAction } from '../../lib/connection/useServerAction'
import { LIBRARY_NOUN } from '../../lib/library/library'

type Queue = NonNullable<FunctionReturnType<typeof api.library.moderation>>
type Moderated = Queue['reported'][number]

const LIST = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[16],
  listStyle: 'none',
  margin: 0,
  padding: 0,
} satisfies CSSProperties

const REASONS = {
  color: tokens.color.ink2,
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.sm,
  margin: 0,
  paddingInlineStart: tokens.space[20],
} satisfies CSSProperties

const NAME = { fontFamily: tokens.font.body, fontWeight: 600 } satisfies CSSProperties

export function LibraryModeration({ queue }: { queue: Queue }) {
  const setHidden = useMutation(api.library.setHidden)
  const dismiss = useMutation(api.library.dismissReports)
  const act = useServerAction(
    async (verb: 'hide' | 'dismiss' | 'restore', item: Moderated) => {
      const target = { kind: item.kind, appId: item.appId }
      if (verb === 'dismiss') await dismiss(target)
      else await setHidden({ ...target, hidden: verb === 'hide' })
      return verb
    },
    { failure: 'That did not save. Try again.', toastId: 'library-moderation' }
  )

  async function run(verb: 'hide' | 'dismiss' | 'restore', item: Moderated) {
    const result = await act.run(verb, item)
    if (!result.ok) return
    const done = { hide: 'Hid', dismiss: 'Dismissed the reports on', restore: 'Put back' }[verb]
    toast.success(`${done} ${item.name}.`)
  }

  const line = (item: Moderated) => (
    <Cluster gap={8}>
      <AppLink href={publicPath(item.kind, item.appId, item.name)} style={NAME}>
        {item.name}
      </AppLink>
      <Text variant="hint">
        {LIBRARY_NOUN[item.kind].one} by {item.madeBy}
      </Text>
    </Cluster>
  )

  return (
    <Stack gap={24}>
      <SlabSection title="Reported" count={queue.reported.length}>
        {queue.reported.length === 0 ? (
          <Text variant="hint">No open reports.</Text>
        ) : (
          <ul style={LIST}>
            {queue.reported.map((item) => (
              <li key={`${item.kind}:${item.appId}`}>
                <Stack gap={8}>
                  {line(item)}
                  <ul style={REASONS} aria-label={`Why ${item.name} was reported`}>
                    {item.reasons.map((reason, i) => (
                      // Reasons repeat; their order is the server's, newest first.
                      // biome-ignore lint/suspicious/noArrayIndexKey: a list that never reorders in place
                      <li key={i}>{reason}</li>
                    ))}
                  </ul>
                  <Cluster gap={8}>
                    <Button
                      size="compact"
                      disabled={act.pending}
                      onClick={() => void run('hide', item)}
                    >
                      Hide
                    </Button>
                    <Button
                      size="compact"
                      variant="ghost"
                      disabled={act.pending}
                      onClick={() => void run('dismiss', item)}
                    >
                      Dismiss {item.reportCount === 1 ? 'report' : `${item.reportCount} reports`}
                    </Button>
                  </Cluster>
                </Stack>
              </li>
            ))}
          </ul>
        )}
      </SlabSection>
      {queue.hidden.length > 0 && (
        <SlabSection title="Taken down" count={queue.hidden.length}>
          <ul style={LIST}>
            {queue.hidden.map((item) => (
              <li key={`${item.kind}:${item.appId}`}>
                <Cluster gap={8}>
                  {line(item)}
                  <Button
                    size="compact"
                    variant="ghost"
                    disabled={act.pending}
                    onClick={() => void run('restore', item)}
                  >
                    Put back
                  </Button>
                </Cluster>
              </li>
            ))}
          </ul>
        </SlabSection>
      )}
    </Stack>
  )
}
