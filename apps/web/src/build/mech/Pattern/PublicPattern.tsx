/**
 * PublicPattern — one saved mech pattern's page, at `/p/pattern/:appId`.
 *
 * It is laid out as the book's own pattern page is (`EntityPageFrame` around
 * the card at `presentation="page"`): the chassis chapter's band, the quoted
 * title notched in, and right of it the stamps — a dashed HOMEBREW stamp
 * where a book pattern may wear Legal Starting Pattern, its Tech Level, and
 * `PATTERN OF | <chassis>` — then the art, the chassis stats, the pattern's
 * description, the chassis prose and ability, and the loadout. Three things
 * say a player made it (ruleset §3.9): the HOMEBREW stamp, the maker's own
 * description where a book pattern's prose goes, and the page's foot, which
 * cites "Homebrew // Made by [user]" where a book page cites its printings.
 *
 * Readable with no account when its maker shared it by link; by its Game's crew
 * when they shared it with the crew (`publicSheet.pattern`). Building from it,
 * and copying it to your own shelf, need an account, as every write does. Its
 * maker changes who can see it with the Share button every player thing
 * carries: the same "Who can see it" dialog a sheet opens (`ShareStatusDialog`).
 * Shared on the Reference it is homebrew, so its corner also offers Report, and a
 * site admin's Hide (`HomebrewControls`, ADR-061).
 */

import { useNavigate } from '@tanstack/react-router'
import type { MechPattern } from 'game-domain/schemas/pattern'
import type { Photo } from 'game-domain/schemas/photo'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import type { RefObjectPattern } from 'salvageunion-reference'
import { getAssetUrl, getEntitySlug, toEntityModel } from 'salvageunion-reference'
import {
  Button,
  ChapterBand,
  EntityPageStamps,
  KindLabel,
  quotePatternName,
  ReferenceEntityCard,
  resolveEntityPageMeta,
  Text,
  toast,
  tokens,
} from '../../../components/index'
import { EntityPhoto } from '../../../components/shared/EntityPhoto'
import { chapterForSchema } from '../../../lib/chapters'
import { serverMessage } from '../../../lib/connection/serverError'
import { itemHref } from '../../../lib/entityHref'
import { PAGE_MEASURE } from '../../../lib/pageMeasure'
import type { PatternVisibility } from '../../../lib/patterns/patterns'
import {
  asReferencePattern,
  mechFromPattern,
  patternChassis,
  patternCopy,
} from '../../../lib/patterns/patterns'
import { mechCopy } from '../../../messages/build-mech'
import { usePatterns } from '../../../replica/collections'
import { useSync } from '../../../replica/syncContext'
import { useUnits } from '../../../replica/units'
import { useCitePageCredit } from '../../../stores/pageCredit'
import { SignInControl } from '../../account/SignInControl'
import { HomebrewControls } from '../../homebrew/HomebrewControls'
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

/** A page's ground, as the book's pages wear it. */
const PAGE = { backgroundColor: tokens.color.wkBg } satisfies CSSProperties

/** The maker's photo: the hero's box, its edge dashed (their picture, not the book's art). */
const PHOTO_FRAME = {
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

/** What the page says under the loadout: who built it, who can see it. Its actions are the band's. */
const NOTES = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[8],
} satisfies CSSProperties

const VISIBILITY_COPY: Record<PatternVisibility, string> = {
  private: 'Only you can see this pattern.',
  link: 'Anyone with the link can read and copy this pattern.',
  game: 'Your Game’s crew can read this pattern and build from it.',
}

/**
 * The saved pattern as the book's pattern shape, its maker's notes as its
 * description: they go where a book pattern's prose goes.
 */
function pagePattern(pattern: MechPattern): RefObjectPattern {
  const notes = pattern.notes?.trim()
  return {
    ...asReferencePattern(pattern),
    ...(notes ? { content: [{ type: 'paragraph', value: notes }] } : {}),
  }
}

/**
 * Write the maker's photo onto their own pattern. The page reads the pattern
 * from the public query, so the shelf's copy may not have arrived yet: wait
 * for it before the store patches it, and the query hears the write back.
 */
async function setPatternPhoto(patternId: string, photo: Photo | undefined): Promise<void> {
  const store = usePatterns.getState()
  await store.hydrate()
  await usePatterns.getState().update(patternId, { photo })
}

