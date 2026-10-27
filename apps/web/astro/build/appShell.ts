/**
 * appShell — the app's shell as the build's page writes it
 * (`astro/pages/build/index.astro`): the base stylesheet and the site's
 * manifest after the title, and the link-preview tags named for the
 * deployment's origin, so a Worker Preview's pasted link unfurls with its own
 * address (`VITE_SITE_ORIGIN`, `deploy-preview.yml`). The Worker's per-route
 * tags already use the request's origin (`linkPreview.ts`).
 */

import { appPath } from '../../src/lib/appBase'
import { originOf } from '../../src/lib/site'
import { SITE_MANIFEST } from '../../src/pwa'
import { shellParts } from '../../src/shell/shell'
import { BASE_STYLESHEET } from '../lib/assets'

export function appShell(siteOrigin: string | undefined): { head: string; body: string } {
  const { head, body } = shellParts()
  const links = `<link rel="stylesheet" href="${BASE_STYLESHEET.href}"><link rel="manifest" href="${SITE_MANIFEST}">`
  const named = head.replaceAll(
    `${originOf()}${appPath('/')}`,
    `${originOf(siteOrigin)}${appPath('/')}`
  )
  return { head: named.replace('</title>', `</title>${links}`), body }
}
