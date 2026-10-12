/**
 * NpcInset — crew-lead card rendered inside a crawler bay card's `expand`
 * slot (`.npc`). Each bay is run by its own crew
 * lead (name, keepsake, detail, 4 HP).
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
 * omit a field's handler and it renders plain text, no edit affordances, and
 * an empty field is left out rather than printed as a dash (the sheet's Read
 * state, board 10).
 */

import { InlineEditField, Inset, Stat, tokens } from 'component-lib'
import type { CSSProperties, ReactNode } from 'react'
import { NpcFactsEditor } from './NpcFactsEditor'

const ROW = {
  alignItems: 'baseline',
  display: 'flex',
  gap: tokens.space[6],
} satisfies CSSProperties

const ROW_LABEL = {
  color: tokens.color.ink,
  flexShrink: 0,
  fontFamily: tokens.font.cond,
  fontSize: tokens.fontSize.badge,
  fontWeight: tokens.weight.bold,
  letterSpacing: tokens.tracking.capsWide,
  lineHeight: 1,
  textTransform: 'uppercase',
} satisfies CSSProperties

const ROW_VALUE = { margin: 0, minWidth: 0 } satisfies CSSProperties

const ROW_VALUE_GROW = { flex: '1 1 0%' } satisfies CSSProperties

const ROW_VALUE_PROSE = {
  color: tokens.color.wkMuted,
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.note,
  lineHeight: 1.375,
} satisfies CSSProperties

const BODY = {
  alignItems: 'flex-start',
  display: 'flex',
  flexWrap: 'wrap',
  gap: tokens.space[8],
} satisfies CSSProperties

/** The id lines; their two-column split is a container query (`.su-sheet-npc-lines`). */
const LINES = {
  columnGap: tokens.space[16],
  display: 'grid',
  flex: '1 1 0%',
  margin: 0,
  minWidth: 0,
  rowGap: tokens.space[4],
} satisfies CSSProperties

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
  /** Grid placement from the caller (e.g. `.su-sheet-npc-wide`, spanning both columns). */
  className?: string
  children: ReactNode
}) {
  return (
    <div className={className} style={ROW}>
      <dt style={ROW_LABEL}>{label}</dt>
      <dd
        style={{
          ...ROW_VALUE,
          ...(grow && ROW_VALUE_GROW),
          ...(!plain && ROW_VALUE_PROSE),
        }}
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
  // Read leaves an empty field out: a row prints when it can be written or has
  // something to read.
  const showKeepsake = onKeepsakeChange !== undefined || keepsake.trim() !== ''
  const showMotto = onMottoChange !== undefined || motto.trim() !== ''
  const showDetail = onDetailChange !== undefined || detail.trim() !== ''
  const showFacts = onFactsChange !== undefined || facts.length > 0
  const hasBody = showKeepsake || showMotto || showDetail || showFacts
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
              // `.su-sheet-npc-name > span` reaches the READOUT: InlineEditField's
              // own display span is ink, which is invisible on this dark head
              // bar, and a colour on the wrapper alone never reached it.
              className="su-sheet-npc-name"
            />
          ) : (
            name || undefined
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
        bodyStyle={BODY}
      >
        {/* Keepsake and Motto SHARE a row: both are one short phrase, and each
            taking a full 44px row of its own made a four-row inset out of two
            lines of content. Detail and Facts keep their own rows — they grow. */}
        {hasBody && (
          <dl className="su-sheet-npc-lines" style={LINES}>
            {showKeepsake && (
              <NpcRow label="Keepsake">
                {onKeepsakeChange ? (
                  <InlineEditField
                    value={keepsake}
                    onSave={(next) => onKeepsakeChange(String(next))}
                    type="text"
                    ariaLabel={`Edit ${bayName} crew keepsake`}
                  />
                ) : (
                  keepsake
                )}
              </NpcRow>
            )}
            {showMotto && (
              <NpcRow label="Motto">
                {onMottoChange ? (
                  <InlineEditField
                    value={motto}
                    onSave={(next) => onMottoChange(String(next))}
                    type="text"
                    ariaLabel={`Edit ${bayName} crew motto`}
                  />
                ) : (
                  motto
                )}
              </NpcRow>
            )}
            {showDetail && (
              <NpcRow label="Detail" grow className="su-sheet-npc-wide">
                {onDetailChange ? (
                  <InlineEditField
                    multiline
                    value={detail}
                    onSave={(next) => onDetailChange(String(next))}
                    ariaLabel={`Edit ${bayName} crew detail`}
                    placeholder="Add a detail…"
                  />
                ) : (
                  detail
                )}
              </NpcRow>
            )}
            {showFacts && (
              <NpcRow label="Facts" grow plain className="su-sheet-npc-wide">
                <NpcFactsEditor
                  facts={facts}
                  onChange={(next) => onFactsChange?.(next)}
                  npcLabel={`${bayName} crew`}
                  readOnly={onFactsChange === undefined}
                />
              </NpcRow>
            )}
          </dl>
        )}
      </Inset>
    </div>
  )
}
