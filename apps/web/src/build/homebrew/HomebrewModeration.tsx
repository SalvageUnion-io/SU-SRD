/**
 * HomebrewModeration — a site admin's queue (ADR-058) at `/admin/homebrew`:
 * the homebrew patterns readers reported, most reported first, with their
 * reasons, to hide or dismiss; and the patterns taken down, to put back.
 * `homebrew.moderation` answers null to everyone else, and the server
 * refuses their writes either way.
 */

import { useMutation } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { publicPath } from 'game-domain/entityKinds'
import type { CSSProperties } from 'react'
import { api } from '../../../convex/_generated/api'
import { Button, Cluster, SlabSection, Stack, Text, toast, tokens } from '../../components/index'
import { AppLink } from '../../components/shared/AppLink'
import { useServerAction } from '../../lib/connection/useServerAction'
import { buildHomebrewCopy } from '../../messages/build-homebrew'

type Queue = NonNullable<FunctionReturnType<typeof api.homebrew.moderation>>
type Moderated = Queue['reported'][number]
type Verb = 'hide' | 'dismiss' | 'restore'

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

export function HomebrewModeration({ queue }: { queue: Queue }) {
  const setHidden = useMutation(api.homebrew.setHidden)
  const dismiss = useMutation(api.homebrew.dismissReports)
  const act = useServerAction(
    async (verb: Verb, item: Moderated) => {
      if (verb === 'dismiss') await dismiss({ appId: item.appId })
      else await setHidden({ appId: item.appId, hidden: verb === 'hide' })
      return verb
    },
    { failure: buildHomebrewCopy('didNotSave'), toastId: 'homebrew-moderation' }
  )

  async function run(verb: Verb, item: Moderated) {
    const result = await act.run(verb, item)
    if (!result.ok) return
    const name = item.name
    if (verb === 'hide') toast.success(buildHomebrewCopy('hidFromHomebrew', { name }))
    else if (verb === 'dismiss') toast.success(buildHomebrewCopy('dismissedReportsOn', { name }))
    else toast.success(buildHomebrewCopy('putBack', { name }))
  }

  const line = (item: Moderated) => (
    <Cluster gap={8}>
      <AppLink href={publicPath('pattern', item.appId, item.name)} style={NAME}>
        {item.name}
      </AppLink>
      <Text variant="hint">{buildHomebrewCopy('patternBy', { name: item.madeBy })}</Text>
    </Cluster>
  )

  return (
    <Stack gap={24}>
      <SlabSection title={buildHomebrewCopy('reportedSection')} count={queue.reported.length}>
        {queue.reported.length === 0 ? (
          <Text variant="hint">{buildHomebrewCopy('noOpenReports')}</Text>
        ) : (
          <ul style={LIST}>
            {queue.reported.map((item) => (
              <li key={item.appId}>
                <Stack gap={8}>
                  {line(item)}
                  <ul
                    style={REASONS}
                    aria-label={buildHomebrewCopy('whyReported', { name: item.name })}
                  >
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
                      {buildHomebrewCopy('hide')}
                    </Button>
                    <Button
                      size="compact"
                      variant="ghost"
                      disabled={act.pending}
                      onClick={() => void run('dismiss', item)}
                    >
                      {item.reportCount === 1
                        ? buildHomebrewCopy('dismissOne')
                        : buildHomebrewCopy('dismissMany', { count: item.reportCount })}
                    </Button>
                  </Cluster>
                </Stack>
              </li>
            ))}
          </ul>
        )}
      </SlabSection>
      {queue.hidden.length > 0 && (
        <SlabSection title={buildHomebrewCopy('takenDown')} count={queue.hidden.length}>
          <ul style={LIST}>
            {queue.hidden.map((item) => (
              <li key={item.appId}>
                <Cluster gap={8}>
                  {line(item)}
                  <Button
                    size="compact"
                    variant="ghost"
                    disabled={act.pending}
                    onClick={() => void run('restore', item)}
                  >
                    {buildHomebrewCopy('putBackButton')}
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
