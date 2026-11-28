import { Check, Share2 } from 'lucide-react'
import { Button, tokens } from '../components/index'
import { SHARE_PAGE_ATTRIBUTE } from '../lib/sharePage'
import { referenceCopy } from '../messages/reference'

/**
 * A reference page's SHARE, on its band before Build With This (EDL E20),
 * outlined as any non-rust button on a band (§3.13).
 * Static markup: the client entry makes it live (`watchSharePage`), so it
 * costs the page no React. It carries both icons, the share glyph at rest
 * and the Check a copy swaps in (`data-copied`) with the word "Copied" beside
 * it, and its polite status right after it. On a phone's band it is its glyph alone; its name stays its
 * `aria-label`.
 */
export function SharePageButton() {
  return (
    <>
      <Button
        variant="default"
        size="compact"
        aria-label={referenceCopy('shareThisPage')}
        className="su-page-action su-share-page"
        {...{ [SHARE_PAGE_ATTRIBUTE]: '' }}
        data-share-failed={referenceCopy('shareFailed')}
        data-copy-failed={referenceCopy('copyLinkFailed')}
      >
        <Share2 aria-hidden="true" size={tokens.iconSize.compact} className="su-share-page__rest" />
        <Check aria-hidden="true" size={tokens.iconSize.compact} className="su-share-page__done" />
        <span className="su-share-page__label">{referenceCopy('share')}</span>
        {/* The word beside the Check while a copy has just landed, on a phone
            too, where the glyph stands alone (K5); the status says it aloud. */}
        <span aria-hidden="true" className="su-share-page__copied">
          {referenceCopy('copied')}
        </span>
      </Button>
      <span role="status" className="su-sr-only" />
    </>
  )
}
