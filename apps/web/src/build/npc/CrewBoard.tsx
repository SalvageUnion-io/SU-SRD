/**
 * CrewBoard — design the crawler type's special NPC and each bay's
 * crew, and assign them (ADR-044; `docs/architecture/npc-builder.md`).
 *
 * The left column lists every crew slot — the type, then one per bay. A slot
 * is either filled by a built NPC (dashed, HOMEBREW) or keeps the book's crew
 * line, with a Design button. The right column is the selected slot:
 *
 *  - **designing** — the slot's own choices in data order (D3), Roll only
 *    where the data has a table (D1), position and HP fixed by the slot (D2),
 *    a live preview, then "Save and assign to Med Bay" (create, then link)
 *    or "Keep the book's line" (writes nothing). NPCs already in the crawler's
 *    container can be assigned instead — which is how a player's offered NPC
 *    reaches a Game's crawler (D7).
 *  - **assigned** — the NPC, a way to its sheet, and Unassign, which deletes
 *    the link only: the inline crew and the NPC both survive (ADR-007).
 *
 * Only whoever may write the crawler assigns or unassigns: its owner on a
 * shelf, the table runner in a Game (D7). Anyone else sees the board
 * read-only, with a note saying why. Below 48rem the slot opens in a
 * full-height modal (§5).
 */

import { useQuery } from 'convex/react'
import { containerOf, sameContainer } from 'game-domain/container'
import { slotKey } from 'game-domain/links/linkRules'
import type { Crawler } from 'game-domain/schemas/crawler'
import type { Npc } from 'game-domain/schemas/npc'
import { NpcSchema } from 'game-domain/schemas/npc'
import type { CSSProperties } from 'react'
import { useMemo, useState } from 'react'
import { nameToSlug } from 'salvageunion-reference'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import {
  Badge,
  Button,
  EmptyState,
  Entity,
  Field,
  FieldError,
  Input,
  ModalShell,
  Select,
  Slab,
  SlabSection,
  Textarea,
  toast,
  tokens,
  useMediaQuery,
} from '../../components/index'
import { UnitRow } from '../../components/shared/UnitRow'
import { WritesBlockedNotice } from '../../components/shared/WritesBlockedNotice'
import { useConnection } from '../../lib/connection/connectionContext'
import { useServerAction } from '../../lib/connection/useServerAction'
import { useCrawlers, useHydrateEntities, useNpcs, useSoftLinkList } from '../../lib/entities'
import { assignCrew } from '../../lib/links/assignLink'
import type { CrewAssignment, CrewSlotView } from '../../lib/npcs/npcModel'
import {
  assignmentFor,
  crewAssignmentsOf,
  crewSlotsOf,
  slotFromParam,
  slotParam,
} from '../../lib/npcs/npcModel'
import { npcNameGate } from '../../lib/rules/creation'
import type { UnitReading } from '../../lib/units/unitModel'
import { unitRowModel } from '../../lib/units/unitModel'
import type { CrewDraft } from '../../lib/wizard/crewFormState'
import {
  crewChoiceField,
  crewDraftToCreateInput,
  crewDraftView,
} from '../../lib/wizard/crewFormState'
import { useEntityStore } from '../../stores/entityStore'
import { npcStats } from '../roster/rowStats.model'
import { rowAppId } from '../sheet/readOnlySheetStore.model'
import { RollTableButton } from '../wizard/RollTableButton'
import { assignedCrewControls, unassignCrew } from './assignedCrewControls.model'
import { NpcCard } from './NpcCard'
import { CAPS, CAPS_LABEL, COLUMN, COLUMNS, HINT, LIST, NOTE, PENCIL, ROW } from './npcStyles.model'

/**
 * The breakpoint the NPC designer's two columns start at (`styles/npc.css`).
 * Below it the crew slot form opens in a full-height modal (§5).
 */
const WIDE_QUERY = tokens.widthAtLeast('md')

/** The Game rule, said where an assignment would be made (D7). */
const GAME_RULE =
  'In a Game, only the Mediator assigns crawler crew, because the crawler is theirs. Players design an NPC in their Training Bay and offer it by moving it into the Game.'

/** The phone modal's body: the gutter and rhythm the wide column gets from the page. */
const MODAL_BODY = {
  ...COLUMN,
  padding: tokens.space[20],
} satisfies CSSProperties

