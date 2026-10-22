import { createFileRoute } from '@tanstack/react-router'
import { PRODUCT } from 'game-domain/product'
import { HomebrewModerationScreen } from '../../build/homebrew/HomebrewModerationScreen'
import { areaTitle } from '../../lib/pageTitle'
import { buildHomebrewCopy } from '../../messages/build-homebrew'

/** `/admin/homebrew` — a site admin's Homebrew queue (ADR-059). */
export const Route = createFileRoute('/admin/homebrew')({
  head: () => ({
    meta: [{ title: areaTitle(PRODUCT.build, buildHomebrewCopy('moderationTitle')) }],
  }),
  component: HomebrewModerationScreen,
})
