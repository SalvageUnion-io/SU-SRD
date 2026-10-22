/**
 * HomebrewLibrary — `/library`, the Homebrew library (ADR-056): the patterns
 * and built NPCs players chose to list, one more Catalog.
 *
 * Laid out as a listing page is: the band (hatched, user-made, ruleset §3.9)
 * with its search and Kind filter as its controls, then one flat grid of
 * header-only Compacts, newest first, each wearing the HOMEBREW stamp and its
 * maker. A Compact opens the thing's public page (ADR-032); its "⋯" holds Make
 * a copy and Report, signed in, and a site admin's Hide.
 *
 * Reading needs no account, as the pages it leads to need none. A site admin
 * also sees the moderation queue (`LibraryModeration`) above the grid.
 */

import { useMutation, useQuery } from 'convex/react'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import type { RefMetaEntity } from 'salvageunion-reference'
import { api } from '../../../convex/_generated/api'
import type { HeaderMenuItem } from '../../components/index'
import {
  ChapterBand,
  Entity,
  HeaderMenu,
  PageShell,
  quotePatternName,
  RosterSkeleton,
  SearchField,
  Segmented,
  SegmentedOption,
  Stat,
  Text,
  toast,
  tokens,
} from '../../components/index'
import { useConfirm } from '../../components/shared/useConfirm'
import { useGo } from '../../components/shared/useGo'
import { useConnection } from '../../lib/connection/connectionContext'
import type { LibraryFilter, LibraryItem } from '../../lib/library/library'
import {
  itemHref,
  itemName,
  LIBRARY_NOUN,
  libraryItem,
  shownItems,
} from '../../lib/library/library'
import { npcAsReferenceEntity } from '../../lib/npcs/npcModel'
import { PAGE_MEASURE } from '../../lib/pageMeasure'
import { asReferencePattern } from '../../lib/patterns/patterns'
import { LibraryModeration } from './LibraryModeration'
import { copyLibraryItem } from './libraryCopy.model'
import { ReportDialog } from './ReportDialog'

const LEDE = {
  color: tokens.color.wkMuted,
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.sm,
  lineHeight: '1.25rem',
  margin: 0,
} satisfies CSSProperties

const LIST = {
  display: 'grid',
  gap: tokens.space[12],
  gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 28rem), 1fr))',
  listStyle: 'none',
  margin: 0,
  padding: 0,
} satisfies CSSProperties

const ITEM = { listStyle: 'none', minWidth: 0 } satisfies CSSProperties

const SEARCH = { minWidth: 0, width: '16rem', maxWidth: '100%' } satisfies CSSProperties

const FILTERS: ReadonlyArray<{ value: LibraryFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'pattern', label: LIBRARY_NOUN.pattern.many },
  { value: 'npc', label: LIBRARY_NOUN.npc.many },
]

/** The item a reader is reporting, held while its dialog is open. */
type Reporting = { item: LibraryItem; open: boolean }

