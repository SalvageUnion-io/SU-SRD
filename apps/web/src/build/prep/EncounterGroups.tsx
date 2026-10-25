/**
 * An encounter's groups on its page (ADR-059 §5): the opposition listed in the
 * order it arrives, those fighting alone first, then each group under its own
 * head with its wave, and the dialog that names a group.
 *
 * Presentational: the page owns the writes, and each row's own "⋯" menu (from
 * the page) moves it between groups.
 */

import type { EncounterGroup, EncounterOpponent } from 'game-domain/schemas/encounter'
import type { CSSProperties, ReactNode } from 'react'
import { useId, useState } from 'react'
import type { HeaderMenuItem } from '../../components/index'
import {
  ConfirmDialog,
  EmptyState,
  Eyebrow,
  HeaderMenu,
  Input,
  SlabSection,
  Stack,
  Text,
  tokens,
} from '../../components/index'
import { buildPrepCopy } from '../../messages/build-prep'
import type { OppositionBlock } from './encounter.model'
import { groupName, WAVES, waveLabel } from './encounter.model'

const LIST = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[8],
  listStyle: 'none',
  margin: 0,
  padding: 0,
} satisfies CSSProperties

type GroupWrites = {
  rename: (group: EncounterGroup) => void
  setWave: (group: EncounterGroup, wave: number) => void
  remove: (group: EncounterGroup) => void
}

/** The opposition, block by block; `row` draws one opponent as the page draws it. */
export function GroupedOpposition({
  blocks,
  row,
  canWrite,
  writes,
}: {
  blocks: readonly OppositionBlock[]
  row: (opponent: EncounterOpponent) => ReactNode
  canWrite: boolean
  writes: GroupWrites
}) {
  const grouped = blocks.some((b) => b.group !== null)
  return (
    <Stack gap={16}>
      {blocks.map(({ group, opponents }) => {
        const rows = (
          <ul style={LIST} aria-label={group?.name ?? buildPrepCopy('alone')}>
            {opponents.map((opponent) => (
              <li key={opponent.id}>{row(opponent)}</li>
            ))}
          </ul>
        )
        if (group === null) {
          // With no groups this is the whole opposition, as it always was.
          if (!grouped) return <div key="alone">{rows}</div>
          return (
            <SlabSection key="alone" as="h3" size="mini" title={buildPrepCopy('alone')}>
              {rows}
            </SlabSection>
          )
        }
        return (
          <SlabSection
            key={group.id}
            as="h3"
            size="mini"
            title={group.name}
            count={waveLabel(group.wave)}
            actions={
              canWrite ? (
                <HeaderMenu
                  variant="overflow"
                  trigger={null}
                  label={buildPrepCopy('moreFor', { name: group.name })}
                  sections={groupMenu(group, writes)}
                />
              ) : undefined
            }
          >
            {opponents.length === 0 ? (
              <EmptyState variant="inline" body={buildPrepCopy('emptyGroup')} />
            ) : (
              rows
            )}
          </SlabSection>
        )
      })}
    </Stack>
  )
}

function groupMenu(group: EncounterGroup, writes: GroupWrites): HeaderMenuItem[][] {
  return [
    [
      {
        id: 'rename',
        label: buildPrepCopy('renameEllipsis'),
        onSelect: () => writes.rename(group),
      },
    ],
    WAVES.filter((wave) => wave !== group.wave).map((wave) => ({
      id: `wave-${wave}`,
      label:
        wave === 1 ? buildPrepCopy('arrivesWithIt') : buildPrepCopy('holdBackToWave', { wave }),
      onSelect: () => writes.setWave(group, wave),
    })),
    [{ id: 'remove', label: buildPrepCopy('removeGroup'), onSelect: () => writes.remove(group) }],
  ]
}

/**
 * Name a group: a new one (`group` null) or a rename. Keyed by its caller on
 * the group, so each opening starts from that group's name.
 */
export function GroupNameDialog({
  open,
  group,
  onClose,
  onSave,
}: {
  open: boolean
  group: EncounterGroup | null
  onClose: () => void
  onSave: (name: string) => Promise<void>
}) {
  const id = useId()
  const [typed, setTyped] = useState(group?.name ?? '')
  const needsAName = buildPrepCopy('groupNeedsAName')
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      title={
        group === null
          ? buildPrepCopy('addAGroup')
          : buildPrepCopy('renameGroup', { name: group.name })
      }
      body={
        <Stack gap={8}>
          {group === null && <Text variant="note">{buildPrepCopy('groupLede')}</Text>}
          <Eyebrow as="label" tone="muted" htmlFor={id}>
            {buildPrepCopy('groupName')}
          </Eyebrow>
          <Input
            id={id}
            value={typed}
            autoComplete="off"
            placeholder={buildPrepCopy('groupNamePlaceholder')}
            onChange={(e) => setTyped(e.target.value)}
          />
        </Stack>
      }
      confirmLabel={group === null ? buildPrepCopy('create') : buildPrepCopy('rename')}
      onConfirm={async () => {
        const name = groupName(typed)
        if (name === '') throw new Error(needsAName)
        await onSave(name)
      }}
      describeError={(err) =>
        err instanceof Error && err.message === needsAName ? needsAName : buildPrepCopy('tryAgain')
      }
    />
  )
}
