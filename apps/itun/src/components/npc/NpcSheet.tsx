/**
 * NpcSheet — a built NPC's own page, `/sheet/npc/:id` (ADR-043;
 * `docs/architecture/npc-builder.md` §4.2).
 *
 * Two columns, as the other user-made pages lay out (board P1): the stat block
 * as the entity card it is — dashed, User-made, "Made by [maker]" — and the
 * identity panel the crawler's bay cards use (`NpcInset`): name, role, current
 * HP, keepsake, motto, description and facts. A full user-made page, so its
 * band is hatched (ruleset §3.9).
 *
 * What the owner edits here is the identity and current HP. The stat block
 * (max HP, actions, traits) is the designer's; editing it on the sheet comes
 * later. Writes go through the entity store, server first.
 *
 * Handler absence is the read-only encoding, as on `NpcInset`: a crewmate's
 * NPC, read live from the Game's listing, renders the same page with no edit
 * affordances and a note saying why.
 */

import { Badge, Button, ChapterBand, Slab, Text, tokens, UserMadeStamp } from 'component-lib'
import type { CSSProperties } from 'react'
import type { NpcView } from '../../lib/npcs/npcModel'
import { isNpcDown, npcCurrentHP, slotPhrase } from '../../lib/npcs/npcModel'
import { runWrite } from '../../lib/runWrite'
import type { Npc } from '../../lib/schemas/npc'
import type { CrewSlot } from '../../lib/schemas/softLink'
import { useEntityStore } from '../../stores/entityStore'
import { LIVE_SHEET_MANUAL } from '../../stores/surfaceProvenance'
import { MoveToContainerControl } from '../container/MoveToContainerControl'
import { AppLink } from '../shared/AppLink'
import type { Confirm } from '../shared/useConfirm'
import { NpcInset } from '../sheet/NpcInset'
import { NpcCard } from './NpcCard'

const PAGE = {
  backgroundColor: tokens.color.wkBg,
  minHeight: '100%',
  paddingBottom: tokens.space[48],
} satisfies CSSProperties

const COLUMNS = {
  display: 'grid',
  gap: tokens.space[32],
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 26rem), 1fr))',
  margin: '0 auto',
  maxWidth: '80rem',
  padding: `${tokens.space[24]} ${tokens.space[16]} 0`,
} satisfies CSSProperties

const COLUMN = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[12],
  minWidth: 0,
} satisfies CSSProperties

/** The Denizens navy carries paper text (ChapterBand: the caller dresses it). */
const EYEBROW = {
  alignItems: 'center',
  color: tokens.color.paper,
  display: 'flex',
  flexWrap: 'wrap',
  fontFamily: tokens.font.cond,
  fontSize: tokens.fontSize.caption,
  fontWeight: tokens.weight.bold,
  gap: tokens.space[8],
  letterSpacing: tokens.tracking.caps,
  textTransform: 'uppercase',
} satisfies CSSProperties

const EYEBROW_LINK = { color: tokens.color.paper } satisfies CSSProperties

const ROW = {
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  gap: tokens.space[12],
} satisfies CSSProperties

const NOTE = {
  borderColor: tokens.color.ink,
  borderStyle: 'dashed',
  borderWidth: tokens.borderWidth.chrome,
  color: tokens.color.ink,
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.caption,
  margin: 0,
  padding: tokens.space[12],
} satisfies CSSProperties

/** Where the NPC crews, when it does. */
export type NpcCrewing = {
  crawlerId: string
  crawlerName: string
  slot: CrewSlot
}

type NpcSheetProps = {
  npc: Npc
  /** "Made by [madeBy]". */
  madeBy: string
  /** A crewmate's NPC: no edit, move or delete. */
  readOnly: boolean
  /** The crawler slot it fills, if any. */
  crewing?: NpcCrewing
  /** Opens the shared confirm the move and the delete go through. */
  confirm?: Confirm
  /** After the delete lands — where to go is the route's call. */
  onDeleted?: () => void
  /** Where the breadcrumb's first step goes: the shelves, or the crew. */
  back?: { href: string; label: string }
}

