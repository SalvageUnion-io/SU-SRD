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

import { Callout, KvRow, ReferenceEntityCard, Slab } from 'component-lib'
import type { SURefClass } from 'salvageunion-reference'
import type { ClassPathConsequence } from './classPathOptions'
import { classPathConsequence, classPathGroups } from './classPathOptions'

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
    <div className={dimmed && !selected ? 'opacity-70' : undefined}>
      <ReferenceEntityCard
        data={cls}
        size="medium"
        extent="catalog"
        className="mb-1"
        selected={selected}
        selectionRole="radio"
        cardClickLabel={note === undefined ? cls.name : `${cls.name}, ${note}`}
        onCardClick={onSelect}
      />
      {note !== undefined && (
        <p className="mb-2 pl-1 font-cond text-label font-bold uppercase tracking-caps text-wk-muted">
          {note}
        </p>
      )}
    </div>
  )
}

function Ledger({ consequence }: { consequence: ClassPathConsequence }) {
  return (
    <div className="flex flex-col gap-2">
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
    <div className="grid gap-4 sm:grid-cols-[minmax(0,320px)_1fr]">
      <div role="radiogroup" aria-label="Class">
        {groups.map((group) => (
          <div key={group.kind} className="mb-4">
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
      </div>

      <div className="flex flex-col gap-3">
        {consequence === undefined ? null : (
          <>
            <Slab label={consequence.title} variant="solid" />
            <Ledger consequence={consequence} />

            {consequence.needsOrigin && (
              <Callout tone="ink" label="Where did they come from?">
                <p className="mb-2">
                  A {consequence.title} is reached from {consequence.originChoices.join(' or ')}.
                  This pilot is neither, so the sheet needs to know which —{' '}
                  <strong>each answer seals a different pair of trees.</strong> You can leave it
                  unanswered; nothing will be sealed.
                </p>
                <div role="radiogroup" aria-label="Origin class">
                  {originChoiceClasses.map((cls) => (
                    <ReferenceEntityCard
                      key={cls.id}
                      data={cls}
                      size="small"
                      extent="head"
                      className="mb-1"
                      selected={cls.id === answeredOrigin}
                      selectionRole="radio"
                      cardClickLabel={`Came from ${cls.name}`}
                      onCardClick={() => onAnswerOrigin(cls.id)}
                    />
                  ))}
                </div>
              </Callout>
            )}

            {consequence.impliedOrigin !== undefined && (
              <p className="font-body text-caption text-wk-muted">
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
