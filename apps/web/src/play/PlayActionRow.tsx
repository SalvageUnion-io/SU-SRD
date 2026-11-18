/**
 * PlayActionRow — one action in the Actions list (play.md §5): the action's
 * contentful Mini, its text under its head, in the list's Mini grid
 * (ruleset §1.3: Play's lists are Minis), its Mini chips in the
 * shared stat order with the cost last. On hand it carries Use, after the cost
 * in its chip group (C8, ruleset §1.4), which opens the resolve in place in
 * the Mini's body (N3: the action's own text, then `PlayResolveSteps`), with
 * Cancel in Use's slot; not on hand it is dimmed, and says what it needs as a
 * chip ("needs Boarded"). Its band is its source unit's tone dulled (pilot or
 * mech, never black), and Use is a filled button; an action
 * it cannot use now (locked, or read-only) is faded too.
 *
 * A Mini nests nothing (E6): the resolve inside it, its roll instrument (R8)
 * and its steps, is plain content, never an entity of its own (play.md §12).
 */

import { useMemo } from 'react'
import { Button, Entity, Stat, TraitProse } from '../components/index'
import { actionRow } from '../lib/rules/actionRow'
import { playCopy } from '../messages/play'
import { PlayResolveSteps } from './PlayResolveSteps'
import type { ListEntry } from './playActions.model'
import { NEED_TEXT } from './playActions.model'
import type { ResolveModel } from './useActionsDeck'
import { usePlayWide } from './usePlayWide'

type ActionEntry = Extract<ListEntry, { kind: 'action' }>

/**
 * MOCK (Working Manual E): a closed row keeps the contentful head's chips
 * (range, damage, traits, cost) and prints no text (`.su-play-act` closes the
 * empty body's box).
 */
const CLOSED_BODY = { text: false } as const

/**
 * MOCK (wave 2, the actions board): what a row's band wears. A companion's
 * rows wear its own Mini's tone, as the Units column draws it.
 */
function tintOf(entry: ActionEntry): string {
  return entry.action.companion?.tone ?? entry.source
}

type PlayActionRowProps = {
  entry: ActionEntry
  /** The seat's resolve, when it is this action's; null otherwise. */
  resolve: Extract<ResolveModel, { kind: 'resolve' }> | null
  onUse: () => void
  canWrite: boolean
  /** Why it cannot run as it stands (out of range, over the Heat Cap), or null. */
  locked: string | null
  /** The pilot's crawler Tech Level: an item's action scales with it (Custom Sniper Rifle damage). */
  techLevel?: number
}

/** Why a line is not on hand ("needs Boarded"), as its state chip (C8). */
export function NeedChip({ need }: { need: string }) {
  return <Stat size="mini" label={need} />
}

/**
 * Why a line cannot run as it stands ("Out of Range at Long"), said as its
 * state chip, never only a hover title a phone can't read. Destroyed says so
 * already, in the line's own condition.
 */
function lockChip(locked: string | null, condition: string | undefined) {
  return locked === null || condition === 'destroyed' ? {} : { state: <NeedChip need={locked} /> }
}

export function PlayActionRow({
  entry,
  resolve,
  onUse,
  canWrite,
  locked,
  techLevel,
}: PlayActionRowProps) {
  // MOCK (wave 2): the row's model is the shared one (`actionRow`): the picks
  // and the crawler's Tech Level applied, its text the effect alone.
  const { model, summary, picks } = useMemo(
    () => actionRow(entry.action, techLevel),
    [entry.action, techLevel]
  )
  const companion = entry.action.companion
  const open = resolve !== null
  const away = entry.need !== null
  // MOCK (Working Manual E): a phone's Use is a 44px target (principle 8); a
  // Passive is always on and carries no Use (the timing law).
  const size = usePlayWide() ? 'mini' : 'full'
  const passive = entry.type === 'Passive'
  const controls =
    away || passive ? undefined : open ? (
      <Button
        size={size}
        onClick={resolve.onBack}
        aria-label={playCopy('cancel2', { name: entry.name })}
      >
        {playCopy('cancel')}
      </Button>
    ) : (
      <Button
        size={size}
        // MOCK (wave 2): every Use is rust, the action colour (the owner's ruling).
        variant="primary"
        onClick={onUse}
        disabled={!canWrite}
        aria-label={playCopy('use2', { name: entry.name })}
      >
        {playCopy('use')}
      </Button>
    )
  return (
    <li
      className="su-play-act"
      data-away={away || undefined}
      data-open={open || undefined}
      data-locked={(!away && locked !== null) || undefined}
      data-action-key={entry.key}
    >
      <Entity
        size="mini"
        context="play"
        model={model}
        instance={entry.action.condition === 'destroyed' ? { condition: 'destroyed' } : undefined}
        tint={tintOf(entry)}
        // MOCK (wave 2): a companion's row names it, lightly, as a relation chip (C11).
        {...(companion
          ? { relations: [{ key: `companion-${companion.id}`, name: companion.name }] }
          : {})}
        dim={away || locked !== null || !canWrite}
        {...(away
          ? { state: <NeedChip need={NEED_TEXT[entry.need ?? 'boarded']} /> }
          : lockChip(locked, entry.action.condition))}
        {...(controls ? { controls } : {})}
        // MOCK (Working Manual E): a compact row, its head alone (name, traits,
        // cost, Use); opened, it is contentful in place (N3): the action's own
        // text, then its steps. Its name still Peeks its rules.
        // MOCK (wave 2): closed, it says its effect in one short line (two on a
        // phone, `.su-play-act__effect`); opened, the whole effect, its picks
        // named (R60), then its steps.
        body={
          open
            ? {
                children: (
                  <>
                    {picks.length > 0 && (
                      <div className="su-play-act__picks">
                        {picks.map((pick) => (
                          <Stat
                            key={`${pick.choice}-${pick.label}`}
                            size="mini"
                            label={playCopy('chosen')}
                            value={pick.label}
                          />
                        ))}
                      </div>
                    )}
                    <PlayResolveSteps view={resolve} canWrite={canWrite} />
                  </>
                ),
              }
            : summary
              ? {
                  text: false,
                  children: <TraitProse as="p" className="su-play-act__effect" text={summary} />,
                }
              : CLOSED_BODY
        }
      />
    </li>
  )
}
