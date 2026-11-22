/**
 * NpcSheet — a built NPC's own page, `/npcs/:id` (ADR-044;
 * `docs/architecture/npc-builder.md` §4.2), on the shell every Live Sheet
 * shares (hard rule R11): `LiveSheet`'s chapter band, Read | Edit and the
 * corner actions (Share, then Move, Make a copy and Delete under "⋯"), a `SheetHero`
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
 * Edit gives the fields, the HP track and the photo control back, and "Edit
 * design", which opens the designer on this NPC (`NpcRedesignPage`). A crewmate's
 * NPC, read live from the Game's listing, and a shared one at `/p/npc/:id`
 * render read-only with no toggle, and say why.
 */

import type { Npc } from 'game-domain/schemas/npc'
import type { CrewSlot } from 'game-domain/schemas/softLink'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import { toEntityModel } from 'salvageunion-reference'
import {
  ActionMinis,
  Button,
  InlineRef,
  SlabSection,
  Tags,
  toast,
  tokens,
  traitTags,
} from '../../components/index'
import { EntityPhoto } from '../../components/shared/EntityPhoto'
import type { Confirm } from '../../components/shared/useConfirm'
import { STAYS } from '../../lib/copiedToast'
import { copyBeside, namesOn } from '../../lib/copyEntity'
import { ROW_ACTION_COPY } from '../../lib/games/rowActionCopy'
import type { NpcView } from '../../lib/npcs/npcModel'
import {
  isNpcDown,
  isRedesignable,
  npcAsReferenceEntity,
  npcCurrentHP,
  npcDesignHref,
  resolveNpcAction,
  slotPhrase,
} from '../../lib/npcs/npcModel'
import { npcTemplateArt } from '../../lib/photos/defaultArt'
import { runWrite } from '../../lib/runWrite'
import { npcCopy } from '../../messages/build-npc'
import { KIT_PATH } from '../../play/games/prep/gamePrep.model'
import { useEncounters } from '../../replica/collections'
import { LIVE_SHEET_MANUAL } from '../../replica/provenance'
import { isSignedIn } from '../../replica/sync'
import { useSync } from '../../replica/syncContext'
import { useUnits } from '../../replica/units'
import { MoveToContainerControl } from '../entityContainer/MoveToContainerControl'
import { encountersFielding } from '../prep/encounter.model'
import { useEncounterGame } from '../prep/useEncounterGame'
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
import { deleteNpcDesign } from './redesign.model'

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
  /** Open a copy this page just made (its toast's "Open the copy"). */
  onOpenCopy?: (npcId: string) => void
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

/** How long the copy's toast stays: long enough to reach for "Open the copy". */
const COPY_TOAST_MS = 20_000

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
  onOpenCopy,
  readOnlyNote,
}: NpcSheetProps) {
  const [shareOpen, setShareOpen] = useState(false)
  const { canWrite, status } = useSync()
  const sheetMode = useSheetMode()
  const view: NpcView = npc
  // As on every sheet (`Sheet.tsx`): Read until Edit is pressed, and nothing
  // writes while the server of record cannot be reached.
  const writesBlocked = !canWrite && status !== 'syncing'
  const editing = sheetMode === null || sheetMode.editing
  const editable = !readOnlyProp && !writesBlocked && editing

  function patch(fields: Partial<Npc>) {
    runWrite(() => useUnits.getState().update('npc', npc.id, fields, LIVE_SHEET_MANUAL))
  }

  /** Make a copy: a new, separate NPC (glossary 5), in the Game this one is in (MD3-12). */
  function copy() {
    runWrite(async () => {
      const taken = namesOn(useUnits.getState().list('npc'))
      const created = await useUnits
        .getState()
        .create('npc', copyBeside(npc, npc.name, taken) as never)
      toast.success(npcCopy('madeACopy', { name: npc.name }), {
        // With the way to the copy it stays until dismissed (r4 E19).
        ...(onOpenCopy
          ? {
              ...STAYS,
              action: { label: npcCopy('openTheCopy'), onClick: () => onOpenCopy(created.id) },
            }
          : { duration: COPY_TOAST_MS }),
      })
    })
  }

  /** Delete asks once, naming the encounters the NPC leaves with it (MD3-08). */
  async function remove() {
    // A list that will not load names none; the delete still clears what it finds.
    await useEncounters
      .getState()
      .hydrate()
      .catch(() => undefined)
    const fielding = encountersFielding(useEncounters.getState().encounters, npc.id)
    const asked = ROW_ACTION_COPY.deleteNpc(
      npc.name,
      fielding.map((encounter) => encounter.name)
    )
    confirm?.({
      ...asked,
      body: crewing
        ? [
            npcCopy('deleteBodyCrewing', {
              name: npc.name,
              slot: slotPhrase(crewing.slot),
              crawler: crewing.crawlerName,
            }),
            ...asked.body.slice(1),
          ]
        : asked.body,
      onConfirm: async () => {
        await deleteNpcDesign(npc.id)
        onDeleted?.()
      },
    })
  }

  // The Game it is kept in, when the viewer runs it: the band's chip, and the
  // way back is that Game's Prep (as an encounter's sheet, MD2-14).
  const inGame = useEncounterGame(npc, isSignedIn(status) && !readOnlyProp)
  const modeToggle =
    sheetMode !== null && !readOnlyProp && !writesBlocked ? (
      <>
        {/* The way back to where it is kept: its Game's Prep, else the Kit (ADR-067 §5). */}
        <Button href={inGame?.href ?? KIT_PATH} back variant="ink" size="compact">
          {inGame ? npcCopy('gamePrep') : npcCopy('mediatorsKit')}
        </Button>
        {/* The way into the designer, its stats, role and actions (MD2-03), in
            Sheet view too: a fresh copy opens there (MD3-06). */}
        {isRedesignable(npc) && (
          <Button
            href={npcDesignHref(npc.id)}
            size="compact"
            aria-label={npcCopy('editDesignOf', { name: npc.name })}
          >
            {npcCopy('editDesign')}
          </Button>
        )}
        <SheetModeToggle mode={sheetMode} kind="NPC" />
      </>
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
          {!writesBlocked && (
            <Button
              variant="ghost"
              onClick={copy}
              aria-label={npcCopy('makeACopyOf', { name: npc.name })}
            >
              {npcCopy('makeACopy')}
            </Button>
          )}
          <Button
            variant="ghost"
            onClick={() => void remove()}
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
  const traits = traitTags(toEntityModel(npcAsReferenceEntity(view)).traits)

  return (
    <>
      <LiveSheet
        variant="npc"
        name={npc.name}
        band={{ actions: modeToggle, game: inGame }}
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
                                  useUnits
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
                            {npcCopy('crewsSlotOn', { slot: slotPhrase(crewing.slot) })}{' '}
                            <InlineRef href={`/crawlers/${crewing.crawlerId}`}>
                              {crewing.crawlerName}
                            </InlineRef>
                            {npcCopy('whoeverRunsThatCrawler')}
                          </p>
                        )}
                      </div>
                    </PhotoBeside>
                  }
                  vitals={
                    npc.hitPoints > 0 ? (
                      <SheetVitalGauge
                        // One built from a mech-scale denizen takes Structure Points (MD2-05).
                        vital={npc.damageType === 'SP' ? 'sp' : 'hp'}
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
