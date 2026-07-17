/**
 * EncounterNpcCard — one tracked NPC instance on the encounter tray
 * (design-review R-5). Visual anatomy follows the crawler-bay NpcInset:
 * 1.5px ink frame on paper, black head bar with a schema tag + editable
 * instance name, body = HP/SP StatBlock beside condition ticks and the
 * per-NPC Mediator roll row.
 *
 * All live-play writes (HP, conditions, Mediator rolls) go write-through to
 * the encounter store; Remove deletes the instance after a confirm.
 */

import { useMemo, useState } from 'react'
import { Btn, MiniBtn, ModalShell, Stat, useDetailModal } from 'suref-react'

import type { Roll } from '../../lib/rules/heatCheck'
import type { FindRollTable } from '../../lib/rules/mediatorTables'
import type { EncounterNpc, MediatorRollResult } from '../../lib/schemas/encounterNpc'
import type { useEncounterStore } from '../../stores/encounterStore'
import { DisplayCard } from 'suref-react'
import { InlineEditField } from '../sheet/InlineEditField'
import { MediatorRollControl } from './MediatorRollControl'
import { ENCOUNTER_SCHEMA_LABEL, resolveCandidate } from './referenceNpcs'

type EncounterNpcCardProps = {
  npc: EncounterNpc
  /** Injectable store — defaults to useEncounterStore at the call site. */
  store: typeof useEncounterStore
  /** Injectable d20 roller for the Mediator rolls. */
  roll?: Roll
  /** Injectable roll-table lookup for the Mediator rolls. */
  findTable?: FindRollTable
}

