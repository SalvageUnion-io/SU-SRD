/**
 * GameSafety — "Safety" on a Game's own page (Core Book pp.12-13): the
 * table's boundaries in the book's two lists, Out of Bounds and Off Camera,
 * and the Stop Sign.
 *
 * Every member reads both lists and adds to them (`safety.addBoundary`); no
 * name is shown beside a boundary. Whoever added one, or the table runner,
 * may take it off (the ×, `safety.removeBoundary`). The section's head shows
 * the Stop Sign from here too, and the table runner chooses whether showing
 * it posts to the Game's bound Discord channel (`safety.setPostToChannel`).
 */

import { useMutation, useQuery } from 'convex/react'
import type { BoundaryKind } from 'game-domain/games/safety'
import { BOUNDARY_KINDS, BOUNDARY_TEXT_MAX } from 'game-domain/games/safety'
import type { CSSProperties } from 'react'
import { useId, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import {
  AdderBox,
  Button,
  CloseButton,
  Eyebrow,
  FieldError,
  Input,
  SlabSection,
  Switch,
  Text,
  tokens,
} from '../../components/index'
import { useServerAction } from '../../lib/connection/useServerAction'
import { playSafetyCopy } from '../../messages/play-safety'
import { useSync } from '../../replica/syncContext'
import { StopSignButton } from '../StopSign'
import type { StopSign } from '../useStopSign'
import { HUB_BODY } from './hubStyles.model'

const { space } = tokens

const LIST_NAME: Record<BoundaryKind, string> = {
  outOfBounds: playSafetyCopy('outOfBounds'),
  offCamera: playSafetyCopy('offCamera'),
}

const LIST_MEANS: Record<BoundaryKind, string> = {
  outOfBounds: playSafetyCopy('outOfBoundsMeans'),
  offCamera: playSafetyCopy('offCameraMeans'),
}

/** One list: its name, what it means, its lines, then its adder. */
const GROUP = { display: 'flex', flexDirection: 'column', gap: space[4] } satisfies CSSProperties

const LINES = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[2],
  listStyle: 'none',
  margin: 0,
  padding: 0,
} satisfies CSSProperties

const LINE = {
  alignItems: 'center',
  borderBottomColor: 'var(--color-ink-30)',
  borderBottomStyle: 'solid',
  borderBottomWidth: tokens.borderWidth.hairline,
  display: 'flex',
  gap: space[8],
  justifyContent: 'space-between',
  minHeight: tokens.size.compact,
} satisfies CSSProperties

const LINE_TEXT = { minWidth: 0, overflowWrap: 'anywhere' } satisfies CSSProperties

const ADDER_INPUT = { flex: '1 1 12rem', minWidth: 0 } satisfies CSSProperties

type Boundary = { _id: Id<'boundaries'>; kind: BoundaryKind; text: string; mayRemove: boolean }

function BoundaryList({
  gameId,
  kind,
  lines,
  canWrite,
}: {
  gameId: Id<'games'>
  kind: BoundaryKind
  lines: readonly Boundary[]
  canWrite: boolean
}) {
  const id = useId()
  const [text, setText] = useState('')
  const add = useServerAction(useMutation(api.safety.addBoundary), {
    failure: playSafetyCopy('couldNotAdd'),
  })
  const remove = useServerAction(useMutation(api.safety.removeBoundary), {
    failure: playSafetyCopy('couldNotRemove'),
    toastId: 'boundary-remove',
  })
  const name = LIST_NAME[kind]
  const submit = async () => {
    const result = await add.run({ gameId, kind, text })
    if (result.ok) setText('')
  }

  return (
    <section aria-labelledby={`${id}-name`} style={GROUP}>
      <Eyebrow tone="ink" as="h3" id={`${id}-name`}>
        {name}
      </Eyebrow>
      <Text variant="note">{LIST_MEANS[kind]}</Text>
      {lines.length === 0 ? (
        <Text variant="note">{playSafetyCopy('nothingYet')}</Text>
      ) : (
        <ul style={LINES} aria-labelledby={`${id}-name`}>
          {lines.map((line) => (
            <li key={line._id} style={LINE}>
              <Text as="span" style={LINE_TEXT}>
                {line.text}
              </Text>
              {line.mayRemove && (
                <CloseButton
                  label={playSafetyCopy('remove', { text: line.text })}
                  disabled={!canWrite || remove.pending}
                  onClick={() => void remove.run({ boundaryId: line._id })}
                />
              )}
            </li>
          ))}
        </ul>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <AdderBox>
          <Input
            size="compact"
            type="text"
            value={text}
            maxLength={BOUNDARY_TEXT_MAX}
            aria-label={playSafetyCopy('addTo', { list: name })}
            placeholder={playSafetyCopy('boundary')}
            onChange={(event) => setText(event.target.value)}
            style={ADDER_INPUT}
          />
          <Button
            type="submit"
            size="compact"
            disabled={!canWrite || add.pending || text.trim().length === 0}
          >
            {playSafetyCopy('add')}
          </Button>
        </AdderBox>
      </form>
      {add.error && <FieldError>{add.error}</FieldError>}
    </section>
  )
}

export function GameSafety({ gameId, sign }: { gameId: Id<'games'>; sign: StopSign | null }) {
  const boundaries = useQuery(api.safety.boundaries, { gameId })
  const setPost = useServerAction(useMutation(api.safety.setPostToChannel), {
    failure: playSafetyCopy('couldNotChange'),
    toastId: 'stop-sign-post',
  })
  const { canWrite } = useSync()

  return (
    <SlabSection
      as="h2"
      bodyStyle={HUB_BODY}
      id="safety-heading"
      title={playSafetyCopy('safety')}
      actions={<StopSignButton sign={sign} label={playSafetyCopy('stopSign')} />}
    >
      <Text variant="note">{playSafetyCopy('anyoneCanAdd')}</Text>
      {BOUNDARY_KINDS.map((kind) => (
        <BoundaryList
          key={kind}
          gameId={gameId}
          kind={kind}
          lines={boundaries?.filter((line) => line.kind === kind) ?? []}
          canWrite={canWrite}
        />
      ))}
      <Text variant="note">{playSafetyCopy('stopSignMeans')}</Text>
      {sign?.mayManage && (
        <Switch
          checked={sign.postToChannel}
          disabled={!canWrite || setPost.pending}
          onClick={() => void setPost.run({ gameId, on: !sign.postToChannel })}
        >
          {playSafetyCopy('postToChannel')}
        </Switch>
      )}
    </SlabSection>
  )
}
