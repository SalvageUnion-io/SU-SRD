// MOCK (front): the home page as a product page. Its parts, each from the
// site's own primitives: the pitch (`FrontPitch`), "What's inside" as the stat
// column's framed numerals (`StatColumn`), the hero plate (`CardImage hero`,
// art from R2), the three doors (`StartHere` tiles with art), and the Buy the
// game panel (`TitledBox` on ink, the licence on its cite cut-out). Not
// shipped code.
import type { ReactNode } from 'react'
import { findEntityBySlug, getAssetUrl } from 'salvageunion-reference'
import type { StartHereStep } from '../components/index'
import {
  assetSrcSetFor,
  Badge,
  Button,
  CardImage,
  EntityCardIdentityFooter,
  FrontPitch,
  SlabSection,
  StartHere,
  StatColumn,
  TitledBox,
} from '../components/index'
import { appPath } from '../lib/appBase'
import type { SrdChapter } from '../lib/chapters'
import { BUY_HREF } from '../lib/docPages'
import { compositionsCopy } from '../messages/components-compositions'

/** An entity's R2 art, or nothing when the dataset no longer has it. */
function artOf(schema: Parameters<typeof findEntityBySlug>[0], slug: string, alt: string) {
  const entity = findEntityBySlug(schema, slug)
  const url = entity ? getAssetUrl(entity) : undefined
  if (!entity || !url) return undefined
  const srcSet = assetSrcSetFor(url)
  return srcSet ? { url, srcSet, alt } : { url, alt }
}

/** The hero: the pitch and what's inside at the left, the art plate at the right. */
export function HomeHero({ chapters }: { chapters: SrdChapter[] }) {
  const art = artOf('bio-titans', 'typhon', 'A Mech faces the Bio-Titan Typhon')
  return (
    <section className="su-front__hero" aria-label="SalvageUnion.io">
      <div className="su-front__pitch">
        <FrontPitch
          value="Every rule in the book. A builder for your crew. A table to play at."
          actions={
            <>
              <Button href={appPath('/')} linkAs="a" variant="primary" size="full">
                Start building
              </Button>
              <Button href="#contents" variant="default" size="full">
                Read the rules
              </Button>
            </>
          }
          note="Reading needs no account. Building and playing are free with a Discord sign-in."
        >
          The free, fan-made companion to Salvage Union, the post-apocalyptic mech tabletop RPG by
          Leyline Press.
        </FrontPitch>
        <HomeInside chapters={chapters} />
      </div>
      {art && (
        <div className="su-front__plate">
          <CardImage hero {...art} />
          <p className="su-front__plate-cite">{'Typhon // Art by Leyline Press'}</p>
        </div>
      )}
    </section>
  )
}

/** The counts "What's inside" shows, by the catalog's schema id, in the book's order. */
const INSIDE: readonly { schemaId: string; label: string }[] = [
  { schemaId: 'chassis', label: 'Chassis' },
  { schemaId: 'systems', label: 'Systems' },
  { schemaId: 'modules', label: 'Modules' },
  { schemaId: 'classes', label: 'Pilot classes' },
  { schemaId: 'abilities', label: 'Abilities' },
  { schemaId: 'equipment', label: 'Equipment' },
  { schemaId: 'bio-titans', label: 'Bio-Titans' },
  { schemaId: 'roll-tables', label: 'Roll tables' },
]

/** What's inside: real counts from the reference data, as framed numerals. */
function HomeInside({ chapters }: { chapters: SrdChapter[] }) {
  const counts = new Map(chapters.flatMap((c) => c.rows.map((r) => [r.schemaId, r.count] as const)))
  const stats = INSIDE.flatMap(({ schemaId, label }) => {
    const count = counts.get(schemaId)
    return count === undefined
      ? []
      : [{ key: schemaId, label, value: String(count), group: 'capacity' as const }]
  })
  return (
    <SlabSection title="What’s inside" as="h2" page className="su-front__inside">
      <StatColumn stats={stats} label="What’s inside" />
    </SlabSection>
  )
}

/** The three doors: Reference, Build, Play, each in its band colour. */
export function HomeDoors() {
  const doors: StartHereStep[] = [
    {
      key: 'reference',
      title: 'Reference',
      tone: 'wk-line',
      stamp: 'No account',
      body: 'The whole book, searchable: every Chassis, System, Module, Ability and rule, cited to its page.',
      art: artOf('chassis', 'mule', 'The Mule chassis'),
    },
    {
      key: 'build',
      title: 'Build',
      tone: 'pilot',
      stamp: 'Free',
      body: 'Make a Pilot, a Mech and a Union Crawler step by step, or copy the Starter Set crew and make it yours.',
      art: artOf('classes', 'engineer', 'An Engineer pilot'),
    },
    {
      key: 'play',
      title: 'Play',
      tone: 'crawler',
      stamp: 'Free',
      body: 'Run your sheets at the table: roll, spend and take damage, solo or with your crew in one shared Game.',
      art: artOf('bio-titans', 'scylla', 'The Bio-Titan Scylla'),
    },
  ]
  return (
    <StartHere
      id="three-ways-in"
      title="Three ways in"
      steps={doors}
      numbered={false}
      hrefs={{ reference: '#contents', build: appPath('/'), play: appPath('/play/') }}
    />
  )
}

/** The foot's cut-out line on the Buy panel: the licence line the site footer prints. */
function Licence(): ReactNode {
  return compositionsCopy('salvageUnionIsCopyrightedBy')
}

/**
 * Buy the game: Leyline Press made Salvage Union, and this site only stands on
 * it. One ink panel, said plainly, with the store's link as an ink button
 * (never the page's rust) and the licence on the foot's cut-out.
 */
export function BuyTheGame({ books }: { books: readonly string[] }) {
  return (
    <TitledBox
      title="Buy the game"
      titleAs="h2"
      tone="ink"
      as="section"
      body="flush"
      className="su-front__buy"
      chips={
        <Badge shape="stamp" size="compact" surface="inverse">
          By Leyline Press
        </Badge>
      }
    >
      <div className="su-front__buy-body">
        <div className="su-front__buy-copy">
          <p className="su-front__buy-lede">
            Salvage Union is written and published by Leyline Press. This site is a companion to the
            books, not a replacement for them.
          </p>
          <p>
            The books hold the setting, the art and the adventures. If you like what you find here,
            the best way to support the game is to buy it from the people who made it.
          </p>
          <div className="su-front__buy-actions">
            <Button
              href={BUY_HREF}
              target="_blank"
              rel="noopener noreferrer"
              variant="ink"
              size="full"
            >
              Buy from Leyline Press
            </Button>
            <Button href="/starter/" variant="default" size="full">
              Got the Starter Set?
            </Button>
          </div>
        </div>
        <ul className="su-front__books" aria-label="The books this site cites">
          {books.map((book) => (
            <li key={book}>{book}</li>
          ))}
        </ul>
      </div>
      <EntityCardIdentityFooter
        provenance={undefined}
        size="compact"
        credit={<Licence />}
        band={{ bandColor: 'var(--color-ink)', onBand: 'paper' }}
        grain="paper"
      />
    </TitledBox>
  )
}
