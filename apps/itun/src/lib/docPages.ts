import { SRD_ORIGIN } from './srdOrigin'

/**
 * The doc pages both tools share. They live on the SRD only; ITUN links to
 * them there and keeps no copy, so its footer, drawer and account menu all
 * point at these.
 */
export const DOC_PAGES = {
  changelog: { label: 'Changelog', href: `${SRD_ORIGIN}/changelog/` },
  api: { label: 'API', href: `${SRD_ORIGIN}/api/` },
  discord: { label: 'Discord', href: `${SRD_ORIGIN}/discord/` },
  about: { label: 'About', href: `${SRD_ORIGIN}/about/` },
} as const

/**
 * Where ITUN's own `/about` and `/changelog` went: the SRD's page, which the
 * Worker 301s to (`worker/index.ts`), so a bookmark or an old link still
 * lands. Takes a path inside the base, with or without its trailing slash, and
 * the SRD to send it to (the Worker's `SRD_ORIGIN`, set on a Worker Preview);
 * null for any other path.
 */
export function retiredDocPage(path: string, srdOrigin: string = SRD_ORIGIN): string | null {
  const name = path.replace(/^\/+|\/+$/g, '')
  return name === 'about' || name === 'changelog'
    ? `${srdOrigin.replace(/\/+$/, '')}/${name}/`
    : null
}
