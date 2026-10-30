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

import type { CSSProperties } from 'react'
import type { RefClass } from 'salvageunion-reference'
import {
  Callout,
  Entity,
  Eyebrow,
  RadioCardGroup,
  SELECT_DIM,
  Slab,
  SlabSection,
  Stack,
  Text,
  tokens,
} from '../../components/index'
import { cn } from '../../lib/cn'
import type { ClassPathConsequence } from '../../lib/rules/classPath'
import { classPathConsequence, classPathGroups } from '../../lib/rules/classPath'
import '../../styles/build/wizard.css'
import { pilotCopy } from '../../messages/build-pilot'

/** The caps note's place under a class card ("current", "via Hacker", …). */
const OPTION_NOTE = {
  margin: `0 0 ${tokens.space[8]}`,
  paddingLeft: tokens.space[4],
} satisfies CSSProperties

/** A line that names no entity (a tree, what it costs), in the body face. */
const LEDGER_LINE = {
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.body,
  lineHeight: 'calc(1.25 / 0.875)',
} satisfies CSSProperties

/** List and consequences; the column split is `.su-wiz-class-path`. */
const PICKER = { display: 'grid', gap: tokens.space[16] } satisfies CSSProperties

/** One ring group (Core, Advanced, …) in the class list. */
const GROUP = { marginBottom: tokens.space[16] } satisfies CSSProperties

/** The origin question's copy, the whole of its note. */
const ORIGIN_COPY = { margin: 0 } satisfies CSSProperties

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
    <div>
      {/* An unreachable (off-ring) class is demoted but still pickable: the
          one select dim (hard rule R15) until it is the pick. */}
      <div className={cn('su-wiz-class-card', dimmed && !selected && SELECT_DIM)}>
        <Entity
          size="compact"
          entity={cls}
          lead
          mode={{
            kind: 'select',
            role: 'radio',
            selected,
            onSelect,
            label: note === undefined ? cls.name : `${cls.name}, ${note}`,
          }}
        />
      </div>
      {note !== undefined && (
        <Eyebrow as="p" tone="muted" style={OPTION_NOTE}>
          {note}
        </Eyebrow>
      )}
    </div>
  )
}

/**
 * One of the ledger's lists under its Slab, a line each: a class it names is
 * its Mini (it Peeks the class); a tree or a cost is a line of text, since a
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
    <SlabSection title={label} aria-label={label}>
      <ul className="su-entity-mini-list">
        {items.map((item) => {
          const cls = allClasses.find((c) => c.name === item)
          return (
            <li key={item}>
              {cls ? (
                <Entity size="mini" context="browse" entity={cls} />
              ) : (
                <span style={LEDGER_LINE}>{item}</span>
              )}
            </li>
          )
        })}
      </ul>
    </SlabSection>
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
    <Stack gap={12}>
      <LedgerList label={pilotCopy('gain')} items={consequence.gain} allClasses={allClasses} />
      <LedgerList label={pilotCopy('lose')} items={consequence.lose} allClasses={allClasses} />
      <LedgerList label={pilotCopy('keep')} items={consequence.keep} allClasses={allClasses} />
    </Stack>
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
      <RadioCardGroup label={pilotCopy('class')}>
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

      <Stack gap={12}>
        {consequence === undefined ? null : (
          <>
            <Slab label={consequence.title} />
            <Ledger consequence={consequence} allClasses={allClasses} />

            {consequence.needsOrigin && (
              // The note, then its picks: radio Compacts as the class list's
              // (N7: select is never a Mini), beside it, not inside it.
              <>
                <Callout tone="ink">
                  <p style={ORIGIN_COPY}>
                    <strong>{pilotCopy('whereDidTheyComeFrom')}</strong> A {consequence.title} is
                    reached from {consequence.originChoices.join(' or ')}. This pilot is neither, so
                    the sheet needs to know which —{' '}
                    <strong>{pilotCopy('eachAnswerSealsADifferent')}</strong> You can leave it
                    unanswered; nothing will be sealed.
                  </p>
                </Callout>
                <RadioCardGroup label={pilotCopy('originClass')}>
                  {originChoiceClasses.map((cls) => (
                    <div key={cls.id} className="su-wiz-class-card">
                      <Entity
                        size="compact"
                        entity={cls}
                        lead
                        mode={{
                          kind: 'select',
                          role: 'radio',
                          selected: cls.id === answeredOrigin,
                          onSelect: () => onAnswerOrigin(cls.id),
                          label: pilotCopy('cameFrom', { name: cls.name }),
                        }}
                      />
                    </div>
                  ))}
                </RadioCardGroup>
              </>
            )}

            {consequence.impliedOrigin !== undefined && (
              <Text variant="note">
                Recorded as <strong>{consequence.impliedOrigin}</strong> — derived from this pilot's
                trees, so nothing extra is stored.
              </Text>
            )}
          </>
        )}
      </Stack>
    </div>
  )
}
