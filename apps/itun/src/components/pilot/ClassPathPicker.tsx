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

import { Callout, KvRow, RadioCardGroup, ReferenceEntityCard, Slab, tokens } from 'component-lib'
import type { CSSProperties } from 'react'
import type { SURefClass } from 'salvageunion-reference'
import type { ClassPathConsequence } from './classPathOptions'
import { classPathConsequence, classPathGroups } from './classPathOptions'
import '../../styles/wizard.css'

/** An unreachable (off-ring) class, demoted but still pickable. */
const DIMMED: CSSProperties = { opacity: 0.7 }

/** The caps note under a class card ("current", "via Hacker", …). */
const OPTION_NOTE: CSSProperties = {
  margin: `0 0 ${tokens.space[8]}`,
  paddingLeft: tokens.space[4],
  fontFamily: tokens.font.cond,
  fontSize: tokens.fontSize.badge,
  fontWeight: tokens.weight.bold,
  textTransform: 'uppercase',
  letterSpacing: tokens.tracking.caps,
  color: tokens.color.wkMuted,
}

/** The gain / lose / keep rows. */
const LEDGER: CSSProperties = { display: 'flex', flexDirection: 'column', gap: tokens.space[8] }

/** List and consequences; the column split is `.wiz-class-path`. */
const PICKER: CSSProperties = { display: 'grid', gap: tokens.space[16] }

/** One ring group (Core, Advanced, …) in the class list. */
const GROUP: CSSProperties = { marginBottom: tokens.space[16] }

/** The consequences column. */
const CONSEQUENCES: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[12],
}

/** The origin question's copy, above its cards. */
const ORIGIN_COPY: CSSProperties = { margin: `0 0 ${tokens.space[8]}` }

/** The derived-origin note. */
const IMPLIED_ORIGIN: CSSProperties = {
  margin: 0,
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.caption,
  color: tokens.color.wkMuted,
}

type ClassPathPickerProps = {
  allClasses: readonly SURefClass[]
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
  cls: SURefClass
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
        className="wiz-class-card"
        selected={selected}
        selectionRole="radio"
        cardClickLabel={note === undefined ? cls.name : `${cls.name}, ${note}`}
        onCardClick={onSelect}
      />
      {note !== undefined && <p style={OPTION_NOTE}>{note}</p>}
    </div>
  )
}

function Ledger({ consequence }: { consequence: ClassPathConsequence }) {
  return (
    <div style={LEDGER}>
      {consequence.gain.length > 0 && <KvRow label="Gain" value={consequence.gain.join(' · ')} />}
      {consequence.lose.length > 0 && <KvRow label="Lose" value={consequence.lose.join(' · ')} />}
      {consequence.keep.length > 0 && <KvRow label="Keep" value={consequence.keep.join(' · ')} />}
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
    .filter((c): c is SURefClass => c !== undefined)

  return (
    <div className="wiz-class-path" style={PICKER}>
      <RadioCardGroup label="Class">
        {groups.map((group) => (
          <div key={group.kind} style={GROUP}>
            <Slab label={group.label} count={group.options.length} />
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
            <Ledger consequence={consequence} />

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
                      className="wiz-class-card"
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
