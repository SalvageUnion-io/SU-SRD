import { Check, Share2 } from 'lucide-react'
import { Button, tokens } from '../components/index'
import { SHARE_PAGE_ATTRIBUTE } from '../lib/sharePage'
import { referenceCopy } from '../messages/reference'

/**
 * A reference page's SHARE, on its band before Build With This (EDL E20).
 * Static markup: the client entry makes it live (`watchSharePage`), so it
 * costs the page no React. It carries both icons, the share glyph at rest
 * and the Check a copy swaps in (`data-copied`), and its polite status right
 * after it. On a phone's band it is its glyph alone; its name stays its
 * `aria-label`.
 */
export function SharePageButton() {
  return (
    <>
      <Button
        size="compact"
        aria-label={referenceCopy('shareThisPage')}
        className="su-page-action su-share-page su-hit-area"
        {...{ [SHARE_PAGE_ATTRIBUTE]: '' }}
      >
        <Share2 aria-hidden="true" size={tokens.iconSize.compact} className="su-share-page__rest" />
        <Check aria-hidden="true" size={tokens.iconSize.compact} className="su-share-page__done" />
        <span className="su-share-page__label">{referenceCopy('share')}</span>
      </Button>
      <span role="status" className="su-sr-only" />
    </>
  )
}
