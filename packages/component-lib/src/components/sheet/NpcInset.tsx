/**
 * NpcInset — crew-lead card rendered inside a crawler bay card's `expand`
 * slot (design-spec §2.10 `.npc`, plan 4.6). Each bay is run by its own crew
 * lead (rules C11: name, keepsake, detail, 4 HP).
 *
 * Composes the shared `Inset` (style-unification pass §3 — the boxed
 * sub-panel: 1.5px ink frame on paper, ink head bar): a pink 'CREW' tag +
 * the lead's (editable) name on the head bar, their SRD role title riding
 * the right edge; body = sm HP Stat beside quiet Keepsake/Detail/Facts id
 * lines.
 *
 * Persistence stays with the caller: name/HP/detail/facts patch the crawler's
 * bay entry; keepsake persists through the bay's SRD freeform 'Keepsake'
 * choice (see CrawlerSheet). Handler absence IS the read-only encoding —
 * omit a field's handler and it renders plain text, no edit affordances.
 */

import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'
import { InlineEditField } from '../chrome/InlineEditField'
import { Inset } from '../shared/Inset'
import { Stat } from '../shared/Stat'
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
  className,
  children,
}: {
  label: string
  /** Let the value cell take the remaining width (multiline / editor cells). */
  grow?: boolean
  /** Skip the prose treatment — the cell hosts its own component. */
  plain?: boolean
  /** Grid placement from the caller (e.g. spanning both columns). */
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn('flex items-baseline gap-1.5', className)}>
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
        // The ROLE is the tag. There is no "Crew" chip any more: every inset on
        // a crawler is crew, so the word labelled nothing while occupying the
        // one slot that could say WHICH crew this is.
        tag={title}
        label={
          onNameChange ? (
            <InlineEditField
              value={name}
              onSave={(next) => onNameChange(String(next))}
              type="text"
              ariaLabel={`Edit ${bayName} crew name`}
              // `[&>span]:` reaches the READOUT: InlineEditField's own display
              // span carries `text-ink`, which is invisible on this dark head
              // bar, and a colour on the wrapper alone never reached it.
              className="text-paper [&>span]:text-paper [&>span]:opacity-100"
            />
          ) : (
            name || '—'
          )
        }
        // HP rides the head bar's right edge — it is this crew member's one
        // live number, and in the body it sat below the fold of identity lines
        // that never change.
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
        bodyClassName="flex flex-wrap items-start gap-2"
      >
        {/* Keepsake and Motto SHARE a row: both are one short phrase, and each
            taking a full 44px row of its own made a four-row inset out of two
            lines of content. Detail and Facts keep their own rows — they grow. */}
        <dl className="m-0 grid min-w-0 flex-1 grid-cols-1 gap-x-4 gap-y-1 @md:grid-cols-2">
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
          <NpcRow label="Detail" grow className="@md:col-span-2">
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
            <NpcRow label="Facts" grow plain className="@md:col-span-2">
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
