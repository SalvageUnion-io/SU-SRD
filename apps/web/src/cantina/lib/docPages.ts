import { srdOrigin } from './srdOrigin'

/**
 * The doc pages both tools share. They live on the SRD only; the Cantina links to
 * them there and keeps no copy, so its footer, drawer and account menu all
 * point at these.
 */
export const DOC_PAGES = {
  get changelog() {
    return { label: 'Changelog', href: `${srdOrigin()}/changelog/` }
  },
  get api() {
    return { label: 'API', href: `${srdOrigin()}/api/` }
  },
  get discord() {
    return { label: 'Discord', href: `${srdOrigin()}/discord/` }
  },
  get about() {
    return { label: 'About', href: `${srdOrigin()}/about/` }
  },
}

/**
 * Where the Cantina's own `/about` and `/changelog` went: the SRD's page, which the
 * Worker 301s to (`worker/index.ts`), so a bookmark or an old link still
 * lands. Takes a path inside the base, with or without its trailing slash;
 * null for any other path. Root-relative: the SRD is the same origin.
 */
export function retiredDocPage(path: string): string | null {
  const name = path.replace(/^\/+|\/+$/g, '')
  return name === 'about' || name === 'changelog' ? `/${name}/` : null
}
