/**
 * NpcLines — what a sheet tracks about an NPC, under its head: a built NPC's
 * own sheet (beside its stat block) and a crew lead's contentful Mini
 * (`CrewLeadMini`, N3: a bay's crew lead and a crawler type's special NPC).
 * Each crew lead has a name, keepsake, motto, detail, facts and 4 HP.
 *
 * In Read each is its small caps label over its value, as Detail's prose
 * (NPC details are rows, never `[label | value]` chips, the label above,
 * not to the left); Facts' value is the one chip well (`ChipListEditor`). In
 * Edit each
 * one to write is a `Field` in its edit state (its label over the value box
 * a press opens, or over Facts' chip well). HP is never here: a crew lead's
 * is the gauge beside them (`CrewLeadMini`), a built NPC's in its sheet's
 * vital gauge.
 *
 * Persistence stays with the caller: name/HP/detail/facts patch the crawler's
 * bay entry; keepsake persists through the bay's SRD freeform 'Keepsake'
 * choice (see CrawlerSheet). Handler absence IS the read-only encoding —
 * omit a field's handler and it renders plain text, no edit affordances, and
 * an empty field is left out rather than printed as a dash (the sheet's Read
 * state).
 */

import type { CSSProperties, ReactNode } from 'react'
import { Eyebrow, Field, tokens } from '../../components/index'
import { buildSheetCopy } from '../../messages/build-sheet'
import { ChipListEditor } from './ChipListEditor'
import { FACT_DRAFT } from './chipWell.model'

/** Its label over its value, never to its left. */
const ROW = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[2],
  minWidth: 0,
} satisfies CSSProperties

const ROW_LABEL = { flexShrink: 0, lineHeight: 1 } satisfies CSSProperties

const ROW_VALUE = { margin: 0, minWidth: 0 } satisfies CSSProperties

const ROW_VALUE_GROW = { flex: '1 1 0%' } satisfies CSSProperties

const ROW_VALUE_PROSE = {
  color: tokens.color.wkMuted,
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.note,
  lineHeight: 1.375,
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

export type NpcLinesProps = {
  /** Bay name — disambiguates aria-labels when several crew leads render at once. */
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
 * One labelled line in Read: Role, Keepsake, Motto and Detail as prose, the
 * Facts well. A value to write is a `Field`, never a row.
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
      <Eyebrow tone="ink" style={ROW_LABEL}>
        {label}
      </Eyebrow>
      <div
        style={{
          ...ROW_VALUE,
          ...(grow && ROW_VALUE_GROW),
          ...(!plain && ROW_VALUE_PROSE),
        }}
      >
        {children}
      </div>
    </div>
  )
}

/**
 * A crew lead's id lines: Keepsake and Motto, Detail, Facts, each left out in
 * Read when empty. With `identity` the name leads them, for a head that holds
 * no field (a crew lead's contentful Mini, `CrewLeadMini`): only while it can
 * be written, since in Read that head shows it. HP is the gauge beside them.
 */
export function NpcLines({
  bayName,
  title,
  name,
  keepsake,
  motto,
  detail,
  facts,
  onNameChange,
  onKeepsakeChange,
  onMottoChange,
  onDetailChange,
  onFactsChange,
  identity = false,
  role = '',
}: NpcLinesProps & {
  /** Lead with the name field (the head it would sit on holds no field). */
  identity?: boolean
  /** Its role, read-only (a built NPC's own sheet, whose band carries no role chip). */
  role?: string
}) {
  // Read leaves an empty field out: a row prints when it can be written or has
  // something to read.
  const showName = identity && onNameChange !== undefined
  const showRole = role.trim() !== ''
  const showKeepsake = onKeepsakeChange !== undefined || keepsake.trim() !== ''
  const showMotto = onMottoChange !== undefined || motto.trim() !== ''
  const showDetail = onDetailChange !== undefined || detail.trim() !== ''
  const showFacts = onFactsChange !== undefined || facts.length > 0
  if (!(showName || showRole || showKeepsake || showMotto || showDetail || showFacts)) return null
  // Facts takes the Field label (over the well) while it can be written, as
  // the fields beside it do; Read keeps the inline row, as Detail does.
  const factsWell = (
    <ChipListEditor
      items={facts}
      onChange={(next) => onFactsChange?.(next)}
      noun="fact"
      owner={`${bayName} crew`}
      draftWidth={FACT_DRAFT}
      tone="quiet"
      readOnly={onFactsChange === undefined}
    />
  )
  // Keepsake and Motto SHARE a row: both are one short
  // phrase, and each taking a full 44px row of its own made a four-row inset
  // out of two lines of content. Detail and Facts keep their own rows — they
  // grow.
  return (
    <div className="su-sheet-npc-lines" style={LINES}>
      {showName && (
        <Field
          label={buildSheetCopy('name')}
          value={name}
          onSave={(next) => onNameChange?.(next)}
          ariaLabel={buildSheetCopy('crewName', { bayName })}
          placeholder={title}
        />
      )}
      {showRole && <NpcRow label={buildSheetCopy('role')}>{role}</NpcRow>}
      {showKeepsake &&
        (onKeepsakeChange ? (
          <Field
            label={buildSheetCopy('keepsake')}
            value={keepsake}
            onSave={onKeepsakeChange}
            ariaLabel={buildSheetCopy('crewKeepsake', { bayName })}
          />
        ) : (
          <NpcRow label={buildSheetCopy('keepsake')}>{keepsake}</NpcRow>
        ))}
      {showMotto &&
        (onMottoChange ? (
          <Field
            label={buildSheetCopy('motto')}
            value={motto}
            onSave={onMottoChange}
            ariaLabel={buildSheetCopy('crewMotto', { bayName })}
          />
        ) : (
          <NpcRow label={buildSheetCopy('motto')}>{motto}</NpcRow>
        ))}
      {showDetail &&
        (onDetailChange ? (
          <Field
            label={buildSheetCopy('detail')}
            className="su-sheet-npc-wide"
            multiline
            value={detail}
            onSave={onDetailChange}
            ariaLabel={buildSheetCopy('crewDetail', { bayName })}
            placeholder={buildSheetCopy('addADetail')}
          />
        ) : (
          <NpcRow label={buildSheetCopy('detail')} grow className="su-sheet-npc-wide">
            {detail}
          </NpcRow>
        ))}
      {showFacts &&
        (onFactsChange ? (
          <Field label={buildSheetCopy('facts')} className="su-sheet-npc-wide">
            {factsWell}
          </Field>
        ) : (
          <NpcRow label={buildSheetCopy('facts')} grow plain className="su-sheet-npc-wide">
            {factsWell}
          </NpcRow>
        ))}
    </div>
  )
}
