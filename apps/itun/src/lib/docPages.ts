import { SRD_SITE_URL } from 'salvageunion-reference'

/**
 * The doc pages both tools share. They live on the SRD only; ITUN links to
 * them there and keeps no copy, so its footer, drawer and account menu all
 * point at these.
 */
export const DOC_PAGES = {
  changelog: { label: 'Changelog', href: `${SRD_SITE_URL}/changelog/` },
  api: { label: 'API', href: `${SRD_SITE_URL}/api/` },
  discord: { label: 'Discord', href: `${SRD_SITE_URL}/discord/` },
  about: { label: 'About', href: `${SRD_SITE_URL}/about/` },
} as const

/**
 * Where ITUN's own `/about` and `/changelog` went: the SRD's page, which the
 * Worker 301s to (`worker/index.ts`), so a bookmark or an old link still
 * lands. Takes a path inside the base, with or without its trailing slash;
 * null for any other path.
 */
export function retiredDocPage(path: string): string | null {
  const name = path.replace(/^\/+|\/+$/g, '')
  return name === 'about' || name === 'changelog' ? DOC_PAGES[name].href : null
}
