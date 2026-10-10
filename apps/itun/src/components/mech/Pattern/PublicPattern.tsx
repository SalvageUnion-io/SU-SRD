/**
 * PublicPattern — one saved mech pattern's page, at `/p/pattern/:appId`
 * (issue 1276, board P2).
 *
 * It reads like a reference page and says plainly that a player made it
 * (ruleset §3.9): a hatched mech band with a dashed notch and a "User-made
 * pattern" stamp, a banner naming the maker, the maker's notes in a dashed box,
 * and a hatched foot. Everything that IS the book — the chassis art, its stat
 * column and ability, every part of the loadout — renders from the reference,
 * solid. Its credit is just "Made by [user]", never a page citation.
 *
 * Readable with no account when its maker shared it by link; by its Game's crew
 * when they shared it with the crew (`publicSheet.pattern`). Building from it,
 * and copying it to your own shelf, need an account, as every write does.
 */

import { useNavigate } from '@tanstack/react-router'
import {
  Button,
  ChapterBand,
  ReferenceEntityCard,
  Slab,
  Text,
  toast,
  tokens,
  USER_MADE_HATCH,
  UserMadeStamp,
} from 'component-lib'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import type { SURefEntity } from 'salvageunion-reference'
import {
  extractStaticEntitySummary,
  getAssetUrl,
  getChassisAbilities,
  getEntitySlug,
} from 'salvageunion-reference'
import { useConnection } from '../../../lib/connection/connectionContext'
import { serverMessage } from '../../../lib/connection/serverError'
import { itunEntityHref } from '../../../lib/entityHref'
import type { PatternVisibility } from '../../../lib/patterns/patterns'
import {
  mechFromPattern,
  patternChassis,
  patternCopy,
  patternHref,
  patternLoadout,
  slotsStats,
  slotsUsed,
} from '../../../lib/patterns/patterns'
import type { MechPattern } from '../../../lib/schemas/pattern'
import { deepLinkTo } from '../../../lib/srd-deep-link'
import { useEntityStore } from '../../../stores/entityStore'
import { usePatternStore } from '../../../stores/patternStore'
import { SignInControl } from '../../account/SignInControl'

/** `publicSheet.pattern`'s answer, its body parsed. */
export type PublicPatternAnswer = {
  pattern: MechPattern
  madeBy: string
  sharedAt: number | null
  builtCount: number
  mine: boolean
  visibility: PatternVisibility | null
}

/** The canvas's 1200px measure: with 320px loadout cells it sets three across. */
const MEASURE = '75rem'

const PAGE = { backgroundColor: tokens.color.wkBg } satisfies CSSProperties

const STAMP_LINK = { textDecoration: 'none' } satisfies CSSProperties

/** A dark `[label | value]` stamp pair, as the band's stamps are set. */
const PAIR = {
  alignItems: 'stretch',
  backgroundColor: tokens.color.paper,
  borderColor: tokens.color.ink,
  borderStyle: 'solid',
  borderWidth: tokens.borderWidth.chrome,
  color: tokens.color.ink,
  display: 'inline-flex',
  fontFamily: tokens.font.cond,
  fontSize: tokens.fontSize.badge,
  fontWeight: tokens.weight.bold,
  textTransform: 'uppercase',
} satisfies CSSProperties

const PAIR_LABEL = {
  backgroundColor: tokens.color.ink,
  color: tokens.color.paper,
  padding: `${tokens.space[2]} ${tokens.space[6]}`,
} satisfies CSSProperties

const PAIR_VALUE = { padding: `${tokens.space[2]} ${tokens.space[6]}` } satisfies CSSProperties

/** The maker banner: paper, closed by a dashed rule (ruleset §3.9). */
const BANNER = {
  backgroundColor: tokens.color.paper,
  borderBottomColor: tokens.color.ink,
  borderBottomStyle: 'dashed',
  borderBottomWidth: tokens.borderWidth.chrome,
} satisfies CSSProperties

const BANNER_ROW = {
  alignItems: 'center',
  display: 'flex',
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.caption,
  gap: tokens.space[12],
  margin: '0 auto',
  maxWidth: MEASURE,
  padding: `${tokens.space[12]} ${tokens.space[16]}`,
} satisfies CSSProperties

