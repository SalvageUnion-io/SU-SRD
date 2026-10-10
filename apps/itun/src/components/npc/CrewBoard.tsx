/**
 * CrewBoard — board N2: design the crawler type's special NPC and each bay's
 * crew, and assign them (ADR-043; `docs/architecture/npc-builder.md`).
 *
 * The left column lists every crew slot — the type, then one per bay. A slot
 * is either filled by a built NPC (dashed, User-made) or keeps the book's crew
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

import {
  Badge,
  Button,
  EmptyState,
  Field,
  FieldError,
  Input,
  ModalShell,
  Select,
  Slab,
  Textarea,
  toast,
  tokens,
  UserMadeStamp,
} from 'component-lib'
import { useQuery } from 'convex/react'
import type { CSSProperties, ReactNode } from 'react'
import { useMemo, useState } from 'react'
import { nameToSlug } from 'salvageunion-reference'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { useCrawlers, useHydrateEntities, useNpcs, useSoftLinkList } from '../../hooks/entities'
import { useConnection } from '../../lib/connection/connectionContext'
import { containerOf, sameContainer } from '../../lib/container'
import { assignCrew } from '../../lib/links/assignLink'
import { slotKey } from '../../lib/links/linkRules'
import type { CrewAssignment, CrewSlotView } from '../../lib/npcs/npcModel'
import {
  assignmentFor,
  crewAssignmentsOf,
  crewSlotsOf,
  slotFromParam,
  slotParam,
} from '../../lib/npcs/npcModel'
import { npcNameGate } from '../../lib/rules/creation'
import { runWrite } from '../../lib/runWrite'
import type { Crawler } from '../../lib/schemas/crawler'
import type { Npc } from '../../lib/schemas/npc'
import { NpcSchema } from '../../lib/schemas/npc'
import type { CrewDraft } from '../../lib/wizard/crewFormState'
import {
  crewChoiceField,
  crewDraftToCreateInput,
  crewDraftView,
} from '../../lib/wizard/crewFormState'
import { useActiveContainer } from '../../stores/activeContainerStore'
import { useEntityStore } from '../../stores/entityStore'
import { npcStats } from '../roster/rowStats'
import { AppLink } from '../shared/AppLink'
import { EntityRow } from '../shared/EntityRow'
import { WritesBlockedNotice } from '../shared/WritesBlockedNotice'
import { RollTableButton } from '../wizard/RollTableButton'
import { NpcCard } from './NpcCard'
import { CAPS, COLUMN, COLUMNS, HINT, LIST, NOTE, PENCIL, ROW, VISUALLY_HIDDEN } from './npcStyles'
import { useWide } from './useWide'

/** The Game rule, said where an assignment would be made (D7). */
const GAME_RULE =
  'In a Game, only the Mediator assigns crawler crew, because the crawler is theirs. Players design an NPC on their shelf and offer it by moving it into the Game.'

const SLOT_ROW_BASE = {
  alignItems: 'center',
  backgroundColor: tokens.color.paper,
  borderColor: tokens.color.ink20,
  borderStyle: 'solid',
  borderWidth: tokens.borderWidth.chrome,
  display: 'flex',
  flexWrap: 'wrap',
  gap: tokens.space[8],
  minHeight: '3rem',
  padding: `${tokens.space[6]} ${tokens.space[12]}`,
} satisfies CSSProperties

const SLOT_SELECT = {
  alignItems: 'center',
  background: 'none',
  border: 0,
  color: tokens.color.ink,
  cursor: 'pointer',
  display: 'flex',
  flex: '1 1 16rem',
  flexWrap: 'wrap',
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.caption,
  gap: tokens.space[12],
  minHeight: '2.75rem',
  minWidth: 0,
  padding: 0,
  textAlign: 'left',
} satisfies CSSProperties

