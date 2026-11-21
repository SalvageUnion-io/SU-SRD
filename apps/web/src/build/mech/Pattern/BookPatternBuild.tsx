/**
 * BookPatternBuild — the New Mech screen's book patterns: pick a chassis, then
 * one of the patterns it prints, and build the mech as printed. Every pattern
 * of every chassis is here, whatever its Tech Level; one past the starting
 * budget says so and asks before it builds (a Blank-family shortcut, as a
 * saved pattern's Build With This). A Reference pattern page's Build With
 * This lands here with its pattern picked (`?chassis=&pattern=`).
 */

import { moveTo } from 'game-domain/container'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import { nameToSlug } from 'salvageunion-reference'
import { ConfirmDialog } from '../../../components/app'
import { Button, Field, Select, Stat, Text, tokens } from '../../../components/index'
import { useServerAction } from '../../../lib/connection/useServerAction'
import {
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
  const [confirming, setConfirming] = useState(false)
  const [askSignIn, setAskSignIn] = useState(false)
  const picked = pool.find((c) => nameToSlug(c.name) === chassisSlug)
  const patterns = picked ? bookPatternsOf(picked) : []
  const chosen = patterns.find((p) => nameToSlug(p.name) === patternSlug)
  const input = picked && chosen ? mechFromBookPattern(picked, chosen) : undefined
  const starting =
    picked !== undefined && chosen !== undefined && isStartingBookPattern(picked, chosen)
  const slots = input ? loadoutSlots(input) : undefined

  const build = useServerAction(
    async () => {
      if (!input) throw new Error(mechCopy('pickAChassisFirst'))
      return useUnits.getState().create('mech', {
        ...input,
        ...(gameId === undefined ? {} : moveTo({ kind: 'game', gameId })),
      })
    },
    { failure: mechCopy('theMechCouldNotBe2') }
  )

  async function run() {
    const result = await build.run()
    if (result.ok) onBuilt(result.value.id)
  }

  function ask() {
    // Signed out, the pick is kept in the address and asked for again after sign-in.
    if (status === 'signedOut' && !canWrite) return setAskSignIn(true)
    if (starting) return void run()
    setConfirming(true)
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
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={mechCopy('buildAMechFrom', { name: chosen?.name ?? '' })}
        body={mechCopy('thisMayExceedTheStarting')}
        confirmLabel={mechCopy('build')}
        onConfirm={() => void run()}
      />
      <SaveSignInDialog open={askSignIn} onClose={() => setAskSignIn(false)} />
    </section>
  )
}
