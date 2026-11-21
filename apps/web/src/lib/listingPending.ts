/**
 * A listing opened on a filtered, sorted or re-viewed address holds its
 * served rows out of sight from BEFORE the first paint: the server draws the
 * whole list in its default view, and what this visit should show is only
 * known in the browser.
 *
 * The island's directive already marks such a listing until its first commit
 * (`data-island-pending`, `directives/interaction.ts`), but it runs after the
 * page has painted once, so the whole list flashed first. This is the same
 * mark set by an inline script the page writes ahead of the listing, which
 * the parser runs before anything under it is drawn. It reads what
 * `mountsNow` reads (`runtime/mountNow.ts`): a listing key in the query, or
 * the reader's stored view. Lifted on the island's first commit, or after
 * `LIMIT_MS` if it never comes, so the list is never lost.
 *
 * No imports but the listing's keys: the script is text in every listing page.
 */

import { ISLAND_COMMIT } from '../runtime/islandCommit'
import { LISTING_PARAMS, listingViewStorageKey } from './listingParams'

/** Set on `<html>` while the served rows are not what this visit shows (`pages.css`). */
export const LISTING_PENDING_ATTRIBUTE = 'data-listing-pending'

/** The longest the served rows stay out of sight. */
const LIMIT_MS = 4000

/**
 * The inline script, as text. One text for every listing (the page's schema
 * is its address's first segment, `/chassis/`), so the site's CSP names one
 * hash for it (`astro/build/inlineScripts.ts`), not one per listing.
 */
export function listingPendingScript(): string {
  const keys = JSON.stringify(LISTING_PARAMS)
  const stored = `${JSON.stringify(listingViewStorageKey(''))}+location.pathname.split("/")[1]`
  const attribute = JSON.stringify(LISTING_PENDING_ATTRIBUTE)
  const commit = JSON.stringify(ISLAND_COMMIT)
  return [
    '(function(){',
    'var d=document.documentElement,q=new URLSearchParams(location.search),v=null;',
    `try{v=localStorage.getItem(${stored})}catch(e){}`,
    `if(!${keys}.some(function(k){return q.has(k)})&&v===null)return;`,
    `d.setAttribute(${attribute},"");`,
    `var lift=function(){d.removeAttribute(${attribute})};`,
    `document.addEventListener(${commit},lift,{once:true});`,
    `setTimeout(lift,${LIMIT_MS})`,
    '})()',
  ].join('')
}
