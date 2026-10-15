/**
 * The live sheet's Change Class body: the class list shaped by the advancement
 * ring, with the consequences of the pending pick beside it.
 *
 * Replaces a flat list of all eleven classes that offered a Hacker three
 * hybrids they cannot reach and said nothing about what changing would cost.
 * Free Edit still means nothing is withheld — unreachable destinations are
 * demoted and labelled, because they are not inert, they just cost one extra
 * question.
 */

import { Callout, Entity, RadioCardGroup, ReferenceEntityCard, Slab, tokens } from 'component-lib'
import type { CSSProperties } from 'react'
import type { RefClass } from 'salvageunion-reference'
import type { ClassPathConsequence } from '../../lib/rules/classPath'
import { classPathConsequence, classPathGroups } from '../../lib/rules/classPath'
import '../../styles/wizard.css'

/** An unreachable (off-ring) class, demoted but still pickable. */
const DIMMED = { opacity: 0.7 } satisfies CSSProperties

/** The caps note under a class card ("current", "via Hacker", …). */
const OPTION_NOTE = {
  margin: `0 0 ${tokens.space[8]}`,
  paddingLeft: tokens.space[4],
  fontFamily: tokens.font.cond,
  fontSize: tokens.fontSize.badge,
  fontWeight: tokens.weight.bold,
  textTransform: 'uppercase',
  letterSpacing: tokens.tracking.caps,
  color: tokens.color.wkMuted,
} satisfies CSSProperties

/** The gain / lose / keep lists. */
const LEDGER = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[12],
} satisfies CSSProperties

/** Each list's Slab, close over its lines. */
const LEDGER_SLAB = { marginBottom: tokens.space[6] } satisfies CSSProperties

/** A line that names no entity (a tree, what it costs), in the body face. */
const LEDGER_LINE = {
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.sm,
  lineHeight: 'calc(1.25 / 0.875)',
} satisfies CSSProperties

/** List and consequences; the column split is `.su-wiz-class-path`. */
const PICKER = { display: 'grid', gap: tokens.space[16] } satisfies CSSProperties

/** One ring group (Core, Advanced, …) in the class list. */
const GROUP = { marginBottom: tokens.space[16] } satisfies CSSProperties

/** The consequences column. */
const CONSEQUENCES = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[12],
} satisfies CSSProperties

/** The origin question's copy, above its cards. */
const ORIGIN_COPY = { margin: `0 0 ${tokens.space[8]}` } satisfies CSSProperties

/** The derived-origin note. */
const IMPLIED_ORIGIN = {
  margin: 0,
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.caption,
  color: tokens.color.wkMuted,
} satisfies CSSProperties

type ClassPathPickerProps = {
  allClasses: readonly RefClass[]
  currentClassRef: string
  pendingClassRef: string
  onSelect: (classId: string) => void
  /** The Core class the player named, when the pick needs one. */
  answeredOrigin: string | undefined
  onAnswerOrigin: (classId: string | undefined) => void
}

function OptionCard({
  cls,
  selected,
  dimmed,
  note,
  onSelect,
}: {
  cls: RefClass
  selected: boolean
  dimmed: boolean
  note?: string
  onSelect: () => void
}) {
  return (
    <div style={dimmed && !selected ? DIMMED : undefined}>
      <ReferenceEntityCard
        data={cls}
        size="medium"
        extent="catalog"
        className="su-wiz-class-card"
        selected={selected}
        selectionRole="radio"
        cardClickLabel={note === undefined ? cls.name : `${cls.name}, ${note}`}
        onCardClick={onSelect}
      />
      {note !== undefined && <p style={OPTION_NOTE}>{note}</p>}
    </div>
  )
}

/**
 * One of the ledger's lists under its Slab, a line each: a class it names is
 * its Token (it Peeks the class); a tree or a cost is a line of text, since a
 * tree is no entity of its own.
 */
function LedgerList({
  label,
  items,
  allClasses,
}: {
  label: string
  items: readonly string[]
  allClasses: readonly RefClass[]
}) {
  if (items.length === 0) return null
  return (
    <section aria-label={label}>
      <Slab label={label} style={LEDGER_SLAB} />
      <ul className="su-entity-token-list">
        {items.map((item) => {
          const cls = allClasses.find((c) => c.name === item)
          return (
            <li key={item}>
              {cls ? <Entity form="token" entity={cls} /> : <span style={LEDGER_LINE}>{item}</span>}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function Ledger({
  consequence,
  allClasses,
}: {
  consequence: ClassPathConsequence
  allClasses: readonly RefClass[]
}) {
  return (
    <div style={LEDGER}>
      <LedgerList label="Gain" items={consequence.gain} allClasses={allClasses} />
      <LedgerList label="Lose" items={consequence.lose} allClasses={allClasses} />
      <LedgerList label="Keep" items={consequence.keep} allClasses={allClasses} />
    </div>
  )
}

export function ClassPathPicker({
  allClasses,
  currentClassRef,
  pendingClassRef,
  onSelect,
  answeredOrigin,
  onAnswerOrigin,
}: ClassPathPickerProps) {
  const groups = classPathGroups(allClasses, currentClassRef)
  const consequence = classPathConsequence(allClasses, currentClassRef, pendingClassRef)

  const originChoiceClasses = (consequence?.originChoices ?? [])
    .map((name) => allClasses.find((c) => c.name === name))
    .filter((c): c is RefClass => c !== undefined)

  return (
    <div className="su-wiz-class-path" style={PICKER}>
      <RadioCardGroup label="Class">
        {groups.map((group) => (
          <div key={group.kind} style={GROUP}>
            <Slab label={group.label} />
            {group.options.map((option) => (
              <OptionCard
                key={option.cls.id}
                cls={option.cls}
                selected={option.cls.id === pendingClassRef}
                dimmed={group.kind === 'off-ring'}
                note={option.current ? 'current' : option.note}
                onSelect={() => {
                  onSelect(option.cls.id)
                  // A different destination invalidates a previous answer.
                  onAnswerOrigin(undefined)
                }}
              />
            ))}
          </div>
        ))}
      </RadioCardGroup>

      <div style={CONSEQUENCES}>
        {consequence === undefined ? null : (
          <>
            <Slab label={consequence.title} variant="solid" />
            <Ledger consequence={consequence} allClasses={allClasses} />

            {consequence.needsOrigin && (
              <Callout tone="ink" label="Where did they come from?">
                <p style={ORIGIN_COPY}>
                  A {consequence.title} is reached from {consequence.originChoices.join(' or ')}.
                  This pilot is neither, so the sheet needs to know which —{' '}
                  <strong>each answer seals a different pair of trees.</strong> You can leave it
                  unanswered; nothing will be sealed.
                </p>
                <RadioCardGroup label="Origin class">
                  {originChoiceClasses.map((cls) => (
                    <ReferenceEntityCard
                      key={cls.id}
                      data={cls}
                      size="small"
                      extent="head"
                      className="su-wiz-class-card"
                      selected={cls.id === answeredOrigin}
                      selectionRole="radio"
                      cardClickLabel={`Came from ${cls.name}`}
                      onCardClick={() => onAnswerOrigin(cls.id)}
                    />
                  ))}
                </RadioCardGroup>
              </Callout>
            )}

            {consequence.impliedOrigin !== undefined && (
              <p style={IMPLIED_ORIGIN}>
                Recorded as <strong>{consequence.impliedOrigin}</strong> — derived from this pilot's
                trees, so nothing extra is stored.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
