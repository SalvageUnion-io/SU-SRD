/**
 * BookPatternBuild — the New Mech screen's book patterns: pick a chassis, then
 * one of the patterns it prints, and build the mech as printed. Every pattern
 * of every chassis is here, whatever its Tech Level; one past the starting
 * budget says so beside its totals and in the notice (a Blank-family shortcut,
 * as a saved pattern's Build With This). One press builds, and the notice has
 * Undo (r4 E23). A Reference pattern page's Build With This lands here with
 * its pattern picked (`?chassis=&pattern=`) and this button focused: nothing
 * is built by opening a link, so there is one more press to make, in sight.
 * The new mech's name is numbered past the names in the bay.
 */

import { moveTo } from 'game-domain/container'
import type { CSSProperties } from 'react'
import { useEffect, useRef, useState } from 'react'
import { nameToSlug } from 'salvageunion-reference'
import { Button, Field, Select, Stat, Text, tokens } from '../../../components/index'
import { useServerAction } from '../../../lib/connection/useServerAction'
import {
  bookPattern,
  bookPatternsOf,
  chassisWithPatterns,
  isStartingBookPattern,
  mechFromBookPattern,
} from '../../../lib/patterns/bookPatterns'
import { loadoutSlots } from '../../../lib/patterns/patterns'
import { mechScrap } from '../../../lib/rules/mechScrap'
import { mechCopy } from '../../../messages/build-mech'
import { useSync } from '../../../replica/syncContext'
import { useUnits } from '../../../replica/units'
import { SaveSignInDialog } from '../../wizard/SaveSignInDialog'
import { builtToast, mechNamesTaken } from './buildConfirm.model'

const STACK = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[8],
} satisfies CSSProperties
const ROW = {
  alignItems: 'flex-end',
  display: 'flex',
  flexWrap: 'wrap',
  gap: tokens.space[12],
} satisfies CSSProperties
const PICK = { flex: '1 1 12rem', minWidth: 0 } satisfies CSSProperties
const FILL = { width: '100%' } satisfies CSSProperties
const TOTALS = {
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  gap: tokens.space[8],
} satisfies CSSProperties

type BookPatternBuildProps = {
  /** The deep link's pick, as slugs; either may name nothing. */
  chassis?: string | undefined
  pattern?: string | undefined
  onBuilt: (mechId: string) => void
  /** The Game the mech is built into; unset, the store decides. */
  gameId?: string | undefined
}

export function BookPatternBuild({ chassis, pattern, onBuilt, gameId }: BookPatternBuildProps) {
  const { status, canWrite } = useSync()
  const pool = chassisWithPatterns()
  const [chassisSlug, setChassisSlug] = useState(chassis ?? '')
  const [patternSlug, setPatternSlug] = useState(pattern ?? '')
  // A deep link that names a pattern lands on its Build With This, in view.
  const linked = bookPattern(chassis, pattern) !== undefined
  const act = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!linked) return
    act.current?.focus()
    act.current?.scrollIntoView?.({ block: 'center' })
  }, [linked])
  const [askSignIn, setAskSignIn] = useState(false)
  const picked = pool.find((c) => nameToSlug(c.name) === chassisSlug)
  const patterns = picked ? bookPatternsOf(picked) : []
  const chosen = patterns.find((p) => nameToSlug(p.name) === patternSlug)
  const input = picked && chosen ? mechFromBookPattern(picked, chosen) : undefined
  const starting =
    picked !== undefined && chosen !== undefined && isStartingBookPattern(picked, chosen)
  const slots = input ? loadoutSlots(input) : undefined
  const signedOut = status === 'signedOut' && !canWrite

  const build = useServerAction(
    async () => {
      if (!input) throw new Error(mechCopy('pickAChassisFirst'))
      if (!picked || !chosen) throw new Error(mechCopy('pickAChassisFirst'))
      return useUnits.getState().create('mech', {
        ...mechFromBookPattern(picked, chosen, mechNamesTaken()),
        ...(gameId === undefined ? {} : moveTo({ kind: 'game', gameId })),
      })
    },
    { failure: mechCopy('theMechCouldNotBe2') }
  )

  async function run() {
    const result = await build.run()
    if (!result.ok) return
    builtToast(result.value, !starting)
    onBuilt(result.value.id)
  }

  function ask() {
    // Signed out, the pick is kept in the address and asked for again after sign-in.
    if (signedOut) return setAskSignIn(true)
    void run()
  }

  return (
    <section aria-label={mechCopy('bookPatterns')} style={STACK}>
      <div style={ROW}>
        <div style={PICK}>
          <Field label={mechCopy('bookChassis')}>
            <Select
              aria-label={mechCopy('bookChassis')}
              value={chassisSlug}
              onChange={(e) => {
                setChassisSlug(e.target.value)
                setPatternSlug('')
              }}
              style={FILL}
            >
              <option value="">—</option>
              {pool.map((c) => (
                <option key={c.name} value={nameToSlug(c.name)}>
                  {`${c.name} (T${c.techLevel})`}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div style={PICK}>
          <Field label={mechCopy('bookPattern')}>
            <Select
              aria-label={mechCopy('bookPattern')}
              value={patternSlug}
              onChange={(e) => setPatternSlug(e.target.value)}
              disabled={!picked}
              style={FILL}
            >
              <option value="">{picked ? '—' : mechCopy('pickAChassisFirst')}</option>
              {patterns.map((p) => (
                <option key={p.name} value={nameToSlug(p.name)}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {/* Full, the height of the two fields it stands beside (§4.7). */}
        <Button
          ref={act}
          type="button"
          variant="primary"
          size="full"
          onClick={ask}
          disabled={!input || build.pending}
          aria-label={chosen ? mechCopy('buildWithThisAMech', { name: chosen.name }) : undefined}
        >
          {build.pending ? mechCopy('building') : mechCopy('buildWithThis')}
        </Button>
      </div>
      {input && slots && (
        <div style={TOTALS}>
          <Text variant="note">
            {mechCopy('slotsAndScrap', {
              systems: `${slots.systemSlotsUsed}/${slots.systemSlotsMax}`,
              modules: `${slots.moduleSlotsUsed}/${slots.moduleSlotsMax}`,
              scrap: mechScrap(input).total,
            })}
          </Text>
          {!starting && <Stat size="mini" label={mechCopy('notAStartingBuild')} />}
        </div>
      )}
      {/* Nothing was edited here: the ask names the choice, kept in the address. */}
      <SaveSignInDialog
        open={askSignIn}
        onClose={() => setAskSignIn(false)}
        pick={`/mechs/new?chassis=${chassisSlug}&pattern=${patternSlug}${
          gameId === undefined ? '' : `&game=${gameId}`
        }`}
      />
    </section>
  )
}
