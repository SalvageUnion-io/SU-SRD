#!/usr/bin/env bun
/**
 * page-anchors — every in-page link on the built reference pages lands on an
 * element (`apps/web/astro/build/deadAnchors.ts`).
 *
 *   bun tools/check-page-anchors.ts [<dist dir>]
 *
 * Reads the pages a build wrote (`apps/web/dist/client`), so it judges what a
 * reader is served. The build runs the same scan and refuses to finish on a
 * finding, which is what holds a PR (CI builds every one); this gate is the
 * same check over a build already on disk. With no build it says so and
 * passes: `bun run build` first.
 */

import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { deadAnchorReport, findDeadAnchors } from '../apps/web/astro/build/deadAnchors'

const REPO = resolve(import.meta.dir, '..')

/** Where `bun run build` writes the site's pages. */
const DIST = join(REPO, 'apps', 'web', 'dist', 'client')

export async function main(dist: string = process.argv[2] ?? DIST): Promise<number> {
  if (!existsSync(join(dist, 'index.html'))) {
    console.log(`page-anchors: no built site at ${dist}; \`bun run build\` first. Nothing checked.`)
    return 0
  }
  const dead = await findDeadAnchors(dist)
  if (dead.length === 0) {
    console.log('✓ page-anchors: every in-page link on the built pages has its target')
    return 0
  }
  console.error(`✗ page-anchors: ${deadAnchorReport(dead)}`)
  return 1
}

if (import.meta.main) process.exit(await main())
