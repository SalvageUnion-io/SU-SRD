import { Dialog } from '@base-ui/react/dialog'
import { X } from 'lucide-react'
import type { CSSProperties, ElementType, ReactNode } from 'react'
import type { RefEntity, RefMetaEntity, RefObjectAnyPattern } from 'salvageunion-reference'
import { toEntityModel } from 'salvageunion-reference'
import { foregroundOn } from '../../design/contrast'
import { borderWidth, color, space } from '../../design/tokens'
import { buttonVariants } from '../atoms/buttonVariants'
import { ChapterBand } from '../atoms/ChapterBand'
import type { ChapterTone } from '../atoms/chapterBandColor'
import { CHAPTER_BAND_COLOR } from '../atoms/chapterBandColor'
import { ModalShell } from '../containers/ModalShell'
import { EntityStat } from '../entity/parts/EntityStat'
import { KindLabel } from '../entity/parts/KindLabel'
import { EntityCardIdentityFooter } from './card/EntityCardIdentityFooter'
import { EntityPageStamps } from './card/EntityPageStamps'
import { resolveCardTone } from './card/entityCardTone'
import { resolveEntityPageMeta } from './card/entityPage'
import { isLegalStartingPatternOf } from './card/legalStartingPattern'
import { resolveFooterProvenance } from './card/provenance'
import { useEntityExternalLink } from './entityHrefContext'
import { textBand } from './referenceEntityHelpers'

type EntityDetailDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The entity the Page is of: its band and its foot read it. */
  entity: RefMetaEntity
  /** The Page is of this pattern of `entity` (a chassis's), not of `entity` itself. */
  pattern?: RefObjectAnyPattern
  /**
   * The Page's title, notched into its band, and the dialog's name: the
   * entity's name, a pattern's quoted name, an action without its host's
   * ` (Host)` suffix.
   */
  title: string
  /** The Page's body: the card at `presentation="page"`. */
  children: ReactNode
}

/**
 * The large lift shadow's tint: neutral black at 10%. There is
 * no shadow token ladder to move it onto, and a warm-ink substitute would
 * re-tone the stamp's shadow, so it stays one literal, exempted on its line.
 */
const shadowTint = 'rgb(0 0 0 / 0.1)' // design-tokens-ignore: the large lift shadow's tint, neutral black

/**
 * The close stamp's placement and paper edge. Its ink fill and hover are
 * Button's `ink` variant.
 *
 * The shadow is inline on purpose: the `shadow-lg` utility it replaced sat in
 * a layer above `.su-focus-ring:focus-visible`, so the stamp always wore this
 * shadow — and an inline value keeps exactly that.
 */
const closeStyle = {
  position: 'absolute',
  top: `-${space[8]}`,
  right: `-${space[8]}`,
  zIndex: 60,
  borderWidth: '2px',
  borderColor: color.paper,
  color: color.paper,
  boxShadow: `0 10px 15px -3px ${shadowTint}, 0 4px 6px -4px ${shadowTint}`,
} satisfies CSSProperties

/**
 * The page itself: the page ground the band's notch is cut from, in an ink
 * frame so it reads off the backdrop, scrolling as one sheet (band, body and
 * foot together) when it outgrows the viewport.
 */
const pageStyle = {
  backgroundColor: color.wkBg,
  borderColor: color.ink,
  borderStyle: 'solid',
  borderWidth: borderWidth.chrome,
  display: 'flex',
  flexDirection: 'column',
  // The popup's cap (`ModalShell`'s 100vh - 4rem) less its 12px gutters above
  // and below (`.su-entity-dialog`), which hold the close stamp's straddle.
  maxHeight: 'calc(100vh - 5.5rem)',
  overflowY: 'auto',
} satisfies CSSProperties

/**
 * The band a Page wears: the entity's own tone, as its card's head and Row
 * wear it (a gear's tech level, an ability's tier, the crawler pink's deeper
 * text band), and the ink band of a thing you do that has no tone (an
 * action). The SRD's route picks its chapter's band where the entity has no
 * tone of its own; a dialog has no chapter, so the tone is the band.
 */
function pageBand(entity: RefMetaEntity): { tone: ChapterTone; fill?: string } {
  const schemaName =
    'schemaName' in entity && typeof entity.schemaName === 'string' ? entity.schemaName : undefined
  if (!schemaName || schemaName === 'actions') return { tone: 'ink' }
  const tone = resolveCardTone(schemaName as Parameters<typeof resolveCardTone>[0], entity)
  const fill = textBand(tone.bgColor ?? tone.bg)
  return fill ? { tone: 'rules', fill } : { tone: 'rules' }
}

