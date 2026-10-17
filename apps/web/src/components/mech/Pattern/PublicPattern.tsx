/**
 * PublicPattern — one saved mech pattern's page, at `/p/pattern/:appId`
 * (board P2).
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
 * and copying it to your own shelf, need an account, as every write does. Its
 * maker changes who can see it with the Share button every player thing
 * carries: the same "Who can see it" dialog a sheet opens (`ShareStatusDialog`).
 */

import { useNavigate } from '@tanstack/react-router'
import type { MechPattern } from 'cantina-domain/schemas/pattern'
import type { Photo } from 'cantina-domain/schemas/photo'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import {
  extractStaticEntitySummary,
  getAssetUrl,
  getChassisAbilities,
  getEntitySlug,
} from 'salvageunion-reference'
import { appPath } from '../../../lib/appBase'
import { useConnection } from '../../../lib/connection/connectionContext'
import { serverMessage } from '../../../lib/connection/serverError'
import { entityHref, itemHref } from '../../../lib/entityHref'
import { formatDay } from '../../../lib/formatDate'
import type { PatternVisibility } from '../../../lib/patterns/patterns'
import {
  mechFromPattern,
  patternChassis,
  patternCopy,
  patternHref,
  patternLoadout,
  slotsUsed,
} from '../../../lib/patterns/patterns'
import { useEntityStore } from '../../../stores/entityStore'
import { usePatternStore } from '../../../stores/patternStore'
import { SignInControl } from '../../account/SignInControl'
import {
  Button,
  ChapterBand,
  Cluster,
  Entity,
  EntityStat,
  Grid,
  quotePatternName,
  ReferenceEntityCard,
  Slab,
  Stat,
  StatColumn,
  Text,
  toast,
  tokens,
  USER_MADE_HATCH,
  UserMadeStamp,
} from '../../index'
import { EntityPhoto } from '../../shared/EntityPhoto'
import { ShareStatusDialog } from '../../sharing/ShareStatusDialog'

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

/** The line of stamps right of the title (EDL E20), below it on a phone. */
const HEAD_LINE = {
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  gap: tokens.space[8],
} satisfies CSSProperties

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

// Its side padding and centring are `.su-page-body`'s: the band's row padding.
const BODY = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[32],
  maxWidth: MEASURE,
  paddingBlock: `${tokens.space[24]} ${tokens.space[48]}`,
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

/** Open a loadout part's reference page, when the book has one for it. */

/**
 * Write the maker's photo onto their own pattern. The page reads the pattern
 * from the public query, so the shelf's copy may not have arrived yet: wait
 * for it before the store patches it, and the query hears the write back.
 */
async function setPatternPhoto(patternId: string, photo: Photo | undefined): Promise<void> {
  const store = usePatternStore.getState()
  await store.hydrate()
  await usePatternStore.getState().update(patternId, { photo })
}

