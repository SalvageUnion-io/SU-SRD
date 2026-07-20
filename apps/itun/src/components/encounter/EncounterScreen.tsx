/**
 * EncounterScreen — the local GM encounter tray (design-review R-5).
 *
 * Three surfaces on one page:
 *   1. Global Mediator tables (Reaction / Morale / Retreat) — HeatCheckControl-
 *      style roll buttons + readout, for whole-group rolls (result held in
 *      page state; per-NPC rolls persist on the instance instead).
 *   2. Add NPCs — search/browse the six reference NPC schemas as compact
 *      head-mode listings; every Add creates a tracked instance.
 *   3. The tray — one EncounterNpcCard per tracked instance with live HP/SP,
 *      condition ticks, per-NPC Mediator rolls, and Remove.
 *
 * Local-first: instances persist to IndexedDB via encounterStore and are
 * workspace-scoped through the same WorkspaceSwitcher the roster uses. There is
 * always a current workspace (no cross-workspace "All Builds"), so every new
 * instance is stamped with it.
 */

import { useState } from 'react'
import { Users } from 'lucide-react'
import { EmptyState } from 'component-lib'

import { setActiveWorkspaceId, useActiveWorkspaceId } from '../../hooks/queries'
import { useHydrateOnMount } from '../../hooks/queries/useHydrateEntities'
import type { Roll } from '../../lib/rules/heatCheck'
import type { FindRollTable } from '../../lib/rules/mediatorTables'
import type { MediatorRollResult } from '../../lib/schemas/encounterNpc'
import { useEncounterStore } from '../../stores/encounterStore'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { DisplayCard } from 'component-lib'
import { WorkspaceSwitcher } from '../workspace/WorkspaceSwitcher'
import { AddNpcControl } from './AddNpcControl'
import { EncounterNpcCard } from './EncounterNpcCard'
import { MediatorRollControl } from './MediatorRollControl'
import type { EncounterCandidate } from './referenceNpcs'

type EncounterScreenProps = {
  /** Injectable store — defaults to useEncounterStore. */
  store?: typeof useEncounterStore
  /** Injectable d20 roller for all Mediator rolls on the page. */
  roll?: Roll
  /** Injectable roll-table lookup for all Mediator rolls on the page. */
  findTable?: FindRollTable
}

/** Section frame: a DisplayCard panel as an h2 document-outline section. */
function Section({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <section>
      <DisplayCard
        headerBg="bg-ink"
        headerContent={
          <>
            <h2 className="m-0 font-cond text-xs font-bold uppercase tracking-caps text-paper">
              {title}
            </h2>
            {hint && (
              <span className="min-w-0 truncate font-cond text-xs uppercase text-paper/60">
                {hint}
              </span>
            )}
          </>
        }
        bodyPadding="px-3 py-2.5"
      >
        {children}
      </DisplayCard>
    </section>
  )
}

export function EncounterScreen({
  store = useEncounterStore,
  roll,
  findTable,
}: EncounterScreenProps) {
  const storeState = store()
  /** The current workspace (global, persisted) — always a concrete id. */
  const activeWorkspaceId = useActiveWorkspaceId()
  /** Whole-group roll result — page state, not persisted (per-NPC rolls are). */
  const [groupResult, setGroupResult] = useState<MediatorRollResult | null>(null)

  // Imperative hydrate — WorkspaceSwitcher owns the reactive subscription.
  const hydrated = useHydrateOnMount(() =>
    Promise.all([storeState.hydrate(), useWorkspaceStore.getState().hydrate()])
  )

  const npcs = storeState.listForWorkspace(activeWorkspaceId)

  async function handleAdd(candidate: EncounterCandidate) {
    // Number repeat instances of the same reference NPC: 'Raider', 'Raider 2', …
    // The suffix derives from the MAX existing numeric suffix, not the sibling
    // COUNT — counting would mint a duplicate after a mid-sequence removal
    // (add ×3, remove 'Raider 2', add again → count says 'Raider 3' twice).
    const siblings = storeState
      .listForWorkspace(activeWorkspaceId)
      .filter((n) => n.refSlug === candidate.slug && n.refSchema === candidate.schema)
    let maxSuffix = 0
    for (const sibling of siblings) {
      if (sibling.name === candidate.name) {
        maxSuffix = Math.max(maxSuffix, 1)
      } else if (sibling.name.startsWith(`${candidate.name} `)) {
        const suffix = Number(sibling.name.slice(candidate.name.length + 1))
        if (Number.isInteger(suffix) && suffix > 1) maxSuffix = Math.max(maxSuffix, suffix)
      }
    }
    await storeState.create({
      schemaVersion: 1,
      workspaceId: activeWorkspaceId,
      refSchema: candidate.schema,
      refSlug: candidate.slug,
      refName: candidate.name,
      name: maxSuffix > 0 ? `${candidate.name} ${maxSuffix + 1}` : candidate.name,
      currentHp: candidate.maxHp,
      maxHp: candidate.maxHp,
      statKind: candidate.statKind,
      conditions: [],
    })
  }

  return (
    <main className="min-h-screen bg-wk-bg px-4 py-5 sm:px-8 sm:py-10 lg:px-12">
      <div className="border-b-2 border-ink pb-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="m-0 flex items-center gap-2 font-cond text-xl font-bold uppercase tracking-caps-tight text-ink">
            Encounter Tray
            <span className="inline-block rounded bg-rust px-1.5 py-0.5 font-cond text-[11px] font-bold uppercase leading-none tracking-caps text-paper">
              Alpha
            </span>
          </h1>
          <WorkspaceSwitcher
            activeWorkspaceId={activeWorkspaceId}
            onSelect={setActiveWorkspaceId}
          />
        </div>
        <p className="mb-0 mt-2 max-w-2xl font-body text-sm text-wk-muted">
          Track reference NPCs through a fight — HP/SP, conditions, and the Mediator&rsquo;s
          Reaction, Morale, and Retreat tables. Everything stays on this device.
        </p>
      </div>

      <div className="mt-5 grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        {/* Left: the tray */}
        <div className="flex flex-col gap-3">
          <Section title="Tracked NPCs" hint={`${npcs.length} in play`}>
            {!hydrated ? (
              // Same pulse-skeleton idiom as DashboardSkeleton/SheetSkeleton:
              // placeholder rows shaped like the NPC cards they stand in for.
              <div role="status" aria-label="Loading encounter" className="animate-pulse">
                <div className="flex flex-col gap-2.5">
                  <div className="h-16 rounded-[3px] border-chrome border-ink/15 bg-ink/10" />
                  <div className="h-16 rounded-[3px] border-chrome border-ink/15 bg-ink/10" />
                </div>
              </div>
            ) : npcs.length === 0 ? (
              <EmptyState
                variant="quiet"
                icon={<Users className="size-7 text-wk-muted" aria-hidden="true" />}
                body="No NPCs in play — add some from the reference lists."
              />
            ) : (
              <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
                {npcs.map((npc) => (
                  <li key={npc.id}>
                    <EncounterNpcCard npc={npc} store={store} roll={roll} findTable={findTable} />
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        {/* Right rail: group rolls + add */}
        <div className="flex flex-col gap-3">
          <Section title="Mediator Tables" hint="whole group">
            <MediatorRollControl
              scopeLabel="the encounter"
              lastResult={groupResult}
              onResult={setGroupResult}
              roll={roll}
              findTable={findTable}
            />
          </Section>

          <Section title="Add NPCs" hint="reference data">
            <AddNpcControl onAdd={handleAdd} />
          </Section>
        </div>
      </div>
    </main>
  )
}
