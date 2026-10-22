/**
 * NpcSheet — a built NPC's own page, `/sheet/npc/:id` (ADR-044;
 * `docs/architecture/npc-builder.md` §4.2), on the shell every Live Sheet
 * shares (hard rule R11): `LiveSheet`'s chapter band, Read | Edit and the
 * corner actions (Share, then Move and Delete under "⋯"), a `SheetHero`
 * opening, its actions under a Slab.
 *
 * - The band names it once (the sheet's one h1), hatched as a full user-made
 *   page (ruleset §3.9), with its HOMEBREW stamp, "Made by [maker]" and what
 *   it was built from (`FROM | Veteran`) right of the name.
 * - The opening: its portrait beside its identity lines (`NpcLines`: role,
 *   keepsake, motto, detail, facts; its name a field in Edit), and its HP as
 *   the sheet's one vital gauge (`SheetVitalGauge`).
 * - Its actions as contentful Minis under an Actions slab, their rules the
 *   book's; its traits as Tags.
 * - Down at 0 HP is the one unit-out treatment.
 *
 * Read is the printed sheet: an empty line is left out and nothing writes;
 * Edit gives the fields, the HP track and the photo control back. A crewmate's
 * NPC, read live from the Game's listing, and a shared one at `/p/npc/:id`
 * render read-only with no toggle, and say why.
 */

import type { Npc } from 'game-domain/schemas/npc'
import type { CrewSlot } from 'game-domain/schemas/softLink'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import type { RefMetaEntity } from 'salvageunion-reference'
import { toEntityModel } from 'salvageunion-reference'
import { ActionMinis, Button, SlabSection, Tags, tokens, traitTags } from '../../components/index'
import { AppLink } from '../../components/shared/AppLink'
import { EntityPhoto } from '../../components/shared/EntityPhoto'
import type { Confirm } from '../../components/shared/useConfirm'
import { useConnection } from '../../lib/connection/connectionContext'
import type { NpcView } from '../../lib/npcs/npcModel'
import {
  isNpcDown,
  npcAsReferenceEntity,
  npcCurrentHP,
  resolveNpcAction,
  slotPhrase,
} from '../../lib/npcs/npcModel'
import { npcTemplateArt } from '../../lib/photos/defaultArt'
import { runWrite } from '../../lib/runWrite'
import { npcCopy } from '../../messages/build-npc'
import { useEntityStore } from '../../stores/entityStore'
import { LIVE_SHEET_MANUAL } from '../../stores/surfaceProvenance'
import { MoveToContainerControl } from '../entityContainer/MoveToContainerControl'
import { ShareStatusDialog } from '../sharing/ShareStatusDialog'
import { npcStamp } from '../sheet/bandStamps.model'
import { LiveSheet } from '../sheet/LiveSheet'
import { NpcLines } from '../sheet/NpcLines'
import { PhotoBeside } from '../sheet/PhotoBeside'
import { SheetActionsMenu } from '../sheet/SheetActionsMenu'
import { SheetColumns } from '../sheet/SheetColumns'
import { SheetHero } from '../sheet/SheetHero'
import { SheetModeToggle } from '../sheet/SheetModeToggle'
import { SheetVitalGauge } from '../sheet/SheetVitalGauge'
import { useSheetMode } from '../sheet/sheetMode.model'
import { NOTE } from './npcStyles.model'

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
  /** A crewmate's or a shared NPC: no toggle, no edit, move or delete. */
  readOnly: boolean
  /** The crawler slot it fills, if any. */
  crewing?: NpcCrewing
  /** Opens the shared confirm the move and the delete go through. */
  confirm?: Confirm
  /** After the delete lands — where to go is the route's call. */
  onDeleted?: () => void
  /**
   * Why a read-only page cannot be changed, as a note atop it (a shared NPC);
   * a crewmate's reads it on the crew sheet's banner instead (`CrewSheetBanner`).
   */
  readOnlyNote?: string
}

/** The opening's fields: the identity lines, then the traits. */
const FIELDS = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[12],
  minWidth: 0,
} satisfies CSSProperties

const SHEET = {
  containerType: 'inline-size',
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[24],
} satisfies CSSProperties

const ACTIONS = {
  alignItems: 'center',
  display: 'flex',
  gap: tokens.space[8],
} satisfies CSSProperties