export function PublicPattern({ answer }: { answer: PublicPatternAnswer }) {
  const { pattern, madeBy, sharedAt, builtCount, mine, visibility } = answer
  const navigate = useNavigate()
  const { mode, canWrite } = useConnection()
  const [busy, setBusy] = useState<'build' | 'copy' | null>(null)
  const [shareOpen, setShareOpen] = useState(false)

  const chassis = patternChassis(pattern)
  const loadout = patternLoadout(pattern)
  const parts = [...loadout.systems, ...loadout.modules]
  const art = chassis ? getAssetUrl(chassis) : undefined
  const stats = (chassis ? extractStaticEntitySummary(chassis).stats : []).map((stat) => ({
    key: stat.label,
    label: stat.label,
    value: String(stat.value),
  }))
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
      toast.success(`Copied ${pattern.name} to your Hangar.`)
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
        asideAt="notch"
        aside={
          <div style={HEAD_LINE}>
            <UserMadeStamp label="User-made pattern" />
            {/* Label-first chips (EDL E9): the chassis opens its reference
                page and Peeks it; then its tech level. */}
            {chassis && (
              <EntityStat
                label="Chassis"
                entityRef={{
                  schemaName: 'chassis',
                  id: chassis.id,
                  slug: getEntitySlug(chassis),
                  name: chassis.name,
                }}
                href={itemHref('chassis', getEntitySlug(chassis))}
              />
            )}
            {chassis && <Stat orientation="horizontal" label="TL" value={chassis.techLevel} />}
          </div>
        }
      >
        {quotePatternName(pattern.name)}
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

      <div className="su-page-body" style={BODY}>
        <Grid min="26rem" gap={32}>
          <section style={COLUMN} aria-label="Chassis">
            {/* The maker's photo where they gave one, else the chassis art. */}
            <EntityPhoto
              photo={pattern.photo}
              fallback={art && chassis ? { url: art, alt: `${chassis.name} line art` } : undefined}
              name={pattern.name}
              frame={ART}
              onChange={
                mine && canWrite ? (photo) => setPatternPhoto(pattern.id, photo) : undefined
              }
            />
            {!pattern.photo && !art && !(mine && canWrite) && (
              <div style={ART}>
                <Text variant="hint">No artwork in the reference for this chassis.</Text>
              </div>
            )}
            {pattern.notes && (
              <figure style={NOTES}>
                <figcaption style={NOTES_LABEL}>Maker&rsquo;s notes</figcaption>
                <p style={NOTES_TEXT}>{pattern.notes}</p>
              </figure>
            )}
          </section>

          <section style={COLUMN} aria-label="Stats and actions">
            {stats.length > 0 && (
              <StatColumn
                stats={stats}
                label={chassis ? `${chassis.name} stats` : 'Chassis stats'}
                compact
              />
            )}
            {chassis && (
              <p style={STATS_NOTE}>
                Stats come from the {chassis.name} chassis in the Workshop Manual.
              </p>
            )}
            {abilities.map((ability) => (
              <ReferenceEntityCard
                key={ability.id}
                data={ability}
                size="compact"
                chassisName={chassis?.name}
              />
            ))}

            <Cluster gap={12}>
              {canWrite && mode === 'connected' ? (
                <>
                  <Button
                    variant="primary"
                    style={ACTION_BUTTON}
                    onClick={() => void build()}
                    disabled={busy !== null}
                    aria-label={`Build With This: a mech from ${pattern.name}`}
                  >
                    {busy === 'build' ? 'Building…' : 'Build With This'}
                  </Button>
                  <Button
                    variant="ghost"
                    style={ACTION_BUTTON}
                    onClick={() => void copy()}
                    disabled={busy !== null}
                  >
                    {busy === 'copy' ? 'Copying…' : 'Make a copy'}
                  </Button>
                </>
              ) : mode === 'connected' || mode === 'disconnected' ? null : (
                <>
                  <SignInControl />
                  <Text variant="hint">Sign in to build this mech or copy it to your Hangar.</Text>
                </>
              )}
              <Text variant="hint">{builtLine}</Text>
            </Cluster>
            {mine && visibility && (
              <Cluster gap={12}>
                <Text variant="hint">{VISIBILITY_COPY[visibility]}</Text>
                {canWrite && mode === 'connected' && (
                  <Button
                    variant="ghost"
                    style={ACTION_BUTTON}
                    onClick={() => setShareOpen(true)}
                    aria-label={`Share ${pattern.name}`}
                  >
                    Share
                  </Button>
                )}
              </Cluster>
            )}
          </section>
        </Grid>

        <section aria-labelledby="pattern-loadout">
          <Slab
            variant="solid"
            id="pattern-loadout"
            label="Loadout"
            count={
              chassis
                ? [
                    {
                      label: 'Systems',
                      value: slotsUsed(loadout.systems),
                      max: chassis.systemSlots,
                    },
                    {
                      label: 'Modules',
                      value: slotsUsed(loadout.modules),
                      max: chassis.moduleSlots,
                    },
                  ]
                : undefined
            }
          />
          {/* A pattern's loadout is Tokens, one a line (EDL "Which form,
              where" 1), as the save page lists it. */}
          <ul aria-label="Loadout" className="su-entity-token-list">
            {parts.map((part, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: a loadout may carry the same part twice
              <li key={`${part.id}-${index}`}>
                <Entity
                  form="token"
                  context="loadout"
                  entity={part}
                  mode={{ kind: 'link', href: entityHref(part) }}
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
            {sharedAt !== null ? `Shared ${formatDay(sharedAt)} · ` : ''}
            {`${window.location.host}${appPath(patternHref(pattern.id))}`}
          </span>
        </div>
      </footer>
      {mine && (
        <ShareStatusDialog
          kind="pattern"
          id={pattern.id}
          name={pattern.name}
          open={shareOpen}
          onOpenChange={setShareOpen}
        />
      )}
    </main>
  )
}