const BANG = {
  alignItems: 'center',
  borderColor: tokens.color.ink,
  borderStyle: 'dashed',
  borderWidth: tokens.borderWidth.chrome,
  display: 'inline-flex',
  flexShrink: 0,
  fontFamily: tokens.font.cond,
  fontWeight: tokens.weight.extrabold,
  height: '1.75rem',
  justifyContent: 'center',
  width: '1.75rem',
} satisfies CSSProperties

const BODY = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[32],
  margin: '0 auto',
  maxWidth: MEASURE,
  padding: `${tokens.space[24]} ${tokens.space[16]} ${tokens.space[48]}`,
} satisfies CSSProperties

const COLUMNS = {
  display: 'grid',
  gap: tokens.space[32],
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 26rem), 1fr))',
} satisfies CSSProperties

const COLUMN = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[16],
  minWidth: 0,
} satisfies CSSProperties

const ART = {
  alignItems: 'center',
  aspectRatio: '4 / 3',
  backgroundColor: tokens.color.paper,
  borderColor: tokens.color.ink40,
  borderStyle: 'dashed',
  borderWidth: tokens.borderWidth.hairline,
  display: 'flex',
  justifyContent: 'center',
  overflow: 'hidden',
} satisfies CSSProperties

const ART_IMG = { height: '100%', objectFit: 'contain', width: '100%' } satisfies CSSProperties

/** The maker's own words: a dashed box, not the book's. */
const NOTES = {
  backgroundColor: tokens.color.paper,
  borderColor: tokens.color.ink,
  borderStyle: 'dashed',
  borderWidth: tokens.borderWidth.chrome,
  margin: 0,
  padding: tokens.space[16],
} satisfies CSSProperties

const NOTES_LABEL = {
  display: 'block',
  fontFamily: tokens.font.cond,
  fontSize: tokens.fontSize.badge,
  fontWeight: tokens.weight.bold,
  letterSpacing: tokens.tracking.capsSnug,
  marginBottom: tokens.space[6],
  textTransform: 'uppercase',
} satisfies CSSProperties

const NOTES_TEXT = {
  fontFamily: tokens.font.body,
  fontStyle: 'italic',
  margin: 0,
} satisfies CSSProperties

/** The stat column: a two-column grid of plates, as the board draws it. */
const STATS = {
  display: 'grid',
  gap: tokens.space[8],
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
} satisfies CSSProperties

/** One stat plate: a 52px boxed number beside an ink label, 40px tall at least. */
const PLATE = {
  backgroundColor: tokens.color.paper,
  borderColor: tokens.color.ink,
  borderStyle: 'solid',
  borderWidth: tokens.borderWidth.chrome,
  display: 'flex',
  minHeight: '2.5rem',
} satisfies CSSProperties

const PLATE_VALUE = {
  alignItems: 'center',
  borderRight: `${tokens.borderWidth.chrome} solid ${tokens.color.ink}`,
  color: tokens.color.ink,
  display: 'flex',
  flexShrink: 0,
  fontFamily: tokens.font.cond,
  fontSize: tokens.fontSize.badge,
  fontWeight: tokens.weight.extrabold,
  justifyContent: 'center',
  width: '3.25rem',
} satisfies CSSProperties

const PLATE_LABEL = {
  alignItems: 'center',
  backgroundColor: tokens.color.ink,
  color: tokens.color.paper,
  display: 'flex',
  flex: 1,
  fontFamily: tokens.font.cond,
  fontSize: tokens.fontSize.badge,
  fontWeight: tokens.weight.bold,
  letterSpacing: tokens.tracking.capsSnug,
  minWidth: 0,
  padding: `0 ${tokens.space[8]}`,
  textTransform: 'uppercase',
} satisfies CSSProperties

/** The note under the stats: a 13px grey caption, aligned left. */
const STATS_NOTE = {
  color: tokens.color.ink2,
  fontFamily: tokens.font.body,
  fontSize: '13px',
  margin: 0,
  textAlign: 'left',
} satisfies CSSProperties