export function NpcSheet({
  npc,
  madeBy,
  readOnly: readOnlyProp,
  crewing,
  confirm,
  onDeleted,
  readOnlyNote,
}: NpcSheetProps) {
  const [shareOpen, setShareOpen] = useState(false)
  const { canWrite, settling } = useConnection()
  const sheetMode = useSheetMode()
  const view: NpcView = npc
  // As on every sheet (`Sheet.tsx`): Read until Edit is pressed, and nothing
  // writes while the server of record cannot be reached.
  const writesBlocked = !canWrite && !settling
  const editing = sheetMode === null || sheetMode.editing
  const editable = !readOnlyProp && !writesBlocked && editing

  function patch(fields: Partial<Npc>) {
    runWrite(() => useEntityStore.getState().update('npc', npc.id, fields, LIVE_SHEET_MANUAL))
  }

  function remove() {
    confirm?.({
      title: npcCopy('delete', { name: npc.name }),
      body: [
        `This cannot be undone. ${npc.name} will be permanently removed${crewing ? `, and ${slotPhrase(crewing.slot)} on ${crewing.crawlerName} goes back to the book's crew line` : ''}.`,
      ],
      confirmLabel: npcCopy('delete2'),
      pendingLabel: npcCopy('deleting'),
      tone: 'danger',
      failure: `${npc.name} could not be deleted. Try again.`,
      onConfirm: async () => {
        await useEntityStore.getState().delete('npc', npc.id)
        onDeleted?.()
      },
    })
  }

  const modeToggle =
    sheetMode !== null && !readOnlyProp && !writesBlocked ? (
      <SheetModeToggle mode={sheetMode} kind="NPC" />
    ) : undefined

  // The corner (as on every sheet): Share inline, the admin moves under "⋯".
  const actions = readOnlyProp ? undefined : (
    <div style={ACTIONS}>
      {!writesBlocked && (
        <Button
          onClick={() => setShareOpen(true)}
          aria-label={npcCopy('share2', { name: npc.name })}
          className="su-page-action"
        >
          {npcCopy('share')}
        </Button>
      )}
      {confirm && (
        <SheetActionsMenu>
          <MoveToContainerControl
            entityType="npc"
            entityId={npc.id}
            entity={npc}
            confirm={confirm}
          />
          <Button
            variant="ghost"
            onClick={remove}
            aria-label={npcCopy('delete3', { name: npc.name })}
          >
            {npcCopy('delete2')}
          </Button>
        </SheetActionsMenu>
      )}
    </div>
  )

  const hp = npcCurrentHP(view)
  const npcActions = npc.actions
    .map((slug) => resolveNpcAction(slug))
    .filter((action) => action !== null)
    .map((action) => ({ ...action, schemaName: 'actions' }))
  const traits = traitTags(
    toEntityModel(npcAsReferenceEntity(view) as unknown as RefMetaEntity).traits
  )

  return (
    <>
      <LiveSheet
        variant="npc"
        name={npc.name}
        band={{ actions: modeToggle }}
        actions={actions}
        kindDetail={npcStamp(npc.templateRef)}
        userMade={{ madeBy }}
        out={isNpcDown(view) ? { stamp: 'Down', note: npcCopy('at0HpNothingIs') } : undefined}
        renderBody={() => (
          <section
            aria-label={npcCopy('npcSheet', { name: npc.name })}
            className="su-sheet-section"
            style={SHEET}
          >
            {readOnlyProp && readOnlyNote && (
              <p role="note" style={NOTE}>
                {readOnlyNote}
              </p>
            )}
            {/* The columns every sheet shares (`SheetColumns`): an NPC carries
                nothing (its schema holds no equipment or cargo), so it has no
                sidebar and its main column takes the width. */}
            <SheetColumns
              asideLabel={npcCopy('whatCarries', { name: npc.name })}
              hero={
                <SheetHero
                  name={npc.name}
                  fields={
                    <PhotoBeside
                      photo={
                        <EntityPhoto
                          photo={npc.photo}
                          fallback={npcTemplateArt(npc.templateRef)}
                          name={npc.name}
                          onChange={
                            editable
                              ? (photo) =>
                                  useEntityStore
                                    .getState()
                                    .update('npc', npc.id, { photo }, LIVE_SHEET_MANUAL)
                              : undefined
                          }
                        />
                      }
                    >
                      <div style={FIELDS}>
                        <NpcLines
                          bayName={npc.name}
                          title={npc.position}
                          role={npc.position ?? ''}
                          name={npc.name}
                          hp={hp}
                          maxHp={npc.hitPoints}
                          keepsake={npc.keepsake ?? ''}
                          motto={npc.motto ?? ''}
                          detail={npc.description ?? ''}
                          facts={npc.facts ?? []}
                          // The name is the band's; in Edit it is also a field here.
                          identity
                          {...(editable
                            ? {
                                onNameChange: (next: string) => {
                                  if (next.trim()) patch({ name: next.trim() })
                                },
                                onKeepsakeChange: (next: string) =>
                                  patch({ keepsake: next.trim() || undefined }),
                                onMottoChange: (next: string) =>
                                  patch({ motto: next.trim() || undefined }),
                                onDetailChange: (next: string) =>
                                  patch({ description: next.trim() || undefined }),
                                onFactsChange: (next: string[]) => patch({ facts: next }),
                              }
                            : {})}
                        />
                        {traits.length > 0 && <Tags tags={traits} linkable />}
                        {crewing && (
                          <p style={NOTE}>
                            Crews {slotPhrase(crewing.slot)} on{' '}
                            <AppLink href={`/sheet/crawler/${crewing.crawlerId}`}>
                              {crewing.crawlerName}
                            </AppLink>
                            . Whoever runs that crawler assigns and unassigns its crew.
                          </p>
                        )}
                      </div>
                    </PhotoBeside>
                  }
                  vitals={
                    npc.hitPoints > 0 ? (
                      <SheetVitalGauge
                        vital="hp"
                        value={hp}
                        max={npc.hitPoints}
                        onChange={editable ? (next) => patch({ currentHP: next }) : undefined}
                        readOnly={!editable}
                      />
                    ) : undefined
                  }
                />
              }
            >
              {npcActions.length > 0 && (
                <SlabSection fold="open" title={npcCopy('actions')} count={npcActions.length}>
                  <ActionMinis
                    actions={npcActions}
                    size="compact"
                    hostName={npc.name}
                    chassisName={undefined}
                    grid
                  />
                </SlabSection>
              )}
            </SheetColumns>
          </section>
        )}
      />
      {!readOnlyProp && (
        <ShareStatusDialog
          kind="npc"
          id={npc.id}
          name={npc.name}
          gameId={npc.gameId ?? null}
          open={shareOpen}
          onOpenChange={setShareOpen}
        />
      )}
    </>
  )
}