export function NpcSheet({
  npc,
  madeBy,
  readOnly,
  crewing,
  confirm,
  onDeleted,
  back = { href: '/', label: 'Shelves' },
}: NpcSheetProps) {
  const view: NpcView = npc
  const down = isNpcDown(view)
  const editable = !readOnly

  function patch(fields: Partial<Npc>) {
    runWrite(() => useEntityStore.getState().update('npc', npc.id, fields, LIVE_SHEET_MANUAL))
  }

  function remove() {
    confirm?.({
      title: `Delete ${npc.name}?`,
      body: [
        `This cannot be undone. ${npc.name} will be permanently removed${crewing ? `, and ${slotPhrase(crewing.slot)} on ${crewing.crawlerName} goes back to the book's crew line` : ''}.`,
      ],
      confirmLabel: 'Delete',
      pendingLabel: 'Deleting…',
      tone: 'danger',
      failure: `${npc.name} could not be deleted. Try again.`,
      onConfirm: async () => {
        await useEntityStore.getState().delete('npc', npc.id)
        onDeleted?.()
      },
    })
  }

  return (
    <main style={PAGE}>
      <ChapterBand
        tone="denizen"
        userMade
        measure="80rem"
        eyebrow={
          <div style={EYEBROW}>
            <nav aria-label="Breadcrumb">
              <AppLink href={back.href} style={EYEBROW_LINK}>
                {back.label}
              </AppLink>
              {' / '}
              <span aria-current="page">Denizens · NPC</span>
            </nav>
            <UserMadeStamp label="User-made NPC" />
          </div>
        }
      >
        {npc.name}
      </ChapterBand>

      <div style={COLUMNS}>
        <section style={COLUMN} aria-labelledby="npc-stat-block">
          <Slab variant="solid" id="npc-stat-block" label="Stat block" />
          <NpcCard npc={view} madeBy={madeBy} />
          <Text variant="hint">
            Actions and traits come from the reference, so their rules text is the book&rsquo;s.
          </Text>
        </section>

        <section style={COLUMN} aria-labelledby="npc-identity">
          <Slab variant="solid" id="npc-identity" label="Identity" />
          {down && (
            <div style={ROW}>
              <Badge shape="stamp" size="compact">
                Down
              </Badge>
              <Text variant="hint">At 0 HP. Nothing is removed: heal them on the HP track.</Text>
            </div>
          )}
          <NpcInset
            bayName={npc.name}
            title={npc.position}
            name={npc.name}
            hp={npcCurrentHP(view)}
            maxHp={npc.hitPoints}
            keepsake={npc.keepsake ?? ''}
            motto={npc.motto ?? ''}
            detail={npc.description ?? ''}
            facts={npc.facts ?? []}
            {...(editable
              ? {
                  onNameChange: (next: string) => {
                    if (next.trim()) patch({ name: next.trim() })
                  },
                  onHpChange: (next: number) => patch({ currentHP: next }),
                  onKeepsakeChange: (next: string) => patch({ keepsake: next.trim() || undefined }),
                  onMottoChange: (next: string) => patch({ motto: next.trim() || undefined }),
                  onDetailChange: (next: string) =>
                    patch({ description: next.trim() || undefined }),
                  onFactsChange: (next: string[]) => patch({ facts: next }),
                }
              : {})}
          />

          {crewing && (
            <p style={NOTE}>
              Crews {slotPhrase(crewing.slot)} on{' '}
              <AppLink href={`/sheet/crawler/${crewing.crawlerId}`}>{crewing.crawlerName}</AppLink>.
              Whoever runs that crawler assigns and unassigns its crew.
            </p>
          )}

          {editable ? (
            <div style={ROW}>
              {confirm && (
                <MoveToContainerControl
                  entityType="npc"
                  entityId={npc.id}
                  entity={npc}
                  confirm={confirm}
                />
              )}
              <Button variant="ghost" onClick={remove} aria-label={`Delete ${npc.name}`}>
                Delete
              </Button>
            </div>
          ) : (
            <p role="note" style={NOTE}>
              You are reading a crewmate&rsquo;s NPC. Only whoever made it can change it.
            </p>
          )}
        </section>
      </div>
    </main>
  )
}