export function PublicPattern({ answer }: { answer: PublicPatternAnswer }) {
  const { pattern, madeBy, builtCount, mine, visibility } = answer
  const navigate = useNavigate()
  const { status, canWrite } = useSync()
  const [busy, setBusy] = useState<'build' | 'copy' | null>(null)
  const [shareOpen, setShareOpen] = useState(false)

  // Where a book page cites its printings, this one credits its maker.
  useCitePageCredit(`Homebrew // Made by ${madeBy}`)

  const chassis = patternChassis(pattern)
  const refPattern = pagePattern(pattern)
  const meta = chassis ? resolveEntityPageMeta(chassis, refPattern) : undefined
  const art = chassis ? getAssetUrl(chassis) : undefined
  const editable = mine && canWrite
  const writable = canWrite && status === 'live'
  // Neither connected nor reconnecting: the page offers Sign in instead.
  const signedOut = !writable && status !== 'live' && status !== 'offline'

  async function build() {
    setBusy('build')
    try {
      const mech = await useUnits.getState().create('mech', mechFromPattern(pattern))
      toast.success(mechCopy('builtFromThePattern', { name: mech.name }))
      void navigate({ to: '/mechs/$id', params: { id: mech.id } })
    } catch (err) {
      toast.error(serverMessage(err) ?? mechCopy('theMechCouldNotBe2'))
      setBusy(null)
    }
  }

  async function copy() {
    setBusy('copy')
    try {
      await usePatterns.getState().create(patternCopy(pattern))
      toast.success(mechCopy('copiedToYourTrainingBay', { name: pattern.name }))
    } catch (err) {
      toast.error(serverMessage(err) ?? mechCopy('thePatternCouldNotBe'))
    } finally {
      setBusy(null)
    }
  }

  const builtLine = `${builtCount} ${builtCount === 1 ? 'mech' : 'mechs'} built from it`

  return (
    <main style={PAGE}>
      <article className="su-entity">
        <ChapterBand
          tone={chapterForSchema('chassis').tone}
          measure={PAGE_MEASURE}
          asideAt="notch"
          aside={
            meta && chassis ? (
              <EntityPageStamps
                meta={meta}
                homebrew
                parent={{
                  label: mechCopy('patternOf'),
                  ref: toEntityModel(chassis).ref,
                  href: itemHref('chassis', getEntitySlug(chassis)),
                }}
              />
            ) : undefined
          }
          // The page's actions are its head's: Build With This (or Sign in,
          // signed out) is the band's one action; Make a copy and the maker's
          // Share sit in its corner, as on a sheet.
          action={
            writable ? (
              <Button
                variant="primary"
                size="compact"
                className="su-page-action"
                onClick={() => void build()}
                disabled={busy !== null}
                aria-label={mechCopy('buildWithThisAMech', { name: pattern.name })}
              >
                {busy === 'build' ? mechCopy('building') : mechCopy('buildWithThis')}
              </Button>
            ) : signedOut ? (
              <SignInControl className="su-page-action" />
            ) : undefined
          }
          corner={
            writable ? (
              <>
                <Button
                  className="su-page-action"
                  onClick={() => void copy()}
                  disabled={busy !== null}
                >
                  {busy === 'copy' ? mechCopy('copying') : mechCopy('makeACopy')}
                </Button>
                {mine && visibility && (
                  <Button
                    className="su-page-action"
                    onClick={() => setShareOpen(true)}
                    aria-label={mechCopy('share2', { name: pattern.name })}
                  >
                    {mechCopy('share')}
                  </Button>
                )}
                <HomebrewControls appId={pattern.id} name={pattern.name} />
              </>
            ) : undefined
          }
        >
          {quotePatternName(pattern.name)}
          <KindLabel kind="Pattern" />
        </ChapterBand>

        <div className="su-entity__body su-page-body">
          {chassis ? (
            <ReferenceEntityCard
              data={chassis}
              pattern={refPattern}
              size="full"
              presentation="page"
              hero={
                // The maker's photo where they gave one, else the chassis art;
                // only its maker can change it.
                pattern.photo || editable ? (
                  <EntityPhoto
                    photo={pattern.photo}
                    fallback={
                      art
                        ? { url: art, alt: mechCopy('lineArt', { name: chassis.name }) }
                        : undefined
                    }
                    name={pattern.name}
                    frame={PHOTO_FRAME}
                    onChange={editable ? (photo) => setPatternPhoto(pattern.id, photo) : undefined}
                  />
                ) : undefined
              }
              userMade
              madeBy={madeBy}
            />
          ) : (
            <Text variant="hint">{mechCopy('theChassisThisPatternIs')}</Text>
          )}

          <section style={NOTES} aria-label={mechCopy('aboutThisPattern')}>
            {signedOut && <Text variant="hint">{mechCopy('signInToBuildThis')}</Text>}
            <Text variant="hint">{builtLine}</Text>
            {mine && visibility && <Text variant="hint">{VISIBILITY_COPY[visibility]}</Text>}
          </section>
        </div>
      </article>
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
