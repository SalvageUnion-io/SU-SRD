import { createFileRoute } from '@tanstack/react-router'
import { PRODUCT } from 'game-domain/product'
import { HomebrewLibrary } from '../../build/library/HomebrewLibrary'
import { areaTitle } from '../../lib/pageTitle'

/**
 * `/library` — the Homebrew library (ADR-053): the patterns and built NPCs
 * players listed, readable with no account. The page is `HomebrewLibrary`;
 * this file exports only `Route` (`routes/__tests__/routeExports.test.ts`).
 */
export const Route = createFileRoute('/library/')({
  head: () => ({ meta: [{ title: areaTitle(PRODUCT.build, 'Homebrew Library') }] }),
  component: HomebrewLibrary,
})