export function EncounterNpcCard({ npc, store, roll, findTable }: EncounterNpcCardProps) {
  const storeState = store()
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [conditionDraft, setConditionDraft] = useState('')

  // Resolve the reference entity for the detail modal (static data — resolve
  // once per slug; undefined when the lookup drifts or data isn't loaded).
  const refEntity = useMemo(
    () => resolveCandidate(npc.refSchema, npc.refSlug),
    [npc.refSchema, npc.refSlug]
  )
  const { control: detailControl, modal: detailModal } = useDetailModal(refEntity)

  async function patch(fields: Partial<EncounterNpc>) {
    await storeState.update(npc.id, fields)
  }

  function handleHpChange(next: number) {
    void patch({ currentHp: Math.max(0, Math.min(npc.maxHp, next)) })
  }

  function handleRollResult(result: MediatorRollResult) {
    void patch({ lastMediatorRoll: result })
  }

  function addCondition() {
    const next = conditionDraft.trim()
    if (next === '') return
    setConditionDraft('')
    void patch({ conditions: [...npc.conditions, next] })
  }

  function removeCondition(index: number) {
    void patch({ conditions: npc.conditions.filter((_, i) => i !== index) })
  }

  const downed = npc.maxHp > 0 && npc.currentHp === 0

  return (
    <>
      <DisplayCard
        headerBg="bg-ink"
        bodyPadding="p-2.5"
        // Head bar: schema tag + instance name + reference name; Details/Remove ride the right slot.
        headerContent={
          <>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="rounded-[1px] bg-rust px-1.5 pb-px pt-[2px] font-cond text-nano font-bold uppercase leading-none tracking-caps-wide text-paper">
                {ENCOUNTER_SCHEMA_LABEL[npc.refSchema]}
              </span>
              <span className="min-w-0 font-cond text-lede font-bold uppercase leading-none text-paper">
                <InlineEditField
                  value={npc.name}
                  onSave={(next) => void patch({ name: String(next) })}
                  type="text"
                  ariaLabel={`Edit ${npc.name} instance name`}
                  className="text-paper"
                />
              </span>
              {npc.name !== npc.refName && (
                <span className="font-cond text-micro uppercase leading-none tracking-caps text-paper/60">
                  {npc.refName}
                </span>
              )}
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-1.5">
              {refEntity && (
                <MiniBtn aria-label={`View ${npc.refName} details`} onClick={detailControl.onClick}>
                  Details
                </MiniBtn>
              )}
              <MiniBtn
                aria-label={`Remove ${npc.name} from the tray`}
                onClick={() => setConfirmRemove(true)}
              >
                Remove
              </MiniBtn>
            </div>
          </>
        }
      >
        {/* Body: HP/SP block + conditions + Mediator rolls */}
        <div className="flex flex-wrap items-start gap-3">
          {npc.maxHp > 0 && (
            <Stat
              label={npc.statKind === 'sp' ? 'SP' : 'HP'}
              value={npc.currentHp}
              max={npc.maxHp}
              compact
              mode="edit"
              onChange={handleHpChange}
            />
          )}

          <div className="min-w-0 flex-1 space-y-2">
            {downed && (
              <p
                className="m-0 font-cond text-xs font-bold uppercase text-status-bad"
                role="status"
              >
                {npc.statKind === 'sp' ? 'Destroyed / disabled' : 'Down'} — Mediator&rsquo;s call
              </p>
            )}

            {/* Condition ticks */}
            <div>
              <span className="font-cond text-micro font-bold uppercase leading-none tracking-widest text-ink">
                Conditions
              </span>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {npc.conditions.map((condition, index) => (
                  <span
                    // biome-ignore lint/suspicious/noArrayIndexKey: conditions are free-form strings that may repeat; value+index is the most stable key available and chips hold no state
                    key={`${condition}-${index}`}
                    className="inline-flex items-center gap-1 rounded-[2px] border-chrome border-status-warn bg-paper px-1.5 py-0.5 font-cond text-xs font-semibold uppercase text-rust"
                  >
                    {condition}
                    {/* 24px hit area (WCAG 2.5.8) — negative margin keeps the
                      pill visually compact while the target stays tappable. */}
                    <button
                      type="button"
                      aria-label={`Clear ${condition} on ${npc.name}`}
                      onClick={() => removeCondition(index)}
                      className="-my-1 -mr-1 inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-[2px] leading-none text-rust hover:bg-status-warn/20 hover:text-status-bad"
                    >
                      ×
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  value={conditionDraft}
                  onChange={(e) => setConditionDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addCondition()
                    }
                  }}
                  placeholder="Add condition…"
                  aria-label={`Add condition to ${npc.name}`}
                  className="w-32 rounded-[2px] border-chrome border-ink/40 bg-paper px-1.5 py-0.5 font-body text-xs text-ink placeholder:text-wk-muted focus:border-ink focus:outline-none"
                />
                <MiniBtn
                  aria-label={`Confirm new condition for ${npc.name}`}
                  onClick={addCondition}
                  disabled={conditionDraft.trim() === ''}
                >
                  Add
                </MiniBtn>
              </div>
            </div>

            {/* Per-NPC Mediator rolls (persisted on the instance) */}
            <MediatorRollControl
              scopeLabel={npc.name}
              compact
              lastResult={npc.lastMediatorRoll ?? null}
              onResult={handleRollResult}
              roll={roll}
              findTable={findTable}
            />
          </div>
        </div>
      </DisplayCard>

      <ModalShell
        open={confirmRemove}
        onOpenChange={(next) => {
          if (!next) setConfirmRemove(false)
        }}
        title={`Remove ${npc.name}?`}
        headerBg="bg-su-rust"
        maxWidth="max-w-md"
        align="center"
      >
        <div className="flex flex-col gap-4 bg-paper p-5">
          <div className="font-body text-sm text-wk-muted">
            Removes this tracked instance from the tray. The reference{' '}
            {ENCOUNTER_SCHEMA_LABEL[npc.refSchema]} itself is unaffected.
          </div>
          <div className="flex justify-end gap-2">
            <Btn variant="ghost" size="sm" onClick={() => setConfirmRemove(false)}>
              Cancel
            </Btn>
            <Btn
              variant="danger"
              size="sm"
              onClick={() => {
                setConfirmRemove(false)
                void storeState.delete(npc.id)
              }}
            >
              Remove
            </Btn>
          </div>
        </div>
      </ModalShell>

      {detailModal}
    </>
  )
}
