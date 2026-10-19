/**
 * NpcInset — an NPC's identity panel where it stands at level 1 (N1): a built
 * NPC's own page, beside its stat block, and a crawler type's special NPC in
 * the sheet's identity panel. Each crew lead has a name, keepsake, motto,
 * detail, facts and 4 HP. Inside a bay card, a level-1 entity, the crew lead
 * is a contentful Token instead (`CrewLeadToken`, N3): no titled box nests in
 * an entity (N5). Both draw the same id lines (`NpcLines`).
 *
 * Composes the shared `Inset`: the cut-out head the SRD draws the same NPC
 * with (NPC brown band, the lead's editable name on the paper tab, the role
 * and an `HP | 4/4` chip beside it), over quiet Keepsake/Motto/Detail/Facts id
 * lines.
 *
 * Persistence stays with the caller: name/HP/detail/facts patch the crawler's
 * bay entry; keepsake persists through the bay's SRD freeform 'Keepsake'
 * choice (see CrawlerSheet). Handler absence IS the read-only encoding —
 * omit a field's handler and it renders plain text, no edit affordances, and
 * an empty field is left out rather than printed as a dash (the sheet's Read
 * state, board 10).
 */

import type { CSSProperties, ReactNode } from 'react'
import { capsLabel } from '../../components/atoms/capsLabel'
import { InlineEditField, Inset, Stat, tokens } from '../../components/index'
import { NpcFactsEditor } from './NpcFactsEditor'

const ROW = {
  alignItems: 'baseline',
  display: 'flex',
  gap: tokens.space[6],
} satisfies CSSProperties

const ROW_LABEL = {
  color: tokens.color.ink,
  flexShrink: 0,
  lineHeight: 1,
} satisfies CSSProperties
const ROW_LABEL_CAPS = capsLabel({ size: 'badge' })

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

export type NpcInsetProps = {
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
  /** The host's controls, the head's last slot (C8, hard rule R6): a linked crew's Open. */
  controls?: ReactNode
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
  srLabel = false,
  children,
}: {
  label: string
  /** Let the value cell take the remaining width (multiline / editor cells). */
  grow?: boolean
  /** Skip the prose treatment — the cell hosts its own component. */
  plain?: boolean
  /** Grid placement from the caller (e.g. `.su-sheet-npc-wide`, spanning both columns). */
  className?: string
  /** The term is for assistive tech only: the cell names itself (a `Stat`). */
  srLabel?: boolean
  children: ReactNode
}) {
  return (
    <div className={className} style={ROW}>
      {srLabel ? (
        <dt className="su-sr-only">{label}</dt>
      ) : (
        <dt className={ROW_LABEL_CAPS} style={ROW_LABEL}>
          {label}
        </dt>
      )}
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

/**
 * A crew lead's id lines: Keepsake and Motto, Detail, Facts, each left out in
 * Read when empty. With `identity` the name and HP lead them, for a head that
 * holds no field (a crew lead's contentful Token, `CrewLeadToken`): each one
 * only while it can be written, since in Read that head shows both.
 */
export function NpcLines({
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
  identity = false,
  role = '',
}: NpcInsetProps & {
  /** Lead with the name and HP fields (the head they would sit on holds no field). */
  identity?: boolean
  /** Its role, read-only (a built NPC's own sheet, whose band carries no role chip). */
  role?: string
}) {
  // Read leaves an empty field out: a row prints when it can be written or has
  // something to read.
  const showName = identity && onNameChange !== undefined
  const showHp = identity && onHpChange !== undefined && maxHp > 0
  const showRole = role.trim() !== ''
  const showKeepsake = onKeepsakeChange !== undefined || keepsake.trim() !== ''
  const showMotto = onMottoChange !== undefined || motto.trim() !== ''
  const showDetail = onDetailChange !== undefined || detail.trim() !== ''
  const showFacts = onFactsChange !== undefined || facts.length > 0
  if (!(showName || showHp || showRole || showKeepsake || showMotto || showDetail || showFacts))
    return null
  // Keepsake and Motto SHARE a row (as Name and HP do): both are one short
  // phrase, and each taking a full 44px row of its own made a four-row inset
  // out of two lines of content. Detail and Facts keep their own rows — they
  // grow.
  return (
    <dl className="su-sheet-npc-lines" style={LINES}>
      {showName && (
        <NpcRow label="Name">
          <InlineEditField
            value={name}
            onSave={(next) => onNameChange?.(String(next))}
            type="text"
            ariaLabel={`Edit ${bayName} crew name`}
            placeholder={title}
          />
        </NpcRow>
      )}
      {showHp && (
        // The Stat names itself: its term is for assistive tech only.
        <NpcRow label="HP" plain srLabel>
          <Stat
            orientation="horizontal"
            label="HP"
            value={hp}
            max={maxHp}
            size="compact"
            mode="edit"
            onChange={onHpChange}
          />
        </NpcRow>
      )}
      {showRole && <NpcRow label="Role">{role}</NpcRow>}
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
  )
}

export function NpcInset(props: NpcInsetProps) {
  const { bayName, title, name, hp, maxHp, onNameChange, onHpChange } = props
  return (
    // biome-ignore lint/a11y/useSemanticElements: a labeled group (not a landmark) names the crew-lead inset so multiple insets per crawler stay distinguishable; Inset exposes no aria-label of its own, and a <section> here would become a region landmark once named
    <div role="group" aria-label={`${bayName} crew lead`}>
      <Inset
        // An NPC's own tone, as the SRD draws the same crew lead nested in its
        // bay: the cut-out head, the name on the paper tab, the chips beside.
        tone="adversary"
        title={name || title || 'Crew'}
        titleContent={
          onNameChange ? (
            <InlineEditField
              value={name}
              onSave={(next) => onNameChange(String(next))}
              type="text"
              ariaLabel={`Edit ${bayName} crew name`}
              placeholder={title}
            />
          ) : undefined
        }
        // The ROLE leads the chips (a label-only cell, as an action type is),
        // then HP — this crew member's one live number — as its chip, with
        // the steppers while the sheet writes it.
        marks={
          title && (name || onNameChange) ? (
            <Stat orientation="horizontal" label={title} size="compact" />
          ) : undefined
        }
        state={
          maxHp > 0 ? (
            <Stat
              orientation="horizontal"
              label="HP"
              value={hp}
              max={maxHp}
              size="compact"
              mode={onHpChange ? 'edit' : 'read'}
              onChange={onHpChange}
            />
          ) : undefined
        }
        controls={props.controls}
        bodyStyle={BODY}
      >
        <NpcLines {...props} />
      </Inset>
    </div>
  )
}
