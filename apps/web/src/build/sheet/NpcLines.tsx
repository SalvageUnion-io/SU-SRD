/**
 * NpcLines — what a sheet tracks about an NPC, under its head: a built NPC's
 * own sheet (beside its stat block) and a crew lead's contentful Token
 * (`CrewLeadToken`, N3: a bay's crew lead and a crawler type's special NPC).
 * Each crew lead has a name, keepsake, motto, detail, facts and 4 HP.
 *
 * Role, Keepsake and Motto read as `Stat`s with text values (ruleset §3.7),
 * Detail as prose, Facts in the one chip well (`ChipListEditor`). In Edit each
 * one to write is a `Field` in its edit state (its label over the value box
 * a press opens), and HP its stepper.
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
import { Field, Stat, tokens } from '../../components/index'
import { ChipListEditor } from './ChipListEditor'
import { FACT_DRAFT } from './chipWell.model'

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
 * One labelled line whose value is neither a reading nor a field: Detail's
 * prose, the Facts well. A reading (Role, Keepsake, Motto in Read) is a `Stat`
 * with a text value (ruleset §3.7, §6.2), a value to write a `Field`, never a
 * hand-built label and value.
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
      <span className={ROW_LABEL_CAPS} style={ROW_LABEL}>
        {label}
      </span>
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

/** A reading: its `Stat`, a text value, Compact as the fields beside it. */
function NpcReading({ label, value }: { label: string; value: string }) {
  return (
    <div style={ROW}>
      <Stat label={label} value={value} size="compact" wrap />
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
}: NpcLinesProps & {
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
    <div className="su-sheet-npc-lines" style={LINES}>
      {showName && (
        <Field
          label="Name"
          value={name}
          onSave={(next) => onNameChange?.(next)}
          ariaLabel={`${bayName} crew name`}
          placeholder={title}
        />
      )}
      {showHp && (
        // The Stat names itself.
        <div style={ROW}>
          <Stat
            orientation="horizontal"
            label="HP"
            value={hp}
            max={maxHp}
            size="compact"
            mode="edit"
            onChange={onHpChange}
          />
        </div>
      )}
      {showRole && <NpcReading label="Role" value={role} />}
      {showKeepsake &&
        (onKeepsakeChange ? (
          <Field
            label="Keepsake"
            value={keepsake}
            onSave={onKeepsakeChange}
            ariaLabel={`${bayName} crew keepsake`}
          />
        ) : (
          <NpcReading label="Keepsake" value={keepsake} />
        ))}
      {showMotto &&
        (onMottoChange ? (
          <Field
            label="Motto"
            value={motto}
            onSave={onMottoChange}
            ariaLabel={`${bayName} crew motto`}
          />
        ) : (
          <NpcReading label="Motto" value={motto} />
        ))}
      {showDetail &&
        (onDetailChange ? (
          <Field
            label="Detail"
            className="su-sheet-npc-wide"
            multiline
            value={detail}
            onSave={onDetailChange}
            ariaLabel={`${bayName} crew detail`}
            placeholder="Add a detail…"
          />
        ) : (
          <NpcRow label="Detail" grow className="su-sheet-npc-wide">
            {detail}
          </NpcRow>
        ))}
      {showFacts && (
        <NpcRow label="Facts" grow plain className="su-sheet-npc-wide">
          <ChipListEditor
            items={facts}
            onChange={(next) => onFactsChange?.(next)}
            noun="fact"
            owner={`${bayName} crew`}
            draftWidth={FACT_DRAFT}
            tone="quiet"
            readOnly={onFactsChange === undefined}
          />
        </NpcRow>
      )}
    </div>
  )
}
