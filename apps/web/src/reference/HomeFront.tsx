// The home page's parts under its band, each from the site's own primitives:
// the pitch (`FrontPitch`) beside the hero plate (`CardImage hero`, art from
// R2), the three ways in (`StartHere` tiles with art), Buy the game (a
// `TitledBox` on ink holding the books as a Ledger, the licence on its cite
// cut-out) and the Discord bot's panel.
import type { RefEnumSchemaName } from 'salvageunion-reference'
import {
  findEntityBySlug,
  getAssetUrl,
  getEntitySlug,
  SalvageUnionReference,
} from 'salvageunion-reference'
import type { LedgerColumn, StartHereStep } from '../components/index'
import {
  assetSrcSetFor,
  Badge,
  Button,
  CardImage,
  EntityCardIdentityFooter,
  FrontPitch,
  Ledger,
  StartHere,
  TitledBox,
} from '../components/index'
import { appPath } from '../lib/appBase'
import { DISCORD_INSTALL_URL } from '../lib/constants'
import { BUY_HREF } from '../lib/docPages'
import { itemHref } from '../lib/entityHref'
import { compositionsCopy } from '../messages/components-compositions'
import { referenceCopy } from '../messages/reference'

/** An entity's R2 art, or nothing when the dataset no longer has it. */
function artOf(schema: RefEnumSchemaName, slug: string, alt: string) {
  const entity = findEntityBySlug(schema, slug)
  const url = entity ? getAssetUrl(entity) : undefined
  if (!entity || !url) return undefined
  const srcSet = assetSrcSetFor(url)
  return srcSet ? { url, srcSet, alt } : { url, alt }
}

/** The hero: the pitch at the left, the art plate at the right. */
export function HomeHero() {
  const art = artOf('bio-titans', 'typhon', referenceCopy('heroArt'))
  return (
    <section className="su-front__hero" aria-label={referenceCopy('siteName')}>
      <div className="su-front__pitch">
        <FrontPitch
          value={referenceCopy('pitchValue')}
          actions={
            <>
              <Button href={appPath('/')} linkAs="a" variant="primary" size="full">
                {referenceCopy('startBuilding')}
              </Button>
              <Button href="#contents" variant="default" size="full">
                {referenceCopy('readTheRules')}
              </Button>
            </>
          }
          note={referenceCopy('pitchNote')}
        >
          {referenceCopy('pitchLede')}
        </FrontPitch>
      </div>
      {art && (
        <div className="su-front__plate">
          <CardImage hero {...art} />
          <p className="su-front__plate-cite">{referenceCopy('heroArtCite')}</p>
        </div>
      )}
    </section>
  )
}

/** The three ways in: Reference, Build, Play, each in its band colour. */
export function HomeDoors() {
  const doors: StartHereStep[] = [
    {
      key: 'reference',
      title: referenceCopy('doorReference'),
      tone: 'wk-line',
      stamp: referenceCopy('noAccount'),
      body: referenceCopy('doorReferenceBody'),
      art: artOf('chassis', 'mule', referenceCopy('doorReferenceArt')),
    },
    {
      key: 'build',
      title: referenceCopy('doorBuild'),
      tone: 'pilot',
      stamp: referenceCopy('free'),
      body: referenceCopy('doorBuildBody'),
      art: artOf('classes', 'engineer', referenceCopy('doorBuildArt')),
    },
    {
      key: 'play',
      title: referenceCopy('doorPlay'),
      tone: 'crawler',
      stamp: referenceCopy('free'),
      body: referenceCopy('doorPlayBody'),
      art: artOf('bio-titans', 'scylla', referenceCopy('doorPlayArt')),
    },
  ]
  return (
    <StartHere
      id="three-ways-in"
      title={referenceCopy('threeWaysIn')}
      steps={doors}
      numbered={false}
      hrefs={{ reference: '#contents', build: appPath('/'), play: appPath('/play/') }}
    />
  )
}

const BOOK_COLUMNS: readonly LedgerColumn[] = [
  { key: 'version', label: referenceCopy('version'), kind: 'text', phone: true },
]

/**
 * Buy the game: Leyline Press made Salvage Union, and this site only stands on
 * it. One ink panel, said plainly, with the store's link as an ink button
 * (never the page's rust), the books the site cites as a Ledger (ledger.md
 * L1), each opening its page, and the licence on the foot's cut-out.
 */
export function BuyTheGame() {
  const books = SalvageUnionReference.Sources.all()
  return (
    <TitledBox
      title={referenceCopy('buyTheGame')}
      titleAs="h2"
      tone="ink"
      as="section"
      body="flush"
      className="su-front__buy"
      chips={
        <Badge shape="stamp" size="compact" surface="inverse">
          {referenceCopy('byLeylinePress')}
        </Badge>
      }
    >
      <div className="su-front__buy-body">
        <div className="su-front__buy-copy">
          <p className="su-front__buy-lede">{referenceCopy('buyLede')}</p>
          <p>{referenceCopy('buyBody')}</p>
          <div className="su-front__buy-actions">
            <Button
              href={BUY_HREF}
              target="_blank"
              rel="noopener noreferrer"
              variant="ink"
              size="full"
            >
              {referenceCopy('buyFromLeylinePress')}
            </Button>
            <Button href="/starter/" variant="default" size="full">
              {referenceCopy('gotTheStarterSet')}
            </Button>
          </div>
        </div>
        <div className="su-front__books">
          <Ledger
            label={referenceCopy('theBooksThisSiteCites')}
            nameLabel={referenceCopy('books')}
            columns={BOOK_COLUMNS}
            rows={books.map((book) => ({
              id: book.id,
              name: book.name,
              entityRef: undefined,
              href: itemHref('sources', getEntitySlug(book)),
              cells: [book.version ?? ''],
            }))}
          />
        </div>
      </div>
      <EntityCardIdentityFooter
        provenance={undefined}
        size="compact"
        credit={compositionsCopy('salvageUnionIsCopyrightedBy')}
        band={{ bandColor: 'var(--color-ink)', onBand: 'paper' }}
        grain="paper"
      />
    </TitledBox>
  )
}

/** Discord's mark (Simple Icons, CC0), drawn in the button's text colour. */
const DISCORD_MARK =
  'M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z'

/**
 * In your server: the SalvageUnion.io Discord bot, one line on what it does
 * beside its button. The button is Discord's blurple (a one-off exception to
 * the tone palette) with Discord's mark, opening the bot's install link; the
 * site footer links `/bot`, which documents the commands.
 */
export function InYourServer() {
  return (
    <TitledBox
      title={referenceCopy('inYourServer')}
      titleAs="h2"
      tone="discord"
      as="section"
      bodyClassName="su-front__bot"
    >
      <p>{referenceCopy('inYourServerBody')}</p>
      <Button
        href={DISCORD_INSTALL_URL}
        target="_blank"
        rel="noopener noreferrer"
        id="discord-bot"
        variant="ink"
        size="full"
        className="su-front__discord"
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
          className="su-front__discord-mark"
        >
          <path fill="currentColor" d={DISCORD_MARK} />
        </svg>
        {referenceCopy('onDiscord')}
      </Button>
    </TitledBox>
  )
}
