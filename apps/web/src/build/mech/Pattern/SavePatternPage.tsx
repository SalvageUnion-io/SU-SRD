/**
 * SavePatternPage — save a mech's chassis and loadout as a pattern (board
 * P1). The body of `/mechs/patterns/new?from=<mechId>`.
 *
 * The left column is WHAT GETS SAVED, shown as the reference cards it is —
 * solid, because every part of it is the book's. The right column is the only
 * part the player writes (a name and notes), who may read it, and a preview of
 * the pattern card as others will see it: dashed and User-made, credited to its
 * maker (ruleset §3.9).
 *
 * Damage, Heat and cargo stay on the mech (`patternFromMech`). Saving is two
 * server-first writes: the pattern (through `patternStore`), then — unless it
 * stays the maker's alone — who may read it. A failed second write leaves a
 * pattern only its maker can see, which is the safe way round.
 */

import { useMutation, useQuery } from 'convex/react'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import type { RefEntity } from 'salvageunion-reference'
import { STAT_LABELS } from 'salvageunion-reference'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { useConnection } from '../../../lib/connection/connectionContext'
import { useServerAction } from '../../../lib/connection/useServerAction'
import { useHydrateEntities, useMech } from '../../../lib/entities'
import type { PatternVisibility } from '../../../lib/patterns/patterns'
import {
  asReferencePattern,
  patternChassis,
  patternFromMech,
  patternLoadout,
  slotsUsed,
} from '../../../lib/patterns/patterns'
import { usePatternStore } from '../../../stores/patternStore'
import type { SlabCount } from '../../../components/index'
import {
  Button,
  ChapterBand,
  Cluster,
  Entity,
  Field,
  FieldError,
  Grid,
  Input,
  Radio,
  ReferenceEntityCard,
  Select,
  Slab,
  Text,
  Textarea,
  tokens,
} from '../../../components/index'
import { AppLink } from '../../../components/shared/AppLink'
import { NotFoundPanel } from '../../../components/shared/RouteFallbacks'
import { WritesBlockedNotice } from '../../../components/shared/WritesBlockedNotice'

const PAGE = {
  backgroundColor: tokens.color.wkBg,
  minHeight: '100%',
  paddingBottom: tokens.space[48],
} satisfies CSSProperties

/** Two columns where there is room for them; one, stacked, where there is not. */
const COLUMNS = {
  margin: '0 auto',
  maxWidth: '80rem',
  padding: `${tokens.space[24]} ${tokens.space[16]} 0`,
} satisfies CSSProperties

const COLUMN = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[12],
  minWidth: 0,
} satisfies CSSProperties

const LIST = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[8],
  listStyle: 'none',
  margin: 0,
  padding: 0,
} satisfies CSSProperties

const CRUMBS = {
  color: tokens.color.ink,
  fontFamily: tokens.font.cond,
  fontSize: tokens.fontSize.caption,
  fontWeight: tokens.weight.bold,
} satisfies CSSProperties

const CRUMB_LINK = { color: tokens.color.ink } satisfies CSSProperties

/** The pencil look of a field the player writes (ruleset §1, the edit field). */
const PENCIL = { borderStyle: 'dashed' } satisfies CSSProperties

const FIELDSET = {
  border: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[8],
  margin: 0,
  padding: 0,
} satisfies CSSProperties

const LEGEND = {
  fontFamily: tokens.font.cond,
  fontSize: tokens.fontSize.badge,
  fontWeight: tokens.weight.bold,
  letterSpacing: tokens.tracking.capsSnug,
  marginBottom: tokens.space[8],
  padding: 0,
  textTransform: 'uppercase',
} satisfies CSSProperties

/** A primary action: 44px at least, in condensed caps. */
const ACTION_BUTTON = {
  fontFamily: tokens.font.cond,
  letterSpacing: tokens.tracking.capsSnug,
  minHeight: tokens.size.full,
  textTransform: 'uppercase',
} satisfies CSSProperties

/** The rule, said once where the player is about to make something. */
const RULE_NOTE = {
  borderColor: tokens.color.ink,
  borderStyle: 'dashed',
  borderWidth: tokens.borderWidth.chrome,
  color: tokens.color.ink,
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.caption,
  padding: tokens.space[12],
} satisfies CSSProperties

const NOT_LEGAL = {
  color: tokens.color.ink2,
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.caption,
  fontStyle: 'italic',
  margin: 0,
} satisfies CSSProperties

const NOTES = {
  color: tokens.color.ink,
  fontFamily: tokens.font.body,
  margin: `${tokens.space[4]} 0 0`,
} satisfies CSSProperties