export function HomebrewLibrary() {
  const rows = useQuery(api.library.list, {})
  const { mode, canWrite } = useConnection()
  const writable = canWrite && mode === 'connected'
  const status = useQuery(api.library.moderation, writable ? {} : 'skip')
  const setHidden = useMutation(api.library.setHidden)
  const { confirm, dialog } = useConfirm()
  const go = useGo()
  const [filter, setFilter] = useState<LibraryFilter>('all')
  const [search, setSearch] = useState('')
  const [reporting, setReporting] = useState<Reporting | null>(null)

  const items = (rows ?? []).flatMap((row) => {
    const item = libraryItem(row)
    return item ? [item] : []
  })
  const shown = shownItems(items, filter, search)
  const admin = status !== null && status !== undefined

  function menu(item: LibraryItem): HeaderMenuItem[][] {
    const name = itemName(item)
    const reader: HeaderMenuItem[] = [
      { id: 'open', label: 'Open', onSelect: () => go(itemHref(item)) },
      {
        id: 'copy',
        label: 'Make a copy',
        onSelect: writable
          ? () =>
              confirm({
                title: `Copy ${name} to your Training Bay?`,
                body: [
                  `This makes ${name} a ${LIBRARY_NOUN[item.kind].one.toLowerCase()} of your own, to change and build from.`,
                  `${item.madeBy}’s stays as it is, and your copy does not follow it.`,
                ],
                confirmLabel: 'Make a copy',
                pendingLabel: 'Copying…',
                tone: 'default',
                failure: `${name} could not be copied. Try again.`,
                onConfirm: async () => {
                  const copied = await copyLibraryItem(item)
                  toast.success(`Copied ${copied} to your Training Bay.`)
                },
              })
          : undefined,
      },
      ...(writable && !item.mine
        ? [
            {
              id: 'report',
              label: 'Report…',
              onSelect: () => setReporting({ item, open: true }),
            },
          ]
        : []),
    ]
    const moderator: HeaderMenuItem[] = admin
      ? [
          {
            id: 'hide',
            label: 'Hide from the library…',
            tone: 'danger',
            onSelect: () =>
              confirm({
                title: `Hide ${name} from the library?`,
                body: [
                  `${name} leaves the Homebrew library for everyone, and ${item.madeBy} cannot list it again. Its share link still works. You can put it back from the takedown list.`,
                ],
                confirmLabel: 'Hide',
                pendingLabel: 'Hiding…',
                tone: 'danger',
                failure: `${name} could not be hidden. Try again.`,
                onConfirm: async () => {
                  await setHidden({ kind: item.kind, appId: item.appId, hidden: true })
                  toast.success(`Hid ${name} from the library.`)
                },
              }),
          },
        ]
      : []
    return [reader, moderator]
  }

  return (
    <PageShell
      measure={PAGE_MEASURE}
      band={
        <ChapterBand
          tone="build"
          measure={PAGE_MEASURE}
          userMade
          asideAt="controls"
          aside={
            <>
              <SearchField
                type="search"
                aria-label="Search the library"
                placeholder="Search names, makers, chassis"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={SEARCH}
              />
              <Segmented label="Kind" size="compact">
                {FILTERS.map((option) => (
                  <SegmentedOption
                    key={option.value}
                    pressed={filter === option.value}
                    onClick={() => setFilter(option.value)}
                  >
                    {option.label}
                  </SegmentedOption>
                ))}
              </Segmented>
            </>
          }
        >
          Homebrew Library
        </ChapterBand>
      }
    >
      <p style={LEDE}>
        Patterns and NPCs players made and chose to share. Open one to read it;{' '}
        {writable
          ? 'make a copy to change it and build from it.'
          : 'sign in to copy one to your Training Bay.'}{' '}
        To list your own, share it with anyone with the link and pick “List it in the Homebrew
        library”.
      </p>

      {admin && status && <LibraryModeration queue={status} />}

      {rows === undefined ? (
        <RosterSkeleton />
      ) : shown.length === 0 ? (
        <Text variant="hint">
          {items.length === 0
            ? 'Nothing is listed yet.'
            : 'Nothing in the library matches. Try another name or kind.'}
        </Text>
      ) : (
        <ul style={LIST} aria-label="Homebrew">
          {shown.map((item) => (
            <li key={`${item.kind}:${item.appId}`} style={ITEM}>
              <LibraryCompact item={item} menu={menu(item)} />
            </li>
          ))}
        </ul>
      )}

      {reporting && (
        <ReportDialog
          kind={reporting.item.kind}
          appId={reporting.item.appId}
          name={itemName(reporting.item)}
          open={reporting.open}
          onOpenChange={(open) => setReporting(open ? reporting : { ...reporting, open: false })}
        />
      )}
      {dialog}
    </PageShell>
  )
}

/** One listing: a header-only Compact opening its page, its maker the first chip, "⋯" last. */
function LibraryCompact({ item, menu }: { item: LibraryItem; menu: HeaderMenuItem[][] }) {
  const name = itemName(item)
  const href = itemHref(item)
  const labels = <Stat label="By" value={item.mine ? 'You' : item.madeBy} size="compact" />
  const trailing = (
    <HeaderMenu variant="overflow" trigger={null} label={`More for ${name}`} sections={menu} />
  )
  if (item.kind === 'pattern') {
    return (
      <Entity
        size="compact"
        entity={item.chassis}
        pattern={asReferencePattern(item.pattern)}
        instance={{ title: quotePatternName(item.pattern.name), userMade: true }}
        mode={{ kind: 'link', href }}
        labels={labels}
        trailing={trailing}
      />
    )
  }
  return (
    <Entity
      size="compact"
      entity={npcAsReferenceEntity(item.npc) as unknown as RefMetaEntity}
      instance={{ userMade: true }}
      mode={{ kind: 'link', href }}
      labels={labels}
      trailing={trailing}
    />
  )
}
