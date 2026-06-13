/**
 * NpcInset — crew-lead card rendered inside a crawler bay card's `expand`
 * slot (design-spec §2.10 `.npc`, plan 4.6). Each bay is run by its own crew
 * lead (rules C11: name, keepsake, detail, 4 HP).
 *
 * Anatomy: 1.5px ink frame on paper; black head bar with a pink 'CREW' tag,
 * the lead's (editable) name and their SRD role title; body = sm HP StatBlock
 * (tone hp, pip click-to-set per §4.5) beside quiet Keepsake/Detail/Facts id
 * lines.
 *
 * Persistence stays with the caller: name/HP/detail/facts patch the crawler's
 * bay entry; keepsake persists through the bay's SRD freeform 'Keepsake'
 * choice (see CrawlerSheet). readOnly renders plain text, no edit affordances.
 */

import { StatBlock } from 'suref-react'

import { InlineEditField } from './InlineEditField'
import { InlineEditTextArea } from './InlineEditTextArea'
import { NpcFactsEditor } from './NpcFactsEditor'

type NpcInsetProps = {
  /** Bay name — disambiguates aria-labels when several insets render at once. */
  bayName: string
  /** SRD crew role (npc.position), e.g. 'Greaser'. Read-only. */
  title?: string
  name: string
  hp: number
  maxHp: number
  keepsake: string
  motto: string
  detail: string
  facts: ReadonlyArray<string>
  onNameChange?: (next: string) => void
  onHpChange?: (next: number) => void
  onKeepsakeChange?: (next: string) => void
  onMottoChange?: (next: string) => void
  onDetailChange?: (next: string) => void
  onFactsChange?: (next: string[]) => void
  readOnly?: boolean
}

export function NpcInset({
  bayName,
  title,
  name,
  hp,
  maxHp,
  keepsake,
  motto,
  detail,
  facts,
  onNameChange,
  onHpChange,
  onKeepsakeChange,
  onMottoChange,
  onDetailChange,
  onFactsChange,
  readOnly = false,
}: NpcInsetProps) {
  const editable = !readOnly

  return (
    <div
      aria-label={`${bayName} crew lead`}
      className="overflow-hidden rounded-[2px] border-[1.5px] border-ink bg-paper"
    >
      {/* Black head bar: CREW tag + name + role title */}
      <div className="flex flex-wrap items-center gap-2 bg-ink px-2 py-1.5">
        <span className="rounded-[1px] bg-crawler px-1.5 pb-px pt-[2px] font-cond text-[8px] font-bold uppercase leading-none tracking-[0.14em] text-su-white">
          Crew
        </span>
        <span className="min-w-0 font-cond text-[15px] font-bold uppercase leading-none text-su-white">
          {editable && onNameChange ? (
            <InlineEditField
              value={name}
              onSave={(next) => onNameChange(String(next))}
              type="text"
              ariaLabel={`Edit ${bayName} crew name`}
              className="text-su-white"
            />
          ) : (
            name || '—'
          )}
        </span>
        {title && (
          <span className="ml-auto font-cond text-[9.5px] uppercase leading-none tracking-[0.08em] text-su-white/60">
            {title}
          </span>
        )}
      </div>

      {/* Body: HP block + id lines */}
      <div className="flex flex-wrap items-start gap-[11px] p-2.5">
        {maxHp > 0 && (
          <StatBlock
            code="HP"
            size="sm"
            stat="hp"
            max={maxHp}
            value={hp}
            onChange={editable ? onHpChange : undefined}
            editable={editable && onHpChange !== undefined}
          />
        )}

        <dl className="m-0 min-w-0 flex-1 space-y-1.5">
          <div className="flex items-baseline gap-1.5">
            <dt className="shrink-0 font-cond text-[9px] font-bold uppercase leading-none tracking-[0.1em] text-ink">
              Keepsake
            </dt>
            <dd className="m-0 min-w-0 font-body text-[11.5px] leading-snug text-ink-2">
              {editable && onKeepsakeChange ? (
                <InlineEditField
                  value={keepsake}
                  onSave={(next) => onKeepsakeChange(String(next))}
                  type="text"
                  ariaLabel={`Edit ${bayName} crew keepsake`}
                />
              ) : (
                keepsake || '—'
              )}
            </dd>
          </div>
          <div className="flex items-baseline gap-1.5">
            <dt className="shrink-0 font-cond text-[9px] font-bold uppercase leading-none tracking-[0.1em] text-ink">
              Motto
            </dt>
            <dd className="m-0 min-w-0 font-body text-[11.5px] leading-snug text-ink-2">
              {editable && onMottoChange ? (
                <InlineEditField
                  value={motto}
                  onSave={(next) => onMottoChange(String(next))}
                  type="text"
                  ariaLabel={`Edit ${bayName} crew motto`}
                />
              ) : (
                motto || '—'
              )}
            </dd>
          </div>
          <div className="flex items-baseline gap-1.5">
            <dt className="shrink-0 font-cond text-[9px] font-bold uppercase leading-none tracking-[0.1em] text-ink">
              Detail
            </dt>
            <dd className="m-0 min-w-0 flex-1 font-body text-[11.5px] leading-snug text-ink-2">
              {editable && onDetailChange ? (
                <InlineEditTextArea
                  value={detail}
                  onSave={onDetailChange}
                  ariaLabel={`Edit ${bayName} crew detail`}
                  placeholder="Add a detail…"
                />
              ) : (
                detail || '—'
              )}
            </dd>
          </div>
          {(editable || facts.length > 0) && (
            <div className="flex items-baseline gap-1.5">
              <dt className="shrink-0 font-cond text-[9px] font-bold uppercase leading-none tracking-[0.1em] text-ink">
                Facts
              </dt>
              <dd className="m-0 min-w-0 flex-1">
                <NpcFactsEditor
                  facts={facts}
                  onChange={(next) => onFactsChange?.(next)}
                  npcLabel={`${bayName} crew`}
                  readOnly={readOnly || onFactsChange === undefined}
                />
              </dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  )
}