/**
 * The Page inside the dialog (EDL Form 5): the chapter band with the title
 * notched in and the chips clustered beside it (E20), the body, and the foot's
 * citation in the card footer's plain text ("Workshop Manual · p.128"). A
 * pattern's Page leads the cluster with its chassis (`PATTERN OF | Mule`), the
 * `EntityStat` chip the SRD's pattern page carries: the surface opens it (The Cantina's
 * Page opener, so in the dialog) and Peeks it. Its own component so a closed
 * dialog resolves none of it: a list renders a dialog per Row.
 *
 * The entity picker's middle column (`EntitySearcherFocus`) is this Page too,
 * outside a dialog: it names its own heading element (`titleAs`) and leaves the
 * Union bar its own colour (`matchBar`).
 */
export function EntityDetailPage({
  entity,
  pattern,
  title,
  titleAs = Dialog.Title,
  matchBar,
  titleSize,
  footOnBand = false,
  children,
}: Pick<EntityDetailDialogProps, 'entity' | 'pattern' | 'title' | 'children'> & {
  /** The title's element: the dialog's title by default. */
  titleAs?: ElementType
  /** Whether the band colours the Union bar (`ChapterBand`'s `matchBar`). */
  matchBar?: boolean
  /** The notched title's size, where the band is narrower than a page (`ChapterBand`'s). */
  titleSize?: string
  /** The foot in the band's colour, as a show page's foot is (the site `Footer`). */
  footOnBand?: boolean
}) {
  const meta = resolveEntityPageMeta(entity, pattern)
  const band = pageBand(entity)
  const bandColor = band.fill ?? CHAPTER_BAND_COLOR[band.tone]
  const provenance = resolveFooterProvenance(entity, pattern)
  // The Cantina's "View in SRD" link, carried in the Page's foot.
  const externalLink = useEntityExternalLink(entity as RefEntity)
  const parent = pattern ? toEntityModel(entity, undefined, { pattern }).parent : undefined
  return (
    <>
      <ChapterBand
        // The band's title names the dialog (`ModalShell`'s `ownTitle`).
        as={titleAs}
        matchBar={matchBar}
        titleSize={titleSize}
        tone={band.tone}
        fill={band.fill}
        aside={
          <EntityPageStamps
            meta={meta}
            name={title}
            legalStartingPattern={isLegalStartingPatternOf(pattern)}
            lead={parent && <EntityStat label={parent.label} entityRef={parent.ref} />}
          />
        }
        asideAt="notch"
        lead={
          // An ability's level, left of its title as its Row sets it: just the number.
          meta.numeral && (
            <>
              <span className="su-sr-only">Level </span>
              {meta.numeral}
            </>
          )
        }
      >
        {title}
        <KindLabel kind={meta.typeLabel} />
      </ChapterBand>
      <div className="su-entity-dialog__body">{children}</div>
      <EntityCardIdentityFooter
        typeLabel={meta.typeLabel}
        source={provenance.source}
        booklet={provenance.booklet}
        page={provenance.page}
        additionalSources={provenance.additionalSources}
        externalLink={externalLink}
        size="large"
        band={footOnBand ? { bandColor, onBand: foregroundOn(bandColor, 'ink') } : undefined}
      />
    </>
  )
}

/**
 * `EntityDetailDialog` — the Cantina's detail view, which is the Page (EDL Form 5,
 * E5): the backdrop, the kitty-cornered SRD black-stamp close button, and the
 * Page itself — the entity's band, `children` as its body (the card at
 * `presentation="page"`) and its foot citation. Both the entity path
 * (`useDetailModal`) and a depth-2 Row (`NestedCards`) open it, so every
 * detail view in the app is the same Page.
 */
export function EntityDetailDialog({
  open,
  onOpenChange,
  entity,
  pattern,
  title,
  children,
}: EntityDetailDialogProps) {
  return (
    // Bare: the Page owns its frame and its close stamp. `.su-entity-dialog`
    // caps it at 72rem and holds the 12px gutters the stamp straddles into.
    <ModalShell
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description="Entity display details"
      ownTitle
      maxWidth="su-entity-dialog"
      bare
    >
      {/* Overflow lives on the page so the close button (a sibling) isn't
          clipped by it. The SRD black-stamp square button is
          kitty-cornered, straddling the page's top-right corner. */}
      <div style={{ position: 'relative' }}>
        {/* The SRD black stamp: Button's ink variant at the icon rung, with
            a paper edge so it reads off the band it straddles. */}
        <Dialog.Close
          className={buttonVariants({ variant: 'ink', size: 'iconOnly' })}
          style={closeStyle}
        >
          <X style={{ width: space[20], height: space[20] }} aria-hidden="true" />
          <span className="su-sr-only">Close</span>
        </Dialog.Close>
        <article style={pageStyle}>
          <EntityDetailPage entity={entity} pattern={pattern} title={title}>
            {children}
          </EntityDetailPage>
        </article>
      </div>
    </ModalShell>
  )
}