type SavePatternPageProps = {
  /** The mech the pattern is saved from. */
  mechId: string
  /** After both writes land: where to go is the route's call. */
  onSaved: (patternId: string, visibility: PatternVisibility) => void
  onCancel: () => void
}

/** What a pattern is cut from: a mech's chassis and loadout. */
type PatternSource = Parameters<typeof patternFromMech>[0]

export function SavePatternPage({ mechId, onSaved, onCancel }: SavePatternPageProps) {
  const hydrated = useHydrateEntities(['mech'])
  const mech = useMech(mechId)
  const { mode, canWrite } = useConnection()
  const connected = mode === 'connected'
  const me = useQuery(api.account.me, connected ? {} : 'skip')
  const games = useQuery(api.games.listMine, connected ? {} : 'skip')
  const setVisibility = useMutation(api.shelf.setPatternVisibility)

  const [name, setName] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [visibility, setVisibilityChoice] = useState<PatternVisibility>('private')
  const [pickedGame, setPickedGame] = useState<string | null>(null)
  // The form's own complaint; a failed save is `savePattern.error`.
  const [invalid, setInvalid] = useState<string | null>(null)
  const savePattern = useServerAction(
    async (source: PatternSource, patternName: string, gameId: string | null) => {
      const pattern = await usePatternStore
        .getState()
        .create(patternFromMech(source, { name: patternName, notes }))
      if (visibility !== 'private') {
        await setVisibility({
          patternId: pattern.id,
          visibility,
          ...(visibility === 'game' && gameId ? { gameId: gameId as Id<'games'> } : {}),
        })
      }
      return pattern.id
    },
    { failure: 'The pattern could not be saved. Try again.' }
  )
  const saving = savePattern.pending
  const error = invalid ?? savePattern.error

  // Not "not found" before the shelf has loaded: that would flash on every visit.
  if (!mech && !hydrated) return null
  if (!mech) {
    return (
      <NotFoundPanel
        title="Mech not found"
        message="A pattern is saved from one of your mechs. This one may have been deleted, or the link may be stale."
        back={{ href: '/mechs/patterns', label: 'Mech Patterns' }}
      />
    )
  }

  const chassis = patternChassis(mech)
  const loadout = patternLoadout(mech)
  const patternName = name ?? mech.name
  // The mech's own Game first: "my Game's crew" is the crew it plays with.
  const gameChoices = games ?? []
  const gameId =
    pickedGame ??
    (mech.gameId && gameChoices.some((g) => g._id === mech.gameId) ? mech.gameId : null) ??
    gameChoices[0]?._id ??
    null
  const gameName = gameChoices.find((g) => g._id === gameId)?.name
  const madeBy = me?.displayName ?? 'a player'

  async function save() {
    if (!mech) return
    if (!patternName.trim()) {
      setInvalid('A pattern needs a name.')
      return
    }
    setInvalid(null)
    const result = await savePattern.run(mech, patternName, gameId)
    if (result.ok) onSaved(result.value, visibility)
  }

  const systemsCount: SlabCount = {
    label: 'Slots',
    value: slotsUsed(loadout.systems),
    ...(chassis ? { max: chassis.systemSlots } : {}),
  }
  const modulesCount: SlabCount = {
    label: 'Slots',
    value: slotsUsed(loadout.modules),
    ...(chassis ? { max: chassis.moduleSlots } : {}),
  }

  return (
    <main style={PAGE}>
      <ChapterBand
        tone="mech"
        measure="80rem"
        eyebrow={
          <nav aria-label="Breadcrumb" style={CRUMBS}>
            <AppLink href="/" style={CRUMB_LINK}>
              Hangar
            </AppLink>
            {' / '}
            <AppLink href={`/sheet/mech/${mech.id}`} style={CRUMB_LINK}>
              {mech.name}
            </AppLink>
            {' / '}
            <span aria-current="page">Save as pattern</span>
          </nav>
        }
      >
        Save as pattern
      </ChapterBand>

      <Grid min="26rem" gap={32} style={COLUMNS}>
        <section style={COLUMN} aria-labelledby="pattern-saved">
          <Slab
            id="pattern-saved"
            label="What gets saved"
            count={`from your ${mech.name}`}
          />
          <Text variant="body">
            A pattern keeps the chassis and its loadout. Damage, Heat and cargo stay on the mech; a
            new mech built from the pattern starts fresh.
          </Text>
          {chassis && <Entity form="row" entity={chassis} />}
          <LoadoutList label="Systems" count={systemsCount} items={loadout.systems} />
          <LoadoutList label="Modules" count={modulesCount} items={loadout.modules} />
          <Text variant="hint">
            Everything here is reference content, so it keeps a solid frame. Only the pattern itself
            is user-made.
          </Text>
        </section>

        <section style={COLUMN} aria-labelledby="pattern-yours">
          <Slab id="pattern-yours" label="Your pattern" />
          <Field label="Pattern name" htmlFor="pattern-name">
            <Input
              id="pattern-name"
              value={patternName}
              onChange={(e) => setName(e.target.value)}
              style={PENCIL}
              required
            />
          </Field>
          <Field label="Notes for whoever builds it" htmlFor="pattern-notes">
            <Textarea
              id="pattern-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              style={PENCIL}
            />
          </Field>

          <fieldset style={FIELDSET}>
            <legend style={LEGEND}>Who can see it</legend>
            <Radio
              stacked
              name="pattern-visibility"
              value="private"
              checked={visibility === 'private'}
              onChange={() => setVisibilityChoice('private')}
              label="Only me"
              description="Kept in your Hangar. Build mechs from it any time."
            />
            <Radio
              stacked
              name="pattern-visibility"
              value="link"
              checked={visibility === 'link'}
              onChange={() => setVisibilityChoice('link')}
              label="Anyone with the link"
              description="A public pattern page, like a reference page, that anyone can read and copy."
            />
            <Radio
              stacked
              name="pattern-visibility"
              value="game"
              checked={visibility === 'game'}
              onChange={() => setVisibilityChoice('game')}
              disabled={gameId === null}
              label="My Game’s crew"
              description={
                gameId === null
                  ? 'Join or start a Game to share with its crew.'
                  : `Everyone in ${gameName} can see it and build from it.`
              }
            />
            {visibility === 'game' && gameChoices.length > 1 && (
              <Field label="Which Game" htmlFor="pattern-game">
                <Select
                  id="pattern-game"
                  value={gameId ?? ''}
                  onChange={(e) => setPickedGame(e.target.value)}
                >
                  {gameChoices.map((g) => (
                    <option key={g._id} value={g._id}>
                      {g.name}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
          </fieldset>

          <span style={LEGEND}>How it will look to others</span>
          {chassis && (
            <ReferenceEntityCard
              data={chassis}
              pattern={asReferencePattern({ ...mech, name: patternName || mech.name })}
              size="compact"
              extent="full"
              hide={{ content: true, actions: true, patterns: true, rollTable: true, image: true }}
              statsOverride={[
                { key: 'tl', label: 'TL', value: chassis.techLevel, group: 'provenance' },
                {
                  key: 'sys',
                  label: STAT_LABELS.systemSlots.short,
                  group: 'capacity',
                  value: `${slotsUsed(loadout.systems)}/${chassis.systemSlots}`,
                },
                {
                  key: 'mod',
                  label: STAT_LABELS.moduleSlots.short,
                  group: 'capacity',
                  value: `${slotsUsed(loadout.modules)}/${chassis.moduleSlots}`,
                },
              ]}
              afterExtraContent={
                <>
                  <p style={NOT_LEGAL}>Not a legal starting mech</p>
                  {notes.trim() && <p style={NOTES}>{notes.trim()}</p>}
                </>
              }
              userMade
              madeBy={madeBy}
            />
          )}

          {error && <FieldError>{error}</FieldError>}
          <Cluster gap={12}>
            {canWrite ? (
              <Button
                variant="primary"
                style={ACTION_BUTTON}
                onClick={() => void save()}
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Save pattern'}
              </Button>
            ) : (
              <WritesBlockedNotice />
            )}
            <Button variant="ghost" style={ACTION_BUTTON} onClick={onCancel} disabled={saving}>
              Cancel
            </Button>
          </Cluster>

          <p style={RULE_NOTE}>
            <strong>User-made, always marked.</strong> Anything players make wears a dashed frame, a
            dashed User-made stamp and its maker&rsquo;s name in place of a page citation. Canon is
            solid; homebrew is dashed. Nobody can make it look like the Workshop Manual.
          </p>
        </section>
      </Grid>
    </main>
  )
}

/** One loadout group as solid reference shortforms: these parts are the book's. */
function LoadoutList({
  label,
  count,
  items,
}: {
  label: string
  count: SlabCount
  items: RefEntity[]
}) {
  if (items.length === 0) return null
  return (
    <>
      <Slab label={label} count={count} />
      <ul style={LIST} aria-label={label}>
        {items.map((item, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: a loadout may carry the same part twice
          <li key={`${item.id}-${index}`}>
            <Entity form="token" context="loadout" entity={item} />
          </li>
        ))}
      </ul>
    </>
  )
}