/** A primary action: 44px at least, in condensed caps. */
const ACTION_BUTTON = {
  fontFamily: tokens.font.cond,
  letterSpacing: tokens.tracking.capsSnug,
  minHeight: '2.75rem',
  textTransform: 'uppercase',
} satisfies CSSProperties

const ACTIONS = {
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  gap: tokens.space[12],
} satisfies CSSProperties

const LOADOUT = {
  display: 'grid',
  gap: tokens.space[12],
  gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))',
  listStyle: 'none',
  margin: 0,
  padding: 0,
} satisfies CSSProperties

const FOOT = {
  backgroundColor: tokens.color.mech,
  backgroundImage: USER_MADE_HATCH,
} satisfies CSSProperties

const FOOT_ROW = {
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  gap: tokens.space[12],
  justifyContent: 'space-between',
  margin: '0 auto',
  maxWidth: MEASURE,
  padding: `${tokens.space[12]} ${tokens.space[16]}`,
} satisfies CSSProperties

const FOOT_CHIP = {
  backgroundColor: tokens.color.paper,
  color: tokens.color.ink,
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.caption,
  padding: `${tokens.space[2]} ${tokens.space[8]}`,
} satisfies CSSProperties

const VISIBILITY_COPY: Record<PatternVisibility, string> = {
  private: 'Only you can see this pattern.',
  link: 'Anyone with the link can read and copy this pattern.',
  game: 'Your Game’s crew can read this pattern and build from it.',
}

