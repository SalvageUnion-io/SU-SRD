/**
 * PublicPattern — one saved mech pattern's page, at `/p/pattern/:appId`
 * (board P2).
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
import { useConnection } from '../../../lib/connection/connectionContext'
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
import { useEntityStore } from '../../../stores/entityStore'
import { useCitePageCredit } from '../../../stores/pageCredit'
import { usePatternStore } from '../../../stores/patternStore'
import { SignInControl } from '../../account/SignInControl'
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
  const store = usePatternStore.getState()
  await store.hydrate()
  await usePatternStore.getState().update(patternId, { photo })
}

export function PublicPattern({ answer }: { answer: PublicPatternAnswer }) {
  const { pattern, madeBy, builtCount, mine, visibility } = answer
  const navigate = useNavigate()
  const { mode, canWrite } = useConnection()
  const [busy, setBusy] = useState<'build' | 'copy' | null>(null)
  const [shareOpen, setShareOpen] = useState(false)

  // Where a book page cites its printings, this one credits its maker.
  useCitePageCredit(`Homebrew // Made by ${madeBy}`)

  const chassis = patternChassis(pattern)
  const refPattern = pagePattern(pattern)
  const meta = chassis ? resolveEntityPageMeta(chassis, refPattern) : undefined
  const art = chassis ? getAssetUrl(chassis) : undefined
  const editable = mine && canWrite
  const writable = canWrite && mode === 'connected'
  // Neither connected nor reconnecting: the page offers Sign in instead.
  const signedOut = !writable && mode !== 'connected' && mode !== 'disconnected'

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
      toast.success(`Copied ${pattern.name} to your Training Bay.`)
    } catch (err) {
      toast.error(serverMessage(err) ?? 'The pattern could not be copied. Try again.')
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
                  label: 'Pattern of',
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
                className="su-page-action su-hit-area"
                onClick={() => void build()}
                disabled={busy !== null}
                aria-label={`Build With This: a mech from ${pattern.name}`}
              >
                {busy === 'build' ? 'Building…' : 'Build With This'}
              </Button>
            ) : signedOut ? (
              <SignInControl className="su-page-action su-hit-area" />
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
                  {busy === 'copy' ? 'Copying…' : 'Make a copy'}
                </Button>
                {mine && visibility && (
                  <Button
                    className="su-page-action"
                    onClick={() => setShareOpen(true)}
                    aria-label={`Share ${pattern.name}`}
                  >
                    Share
                  </Button>
                )}
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
                    fallback={art ? { url: art, alt: `${chassis.name} line art` } : undefined}
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
            <Text variant="hint">
              The chassis this pattern is built on is not in the reference.
            </Text>
          )}

          <section style={NOTES} aria-label="About this pattern">
            {signedOut && (
              <Text variant="hint">
                Sign in to build this mech or copy it to your Training Bay.
              </Text>
            )}
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
