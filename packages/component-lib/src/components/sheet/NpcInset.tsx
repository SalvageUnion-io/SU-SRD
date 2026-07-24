/**
 * NpcInset — crew-lead card rendered inside a crawler bay card's `expand`
 * slot (design-spec §2.10 `.npc`, plan 4.6). Each bay is run by its own crew
 * lead (rules C11: name, keepsake, detail, 4 HP).
 *
 * Composes the shared `Inset` (style-unification pass §3 — the boxed
 * sub-panel: 1.5px ink frame on paper, ink head bar). Head bar, left to right:
 * a pink tag carrying the lead's SRD role as a definite-article title ("THE
 * DOC"), the lead's (editable) name, then the HP `Stat` riding the right edge.
 * Body = the quiet Keepsake/Motto/Detail/Facts id lines.
 *
 * The head bar previously read `[CREW] Name … greaser`: a generic tag, and the
 * role as muted right-edge text. The role is the informative half of that pair
 * and the literal "Crew" was restating the inset's own position inside a bay
 * card, so the role took the tag and HP took the freed right edge.
 *
 * Persistence stays with the caller: name/HP/detail/facts patch the crawler's
 * bay entry; keepsake persists through the bay's SRD freeform 'Keepsake'
 * choice (see CrawlerSheet). Handler absence IS the read-only encoding —
 * omit a field's handler and it renders plain text, no edit affordances.
 */

import { Stat } from '../shared/Stat'
import { cn } from '../../utils/cn'
import type { ReactNode } from 'react'

import { Inset } from '../shared/Inset'
import { InlineEditField } from '../chrome/InlineEditField'
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
}

/**
 * One `label: value` line of the inset. The same four-line shape was written
 * out four times; this is that shape once. Deliberately NOT `KvRow` — that
 * primitive carries a 120px rail, bottom rules and larger muted type, which
 * would visibly redesign the inset rather than dedupe it.
 */
function NpcRow({
  label,
  grow = false,
  plain = false,
  children,
}: {
  label: string
  /** Let the value cell take the remaining width (multiline / editor cells). */
  grow?: boolean
  /** Skip the prose treatment — the cell hosts its own component. */
  plain?: boolean
  children: ReactNode
}) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="shrink-0 font-cond text-micro font-bold uppercase leading-none tracking-caps-wide text-ink">
        {label}
      </dt>
      <dd
        className={cn(
          'm-0 min-w-0',
          grow && 'flex-1',
          !plain && 'font-body text-note leading-snug text-ink-2'
        )}
      >
        {children}
      </dd>
    </div>
  )
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
}: NpcInsetProps) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: a labeled group (not a landmark) names the crew-lead inset so multiple insets per crawler stay distinguishable; Inset exposes no aria-label of its own, and a <section> here would become a region landmark once named
    <div role="group" aria-label={`${bayName} crew lead`}>
      <Inset
        tone="crawler"
        // The head-bar tag is the lead's SRD ROLE, definite-article'd — "THE
        // DOC", not a generic "CREW" keyword. The tag slot already reads as
        // "what this person is", so the role belongs there and the literal
        // "Crew" said nothing the inset's position inside a bay card didn't.
        tag={title ? `The ${title}` : undefined}
        label={
          onNameChange ? (
            <InlineEditField
              value={name}
              onSave={(next) => onNameChange(String(next))}
              type="text"
              ariaLabel={`Edit ${bayName} crew name`}
              // The head bar is ink — the readout has to invert with it. A
              // `text-paper` className could not do this: it lands on the
              // wrapper, leaving the readout's own `text-ink` standing (which
              // is exactly how this rendered black on black).
              tone="paper"
            />
          ) : (
            name || '—'
          )
        }
        // HP rides the head bar's right edge — the vital is the thing you read
        // and poke most, so it sits on the bar rather than leading the body.
        headRight={
          maxHp > 0 ? (
            <Stat
              label="HP"
              value={hp}
              max={maxHp}
              size="mini"
              mode={onHpChange ? 'edit' : 'read'}
              onChange={onHpChange}
            />
          ) : undefined
        }
        bodyClassName="flex flex-wrap items-start gap-3"
      >
        <dl className="m-0 min-w-0 flex-1 space-y-1.5">
          <NpcRow label="Keepsake">
            {onKeepsakeChange ? (
              <InlineEditField
                value={keepsake}
                onSave={(next) => onKeepsakeChange(String(next))}
                type="text"
                ariaLabel={`Edit ${bayName} crew keepsake`}
              />
            ) : (
              keepsake || '—'
            )}
          </NpcRow>
          <NpcRow label="Motto">
            {onMottoChange ? (
              <InlineEditField
                value={motto}
                onSave={(next) => onMottoChange(String(next))}
                type="text"
                ariaLabel={`Edit ${bayName} crew motto`}
              />
            ) : (
              motto || '—'
            )}
          </NpcRow>
          <NpcRow label="Detail" grow>
            {onDetailChange ? (
              <InlineEditField
                multiline
                value={detail}
                onSave={(next) => onDetailChange(String(next))}
                ariaLabel={`Edit ${bayName} crew detail`}
                placeholder="Add a detail…"
              />
            ) : (
              detail || '—'
            )}
          </NpcRow>
          {(onFactsChange !== undefined || facts.length > 0) && (
            <NpcRow label="Facts" grow plain>
              <NpcFactsEditor
                facts={facts}
                onChange={(next) => onFactsChange?.(next)}
                npcLabel={`${bayName} crew`}
                readOnly={onFactsChange === undefined}
              />
            </NpcRow>
          )}
        </dl>
      </Inset>
    </div>
  )
}