const FIELD_ROW = {
  alignItems: 'stretch',
  display: 'flex',
  gap: tokens.space[8],
} satisfies CSSProperties

type CrewBoardProps = {
  /** `&crawler=<id>` — the crawler being crewed, when the route names one. */
  crawlerId: string | undefined
  /** `&slot=<bayRef|type>` — the slot open in the panel. */
  slot: string | undefined
  /** The viewer's display name, for the preview's "Made by". */
  madeBy: string
  /** Change the crawler or the open slot (the route maps it onto the URL). */
  onSelect: (next: { crawler?: string | undefined; slot?: string | undefined }) => void
}

export function CrewBoard({ crawlerId, slot: slotArg, madeBy, onSelect }: CrewBoardProps) {
  const hydrated = useHydrateEntities(['crawler', 'npc', 'softLink'])
  const { mode, canWrite } = useConnection()
  const connected = mode === 'connected'
  const crawlers = useCrawlers()
  const games = useQuery(api.games.listMine, connected ? {} : 'skip')

  /** Whether the viewer may write this crawler: its owner on a shelf, the table runner in a Game. */
  const mayWrite = (c: Crawler) => {
    const where = containerOf(c)
    return (
      where.kind === 'shelf' || games?.find((g) => g._id === where.gameId)?.tableRunner === true
    )
  }
  const candidates = crawlers.filter((c) => mayWrite(c))
  const crawler =
    (crawlerId === undefined ? undefined : crawlers.find((c) => c.id === crawlerId)) ??
    (crawlerId === undefined && candidates.length === 1 ? candidates[0] : undefined)

  if (!hydrated) return null

  if (crawler === undefined) {
    return (
      <div style={{ ...COLUMNS, paddingTop: tokens.space[24] }}>
        <SlabSection as="h2" id="crew-pick" title="Which crawler" bodyStyle={COLUMN}>
          {crawlerId !== undefined ? (
            <EmptyState
              variant="quiet"
              body="That crawler is not one this browser holds. Open it from its sheet's Crew… link."
            />
          ) : candidates.length === 0 ? (
            <EmptyState
              variant="quiet"
              body="You have no crawler to crew here. A crawler in your Training Bay is yours to crew; in a Game, only the Mediator assigns crawler crew. Design an NPC under Any NPC and move it into the Game to offer it."
            />
          ) : (
            <Field label="Crawler" htmlFor="crew-crawler">
              <Select
                id="crew-crawler"
                value=""
                onChange={(e) => onSelect({ crawler: e.target.value || undefined })}
              >
                <option value="">Choose a crawler…</option>
                {candidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </SlabSection>
      </div>
    )
  }

  return (
    <CrewSlots
      crawler={crawler}
      writer={mayWrite(crawler)}
      canWrite={canWrite}
      selectedParam={slotArg}
      madeBy={madeBy}
      onSelect={(slot) => onSelect({ crawler: crawler.id, slot })}
    />
  )
}

function CrewSlots({
  crawler,
  writer,
  canWrite,
  selectedParam,
  madeBy,
  onSelect,
}: {
  crawler: Crawler
  /** The viewer may write this crawler (D7). */
  writer: boolean
  /** The connection allows writes at all. */
  canWrite: boolean
  selectedParam: string | undefined
  madeBy: string
  onSelect: (slot: string | undefined) => void
}) {
  const wide = useMediaQuery(WIDE_QUERY)
  const npcs = useNpcs()
  const links = useSoftLinkList()
  const where = containerOf(crawler)
  const gameId = where.kind === 'game' ? (where.gameId as Id<'games'>) : null
  const listing = useQuery(api.entities.listForGame, gameId === null ? 'skip' : { gameId })
  const members = useQuery(api.games.members, gameId === null ? 'skip' : { gameId })

  /** Other members' NPCs in this Game, read live and never cached (ADR-037). */
  const theirs = useMemo<Npc[]>(() => {
    if (listing === undefined) return []
    return listing.npcs.flatMap((row) => {
      const parsed = NpcSchema.safeParse(row.body)
      if (!parsed.success) return []
      return [{ ...parsed.data, id: row.appId ?? parsed.data.id }]
    })
  }, [listing])

  const lookupNpc = (id: string) =>
    npcs.find((n) => n.id === id) ?? theirs.find((n) => n.id === id) ?? null
  /** Who made an NPC: the viewer for their own, else its owner by display name. */
  const makerOf = (npc: Npc) => {
    if (npcs.some((own) => own.id === npc.id)) return madeBy
    const ownerId = listing?.npcs.find((row) => rowAppId(row) === npc.id)?.ownerId
    return members?.find((m) => m.userId === ownerId)?.displayName ?? 'a player'
  }
  const crew = crewAssignmentsOf(links, crawler.id, lookupNpc)
  const slots = crewSlotsOf(crawler)
  const selectedSlot = slotFromParam(selectedParam)
  const selected =
    selectedSlot === undefined ? undefined : slots.find((s) => s.key === slotKey(selectedSlot))

  /** Every NPC in the crawler's container: the ones that could be assigned. */
  const inContainer = [
    ...npcs.filter((n) => sameContainer(containerOf(n), where)),
    ...theirs.filter((n) => !npcs.some((own) => own.id === n.id)),
  ]
  const allowed = writer && canWrite
  const typeName = slots.find((s) => s.slot.kind === 'type')?.name

  /** In the modal the slot's name is the modal title, so the panel drops its own. */
  const panel = (inModal: boolean) =>
    selected === undefined ? (
      <p style={HINT}>
        {allowed
          ? 'Choose a slot to design its crew, or to see who fills it.'
          : 'Choose a slot to see who fills it.'}
      </p>
    ) : (
      <SlotPanel
        key={selected.key}
        crawler={crawler}
        slot={selected}
        assignment={assignmentFor(crew, selected.slot)}
        candidates={inContainer}
        allowed={allowed}
        writer={writer}
        madeBy={madeBy}
        makerOf={makerOf}
        gameId={gameId}
        titled={!inModal}
        onDone={() => onSelect(undefined)}
      />
    )

  return (
    <div style={{ ...COLUMNS, paddingTop: tokens.space[24] }}>
      <SlabSection as="h2" id="crew-slots" title="Crew slots" bodyStyle={COLUMN}>
        <p style={HINT}>
          {typeName
            ? 'One slot for the crawler type’s NPC, then one per bay. '
            : 'One slot per bay. '}
          An empty slot uses the book’s crew line; assigning a designed NPC replaces it, and
          unassigning brings the book’s line back.
        </p>
        {!writer && (
          <p style={NOTE}>
            Only the Mediator assigns crawler crew. Design an NPC in your Training Bay and move it
            into this Game to offer it.
          </p>
        )}
        <ul style={LIST} aria-label={`${crawler.name} crew slots`}>
          {slots.map((s) => (
            <SlotRow
              key={s.key}
              slot={s}
              assignment={assignmentFor(crew, s.slot)}
              current={selected?.key === s.key}
              allowed={allowed}
              onOpen={() => onSelect(slotParam(s.slot))}
            />
          ))}
        </ul>
      </SlabSection>

      {wide ? (
        <section style={COLUMN} aria-label="Crew slot">
          {panel(false)}
        </section>
      ) : (
        <ModalShell
          open={selected !== undefined}
          onOpenChange={(open) => {
            if (!open) onSelect(undefined)
          }}
          title={selected ? slotTitle(selected) : 'Crew slot'}
          align="top"
        >
          {/* ModalShell's Card body supplies no padding: the gutter is ours. */}
          <div style={MODAL_BODY}>{panel(true)}</div>
        </ModalShell>
      )}
    </div>
  )
}

/** "Med Bay · the Doc". */
function slotTitle(slot: CrewSlotView): string {
  return `${slot.name} · the ${slot.position}`
}

/**
 * One slot on the board, a Compact in select mode (EDL "Modes"): picking it opens
 * the slot. Filled, it is the NPC (dashed, HOMEBREW); designing, the slot's
 * position under an "Editing" seal; else the book's crew line. The slot's
 * name is its note, the HP a chip (`HP | 4`), Design the Compact's control.
 */
function SlotRow({
  slot,
  assignment,
  current,
  allowed,
  onOpen,
}: {
  slot: CrewSlotView
  assignment: CrewAssignment | undefined
  current: boolean
  allowed: boolean
  onOpen: () => void
}) {
  const npc = assignment?.npc ?? null
  const designing = !assignment && current && allowed
  const name = assignment
    ? (npc?.name ?? 'Assigned NPC unavailable')
    : designing
      ? slot.position
      : (slot.bookName ?? slot.position)
  const readings: UnitReading[] = assignment
    ? npc
      ? [
          { label: 'Role', value: npc.position ?? slot.position },
          { label: 'HP', value: npc.hitPoints },
        ]
      : []
    : [
        ...(designing || !slot.bookName ? [] : [{ label: 'Role', value: slot.position }]),
        { label: 'HP', value: slot.hitPoints },
      ]
  return (
    <li>
      <Entity
        size="compact"
        model={unitRowModel({
          kind: 'npc',
          name,
          note: slot.label,
          userMade: !!assignment && npc !== null,
          readings,
        })}
        mode={{
          kind: 'select',
          role: 'radio',
          selected: current,
          onSelect: onOpen,
          ...(designing ? { seal: 'Editing' } : {}),
          label:
            assignment && npc ? `${slot.label}: ${npc.name}` : `${slot.label}: ${slot.position}`,
        }}
        labels={
          assignment ? undefined : (
            <Badge shape="stamp" size="mini">
              {designing ? 'Designing now' : 'Book’s crew line'}
            </Badge>
          )
        }
        controls={
          !assignment && !current && allowed ? (
            <Button
              size="compact"
              variant="default"
              onClick={onOpen}
              aria-label={`Design ${slot.name} crew`}
            >
              Design
            </Button>
          ) : undefined
        }
      />
    </li>
  )
}

/** The open slot: its NPC and Unassign, or the form that designs one. */
function SlotPanel({
  crawler,
  slot,
  assignment,
  candidates,
  allowed,
  writer,
  madeBy,
  makerOf,
  gameId,
  titled = true,
  onDone,
}: {
  crawler: Crawler
  slot: CrewSlotView
  assignment: CrewAssignment | undefined
  candidates: readonly Npc[]
  allowed: boolean
  writer: boolean
  /** The viewer's name: the maker of what they design here. */
  madeBy: string
  /** Who made an NPC already built. */
  makerOf: (npc: Npc) => string
  gameId: string | null
  /** Render the slot's own heading; off inside the modal, whose title names it. */
  titled?: boolean
  onDone: () => void
}) {
  const [draft, setDraft] = useState<CrewDraft>({})
  // The form's own complaint; a failed save is `save.error`.
  const [invalid, setInvalid] = useState<string | null>(null)
  const save = useServerAction(
    () => useEntityStore.getState().create('npc', crewDraftToCreateInput(slot, draft, gameId)),
    { failure: 'The NPC could not be saved. Try again.' }
  )
  // Said by the caller as a toast: a failed assignment after a save that
  // landed has to say the NPC was saved.
  const assign = useServerAction((npcId: string) => assignCrew(npcId, crawler.id, slot.slot), {
    failure: `That NPC could not be assigned to the ${slot.name}. Try again.`,
  })
  const busy = save.pending || assign.pending
  const error = invalid ?? save.error
  const [announcement, setAnnouncement] = useState('')
  const titleId = `crew-slot-${nameToSlug(slot.key)}`

  const heading = titled ? <Slab as="h2" id={titleId} label={slotTitle(slot)} /> : null

  if (assignment) {
    const npc = assignment.npc
    const name = npc?.name ?? 'the assigned NPC'
    const unassign = () => unassignCrew(assignment.link.id, slot.name, onDone)
    const unassignLabel = `Unassign ${name} from ${slot.name}`
    return (
      <>
        {heading}
        {npc ? (
          <NpcCard
            npc={npc}
            madeBy={makerOf(npc)}
            size="compact"
            controls={assignedCrewControls(
              npc,
              allowed ? { label: unassignLabel, onClick: unassign } : undefined
            )}
          />
        ) : (
          <p style={HINT}>
            The NPC assigned here cannot be shown. It may have been deleted or moved.
          </p>
        )}
        {!allowed ? (
          <WritesBlockedNotice />
        ) : npc ? null : (
          <div style={ROW}>
            <Button variant="default" onClick={unassign}>
              {unassignLabel}
            </Button>
          </div>
        )}
        <p style={HINT}>Unassigning keeps both the NPC and the book’s crew line.</p>
      </>
    )
  }

  const view = crewDraftView(slot, draft)

  async function saveAndAssign() {
    const gate = npcNameGate(draft.Name ?? '')
    if (!gate.ok) {
      setInvalid(gate.reason ?? 'Give the NPC a name.')
      return
    }
    setInvalid(null)
    const saved = await save.run()
    if (!saved.ok) return
    const created = saved.value
    const assigned = await assign.run(created.id)
    if (!assigned.ok) {
      // The NPC stays saved: the two writes are separate on purpose (D8).
      toast.error(`${created.name} is saved, but not assigned: ${assigned.error}`)
      return
    }
    toast.success(`${created.name} crews the ${slot.name}.`)
    onDone()
  }

  async function assignExisting(npc: Npc) {
    const assigned = await assign.run(npc.id)
    if (!assigned.ok) {
      toast.error(assigned.error)
      return
    }
    toast.success(`${npc.name} crews the ${slot.name}.`)
    onDone()
  }

  if (!writer) {
    return (
      <>
        {heading}
        <p style={HINT}>
          {slot.bookName ? `${slot.bookName}, the ${slot.position}` : `The ${slot.position}`} holds
          this slot from the book&rsquo;s crew line ({slot.hitPoints} Hit Points).
        </p>
        <p style={NOTE}>{GAME_RULE}</p>
      </>
    )
  }

  return (
    <>
      {heading}
      <p style={HINT}>
        The slot fixes the template: position {slot.position}, {slot.hitPoints} Hit Points. You fill
        in what the book asks for.
      </p>
      {slot.choices.map((choice) => {
        const id = `crew-${nameToSlug(slot.key)}-${nameToSlug(choice.name)}`
        const source = choice.source
        const multiline = source?.kind === 'text' && source.multiline === true
        const table = source?.kind === 'table' ? source.rollTable : undefined
        const ownAllowed = source?.kind !== 'table' || source.orChooseOwn === true
        const value = draft[choice.name] ?? ''
        const set = (next: string) => setDraft((prev) => ({ ...prev, [choice.name]: next }))
        return (
          <Field
            key={choice.id}
            label={choice.name}
            htmlFor={id}
            required={crewChoiceField(choice.name) === 'name'}
          >
            <div style={FIELD_ROW}>
              {multiline ? (
                <Textarea
                  id={id}
                  rows={2}
                  value={value}
                  onChange={(e) => set(e.target.value)}
                  style={{ ...PENCIL, flex: 1 }}
                />
              ) : (
                <Input
                  id={id}
                  value={value}
                  readOnly={!ownAllowed}
                  onChange={(e) => set(e.target.value)}
                  style={{ ...PENCIL, flex: 1 }}
                />
              )}
              {table && (
                <RollTableButton
                  table={table}
                  ariaLabel={`Roll ${choice.name} on the ${table} table`}
                  onRoll={(rolled) => {
                    set(rolled)
                    setAnnouncement(`Rolled: ${rolled}`)
                  }}
                />
              )}
            </div>
          </Field>
        )
      })}
      <p aria-live="polite" className="su-sr-only">
        {announcement}
      </p>

      <section aria-label="Preview" style={COLUMN}>
        <NpcCard npc={view} madeBy={madeBy} size="compact" kicker={`Crawler crew · ${slot.name}`} />
      </section>

      {error && <FieldError>{error}</FieldError>}
      <div style={ROW}>
        {allowed ? (
          <Button variant="primary" disabled={busy} onClick={() => void saveAndAssign()}>
            {busy ? 'Saving…' : `Save and assign to ${slot.name}`}
          </Button>
        ) : (
          <WritesBlockedNotice />
        )}
        <Button variant="default" disabled={busy} onClick={onDone}>
          Keep the book’s line
        </Button>
      </div>

      {allowed && candidates.length > 0 && (
        <>
          <p className={CAPS_LABEL} style={CAPS}>
            Or assign an NPC already here
          </p>
          <ul style={LIST} aria-label={`NPCs that can crew the ${slot.name}`}>
            {candidates.map((npc) => (
              <li key={npc.id}>
                <UnitRow
                  kind="npc"
                  name={npc.name}
                  userMade
                  readings={npcStats(npc)}
                  controls={
                    <Button
                      size="compact"
                      variant="default"
                      disabled={busy}
                      onClick={() => void assignExisting(npc)}
                      aria-label={`Assign ${npc.name} to ${slot.name}`}
                    >
                      Assign
                    </Button>
                  }
                />
              </li>
            ))}
          </ul>
        </>
      )}

      <p style={HINT}>{GAME_RULE}</p>
    </>
  )
}