function sharedDate(at: number): string {
  return new Date(at).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/** Open a loadout part's reference page, when the book has one for it. */
function openInReference(part: SURefEntity): (() => void) | undefined {
  const href = itunEntityHref(part)
  return href ? () => window.location.assign(href) : undefined
}

export function PublicPattern({ answer }: { answer: PublicPatternAnswer }) {
  const { pattern, madeBy, sharedAt, builtCount, mine, visibility } = answer
  const navigate = useNavigate()
  const { mode, canWrite } = useConnection()
  const [busy, setBusy] = useState<'build' | 'copy' | null>(null)

  const chassis = patternChassis(pattern)
  const loadout = patternLoadout(pattern)
  const parts = [...loadout.systems, ...loadout.modules]
  const art = chassis ? getAssetUrl(chassis) : undefined
  const stats = chassis ? extractStaticEntitySummary(chassis).stats : []
  const abilities = chassis ? (getChassisAbilities(chassis) ?? []) : []

  async function build() {
    setBusy('build')
    try {
      const mech = await useEntityStore.getState().create('mech', mechFromPattern(pattern))
      toast.success(`Built ${mech.name} from the pattern.`)
      void navigate({ to: '/sheet/$kind/$id', params: { kind: 'mech', id: mech.id } })
    } catch (err) {
      toast.error(serverMessage(err) ?? 'The mech could not be built. Try again.')
      setBusy(null)
    }
  }

  async function copy() {
    setBusy('copy')
    try {
      await usePatternStore.getState().create(patternCopy(pattern))
      toast.success(`Copied ${pattern.name} to your shelf.`)
    } catch (err) {
      toast.error(serverMessage(err) ?? 'The pattern could not be copied. Try again.')
    } finally {
      setBusy(null)
    }
  }

  const builtLine = `${builtCount} ${builtCount === 1 ? 'mech' : 'mechs'} built from it`

  return (
    <main style={PAGE}>
      <ChapterBand
        tone="mech"
        measure={MEASURE}
        userMade
        eyebrow={
          <>
            <UserMadeStamp label="User-made pattern" />
            {chassis && (
              <a
                href={deepLinkTo({ schemaName: 'chassis', slug: getEntitySlug(chassis) })}
                style={{ ...PAIR, ...STAMP_LINK }}
                aria-label={`Chassis: ${chassis.name}, in the reference`}
              >
                <span style={PAIR_LABEL}>Chassis</span>
                <span style={PAIR_VALUE}>{chassis.name} ›</span>
              </a>
            )}
            {chassis && (
              <span style={PAIR}>
                <span style={PAIR_LABEL}>TL</span>
                <span style={PAIR_VALUE}>{chassis.techLevel}</span>
              </span>
            )}
          </>
        }
      >
        &ldquo;{pattern.name}&rdquo;
      </ChapterBand>

      <div role="note" aria-label="Who made this" style={BANNER}>
        <div style={BANNER_ROW}>
          <span aria-hidden="true" style={BANG}>
            !
          </span>
          <span>
            <strong>Made by {madeBy}.</strong> Not a legal starting mech; check with your Mediator
            before you bring it to the table.
          </span>
        </div>
      </div>

      <div style={BODY}>
        <div style={COLUMNS}>
          <section style={COLUMN} aria-label="Chassis">
            <div style={ART}>
              {art && chassis ? (
                <img src={art} alt={`${chassis.name} line art`} style={ART_IMG} />
              ) : (
                <Text variant="hint">No artwork in the reference for this chassis.</Text>
              )}
            </div>
            {pattern.notes && (
              <figure style={NOTES}>
                <figcaption style={NOTES_LABEL}>Maker&rsquo;s notes</figcaption>
                <p style={NOTES_TEXT}>{pattern.notes}</p>
              </figure>
            )}
          </section>

          <section style={COLUMN} aria-label="Stats and actions">
            <div style={STATS}>
              {stats.map((s) => (
                <div key={s.label} style={PLATE}>
                  <span style={PLATE_VALUE}>{s.value}</span>
                  <span style={PLATE_LABEL}>{s.label}</span>
                </div>
              ))}
            </div>
            {chassis && (
              <p style={STATS_NOTE}>
                Stats come from the {chassis.name} chassis in the Workshop Manual.
              </p>
            )}
            {abilities.map((ability) => (
              <ReferenceEntityCard
                key={ability.id}
                data={ability}
                size="medium"
                chassisName={chassis?.name}
              />
            ))}

            <div style={ACTIONS}>
              {canWrite && mode === 'connected' ? (
                <>
                  <Button
                    variant="primary"
                    style={ACTION_BUTTON}
                    onClick={() => void build()}
                    disabled={busy !== null}
                  >
                    {busy === 'build' ? 'Building…' : 'Build this mech'}
                  </Button>
                  <Button
                    variant="ghost"
                    style={ACTION_BUTTON}
                    onClick={() => void copy()}
                    disabled={busy !== null}
                  >
                    {busy === 'copy' ? 'Copying…' : 'Copy to my shelf'}
                  </Button>
                </>
              ) : mode === 'connected' || mode === 'disconnected' ? null : (
                <>
                  <SignInControl />
                  <Text variant="hint">Sign in to build this mech or copy it to your shelf.</Text>
                </>
              )}
              <Text variant="hint">{builtLine}</Text>
            </div>
            {mine && visibility && <Text variant="hint">{VISIBILITY_COPY[visibility]}</Text>}
          </section>
        </div>

        <section aria-labelledby="pattern-loadout">
          <Slab
            variant="solid"
            id="pattern-loadout"
            label="Loadout"
            count={
              chassis
                ? `${slotsUsed(loadout.systems)}/${chassis.systemSlots} systems · ${slotsUsed(loadout.modules)}/${chassis.moduleSlots} modules`
                : undefined
            }
          />
          <ul style={LOADOUT}>
            {parts.map((part, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: a loadout may carry the same part twice
              <li key={`${part.id}-${index}`}>
                <ReferenceEntityCard
                  data={part}
                  size="medium"
                  extent="head"
                  statsOverride={slotsStats(part)}
                  onCardClick={openInReference(part)}
                />
              </li>
            ))}
          </ul>
        </section>
      </div>

      <footer style={FOOT}>
        <div style={FOOT_ROW}>
          <UserMadeStamp label={`Made by ${madeBy}`} />
          <span style={FOOT_CHIP}>
            {sharedAt !== null ? `Shared ${sharedDate(sharedAt)} · ` : ''}
            {`${window.location.host}${patternHref(pattern.id)}`}
          </span>
        </div>
      </footer>
    </main>
  )
}