const SLOT_LABEL = {
  ...CAPS,
  flex: '0 0 9rem',
  fontSize: tokens.fontSize.caption,
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
  const activeContainer = useActiveContainer()
  const crawlers = useCrawlers()
  const games = useQuery(api.games.listMine, connected ? {} : 'skip')

  /** Whether the viewer may write this crawler: its owner on a shelf, the table runner in a Game. */
  const mayWrite = (c: Crawler) => {
    const where = containerOf(c)
    return (
      where.kind === 'shelf' || games?.find((g) => g._id === where.gameId)?.tableRunner === true
    )
  }
  const candidates = crawlers.filter(
    (c) => (!connected || sameContainer(containerOf(c), activeContainer)) && mayWrite(c)
  )
  const crawler =
    (crawlerId === undefined ? undefined : crawlers.find((c) => c.id === crawlerId)) ??
    (crawlerId === undefined && candidates.length === 1 ? candidates[0] : undefined)

  if (!hydrated) return null

  if (crawler === undefined) {
    return (
      <div style={{ ...COLUMNS, paddingTop: tokens.space[24] }}>
        <section style={COLUMN} aria-labelledby="crew-pick">
          <Slab variant="solid" as="h2" id="crew-pick" label="Which crawler" />
          {crawlerId !== undefined ? (
            <EmptyState
              variant="quiet"
              body="That crawler is not one this browser holds. Open it from its sheet's Crew… link."
            />
          ) : candidates.length === 0 ? (
            <EmptyState
              variant="quiet"
              body="You have no crawler to crew here. A crawler on your shelf is yours to crew; in a Game, only the Mediator assigns crawler crew. Design an NPC under Any NPC and move it into the Game to offer it."
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
        </section>
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
  const wide = useWide()
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
    const ownerId = listing?.npcs.find((row) => (row.appId ?? '') === npc.id)?.ownerId
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

  const panel =
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
        onDone={() => onSelect(undefined)}
      />
    )

  return (
    <div style={{ ...COLUMNS, paddingTop: tokens.space[24] }}>
      <section style={COLUMN} aria-labelledby="crew-slots">
        <Slab
          variant="solid"
          as="h2"
          id="crew-slots"
          label="Crew slots"
          count={String(slots.length)}
        />
        <p style={HINT}>
          {typeName
            ? 'One slot for the crawler type’s NPC, then one per bay. '
            : 'One slot per bay. '}
          An empty slot uses the book’s crew line; assigning a designed NPC replaces it, and
          unassigning brings the book’s line back.
        </p>
        {!writer && (
          <p style={NOTE}>
            Only the Mediator assigns crawler crew. Design an NPC on your shelf and move it into
            this Game to offer it.
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
      </section>

      {wide ? (
        <section style={COLUMN} aria-label="Crew slot">
          {panel}
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
          {panel}
        </ModalShell>
      )}
    </div>
  )
}

/** "Med Bay · the Doc". */
function slotTitle(slot: CrewSlotView): string {
  return `${slot.name} · the ${slot.position}`
}

/** One slot on the board: filled (dashed, User-made), the book's line, or open. */
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
  const style: CSSProperties = current
    ? { ...SLOT_ROW_BASE, borderColor: tokens.color.ink, borderWidth: '2.5px' }
    : assignment
      ? { ...SLOT_ROW_BASE, borderColor: tokens.color.ink, borderStyle: 'dashed' }
      : SLOT_ROW_BASE

  let summary: ReactNode
  if (assignment) {
    summary = npc ? (
      <span>
        <strong>{npc.name}</strong> · {npc.position ?? slot.position} · HP {npc.hitPoints}
      </span>
    ) : (
      <span>Assigned NPC unavailable</span>
    )
  } else if (current && allowed) {
    summary = (
      <span>
        <strong>{slot.position}</strong> · designing now
      </span>
    )
  } else {
    summary = (
      <span>
        {slot.bookName && <strong>{slot.bookName} · </strong>}
        {slot.position} · HP {slot.hitPoints} · the book’s crew line
      </span>
    )
  }

  return (
    <li>
      <div style={style} aria-current={current ? 'true' : undefined}>
        <button
          type="button"
          style={SLOT_SELECT}
          onClick={onOpen}
          aria-label={
            assignment && npc ? `${slot.label}: ${npc.name}` : `${slot.label}: ${slot.position}`
          }
        >
          <span style={SLOT_LABEL}>{slot.label}</span>
          {summary}
        </button>
        {assignment ? (
          <UserMadeStamp />
        ) : current && allowed ? (
          <Badge shape="stamp" size="compact">
            Editing
          </Badge>
        ) : allowed ? (
          <Button
            size="compact"
            variant="default"
            onClick={onOpen}
            aria-label={`Design ${slot.name} crew`}
          >
            Design
          </Button>
        ) : null}
      </div>
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
  onDone: () => void
}) {
  const [draft, setDraft] = useState<CrewDraft>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const titleId = `crew-slot-${nameToSlug(slot.key)}`

  const heading = <Slab variant="solid" as="h2" id={titleId} label={slotTitle(slot)} />

  if (assignment) {
    const npc = assignment.npc
    const name = npc?.name ?? 'the assigned NPC'
    return (
      <>
        {heading}
        {npc ? (
          <>
            <NpcCard npc={npc} madeBy={makerOf(npc)} size="medium" />
            <AppLink href={`/sheet/npc/${npc.id}`}>Open {npc.name}</AppLink>
          </>
        ) : (
          <p style={HINT}>
            The NPC assigned here cannot be shown. It may have been deleted or moved.
          </p>
        )}
        {allowed ? (
          <div style={ROW}>
            <Button
              variant="default"
              onClick={() =>
                // No confirm: it is reversible bookkeeping, and the inline crew
                // and the NPC both survive (D8, ADR-007).
                runWrite(
                  () => useEntityStore.getState().delete('softLink', assignment.link.id),
                  () => {
                    toast.success(`${slot.name} is back to the book’s crew line.`)
                    onDone()
                  }
                )
              }
            >
              {`Unassign ${name} from ${slot.name}`}
            </Button>
          </div>
        ) : (
          <WritesBlockedNotice />
        )}
        <p style={HINT}>Unassigning keeps both the NPC and the book’s crew line.</p>
      </>
    )
  }

  const view = crewDraftView(slot, draft)

  async function saveAndAssign() {
    const gate = npcNameGate(draft.Name ?? '')
    if (!gate.ok) {
      setError(gate.reason ?? 'Give the NPC a name.')
      return
    }
    setError(null)
    setBusy(true)
    try {
      const created = await useEntityStore
        .getState()
        .create('npc', crewDraftToCreateInput(slot, draft, gameId))
      try {
        await assignCrew(created.id, crawler.id, slot.slot)
        toast.success(`${created.name} crews the ${slot.name}.`)
        onDone()
      } catch (err) {
        // The NPC stays saved: the two writes are separate on purpose (D8).
        toast.error(
          err instanceof Error
            ? `${created.name} is saved, but not assigned: ${err.message}`
            : `${created.name} is saved, but could not be assigned to the ${slot.name}.`
        )
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The NPC could not be saved. Try again.')
    } finally {
      setBusy(false)
    }
  }

  async function assignExisting(npc: Npc) {
    setBusy(true)
    try {
      await assignCrew(npc.id, crawler.id, slot.slot)
      toast.success(`${npc.name} crews the ${slot.name}.`)
      onDone()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `${npc.name} could not be assigned.`)
    } finally {
      setBusy(false)
    }
  }

  if (!writer) {
    return (
      <>
        {heading}
        <p style={HINT}>
          {slot.bookName ? `${slot.bookName}, the ${slot.position}` : `The ${slot.position}`} holds
          this slot from the book&rsquo;s crew line (HP {slot.hitPoints}).
        </p>
        <p style={NOTE}>{GAME_RULE}</p>
      </>
    )
  }

  return (
    <>
      {heading}
      <p style={HINT}>
        The slot fixes the template: position {slot.position}, HP {slot.hitPoints}. You fill in what
        the book asks for.
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
      <p aria-live="polite" style={VISUALLY_HIDDEN}>
        {announcement}
      </p>

      <section aria-label="Preview" style={COLUMN}>
        <NpcCard npc={view} madeBy={madeBy} size="medium" kicker={`Crawler crew · ${slot.name}`} />
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
          <p style={CAPS}>Or assign an NPC already here</p>
          <ul style={LIST} aria-label={`NPCs that can crew the ${slot.name}`}>
            {candidates.map((npc) => (
              <li key={npc.id}>
                <EntityRow
                  entityType="npc"
                  name={npc.name}
                  seal={<UserMadeStamp />}
                  stats={npcStats(npc)}
                  actions={
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
