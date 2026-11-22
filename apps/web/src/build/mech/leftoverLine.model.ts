import { mechCopy } from '../../messages/build-mech'

/**
 * Where the unspent Scrap goes, in one line (r3 F1): into the hold, to the
 * Union Crawler, or split between them where the hold fills first.
 */
export function leftoverLine({ stowed, banked }: { stowed: number; banked: number }): string {
  if (banked === 0) return mechCopy('scrapLeftOverGoesIntoHold', { count: stowed })
  if (stowed === 0) return mechCopy('scrapLeftOverForCrawler', { count: banked })
  return mechCopy('scrapLeftOverSplit', { count: stowed + banked, stowed, banked })
}
