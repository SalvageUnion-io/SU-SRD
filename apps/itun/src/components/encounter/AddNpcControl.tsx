/**
 * AddNpcControl — search/browse the reference NPC pools and add instances to
 * the encounter tray (design-review R-5).
 *
 * Candidates come from the six NPC-shaped reference schemas (npcs, squads,
 * creatures, bio-titans, vehicles, meld) and render as compact head-mode
 * ReferenceEntityCard listings with an Add button beside each. Filter by
 * schema chip, narrow by name search. The same NPC can be added any number of
 * times — every Add creates a fresh tracked instance.
 */

import { useMemo, useState } from 'react'
import { Button, FilterChip, ReferenceEntityCard } from 'component-lib'

import { ENCOUNTER_REF_SCHEMAS } from '../../lib/schemas/encounterNpc'
import type { EncounterRefSchema } from '../../lib/schemas/encounterNpc'
import { ENCOUNTER_SCHEMA_LABEL, listAllCandidates, listCandidates } from './referenceNpcs'
import type { EncounterCandidate } from './referenceNpcs'

/** Cap unfiltered listings so 'All' + empty query stays scannable. */
const MAX_RESULTS = 40

type AddNpcControlProps = {
  /** Adds one tracked instance of the candidate to the tray. */
  onAdd: (candidate: EncounterCandidate) => void | Promise<void>
}

export function AddNpcControl({ onAdd }: AddNpcControlProps) {
  const [query, setQuery] = useState('')
  const [activeSchema, setActiveSchema] = useState<EncounterRefSchema | null>(null)

  // Reference data is static — pools load once per mount (empty in tests).
  const candidates = useMemo(
    () => (activeSchema === null ? listAllCandidates() : listCandidates(activeSchema)),
    [activeSchema]
  )

  const q = query.trim().toLowerCase()
  const matches = (
    q === '' ? candidates : candidates.filter((c) => c.name.toLowerCase().includes(q))
  ).slice(0, MAX_RESULTS)

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <FilterChip
          label="All"
          active={activeSchema === null}
          onClick={() => setActiveSchema(null)}
        />
        {ENCOUNTER_REF_SCHEMAS.map((schema) => (
          <FilterChip
            key={schema}
            label={ENCOUNTER_SCHEMA_LABEL[schema]}
            active={activeSchema === schema}
            onClick={() => setActiveSchema(activeSchema === schema ? null : schema)}
          />
        ))}
      </div>

      <input
        type="text"
        name="encounter-npc-search"
        placeholder="Search NPCs, squads, creatures…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search reference NPCs"
        className="w-full rounded-[3px] border-chrome border-ink bg-paper px-3 py-2 font-body text-sm text-ink placeholder:text-wk-muted focus:outline-2 focus:outline-offset-2 focus:outline-rust"
      />

      {matches.length > 0 ? (
        <ul className="m-0 flex max-h-96 list-none flex-col gap-1.5 overflow-y-auto p-0">
          {matches.map((candidate) => (
            <li
              key={`${candidate.schema}:${candidate.slug}`}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2"
            >
              <ReferenceEntityCard data={candidate.entity} mode="listing" />
              <Button
                size="sm"
                variant="primary"
                aria-label={`Add ${candidate.name} to the tray`}
                title={`Track a new ${ENCOUNTER_SCHEMA_LABEL[candidate.schema]} instance of ${candidate.name}.`}
                onClick={() => {
                  void onAdd(candidate)
                }}
              >
                Add
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="m-0 font-body text-sm text-wk-muted">
          {candidates.length === 0
            ? 'No reference NPCs available.'
            : 'No matches — try a different name or schema.'}
        </p>
      )}
      {candidates.length > MAX_RESULTS && q === '' && (
        <p className="m-0 font-body text-xs text-wk-muted">
          Showing the first {MAX_RESULTS} — search or pick a schema chip to narrow.
        </p>
      )}
    </div>
  )
}
