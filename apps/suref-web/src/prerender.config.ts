import { getSchemaCatalog, SalvageUnionReference } from 'salvageunion-reference'
import type { SURefEnumSchemaName } from 'salvageunion-reference'
import { getEntitySlug } from './utils/slug'
import { logger } from './lib/logger'

/**
 * Generate all static paths for prerendering
 * This includes all schema index pages and item detail pages
 */
export function getStaticPaths() {
  const catalog = getSchemaCatalog()
  const paths: string[] = []

  paths.push('/')

  paths.push('/404')

  for (const schema of catalog.schemas) {
    paths.push(`/schema/${schema.id}`)

    try {
      const items = SalvageUnionReference.findAllIn(schema.id as SURefEnumSchemaName, () => true)
      for (const item of items) {
        if ('id' in item && item.id) {
          // Use slug for URLs instead of ID
          const itemSlug = getEntitySlug(item)
          paths.push(`/schema/${schema.id}/item/${itemSlug}`)
        }
      }
    } catch (error) {
      logger.warn(`Could not load items for schema ${schema.id}:`, error)
    }
  }

  return paths
}

/**
 * Get the site URL from environment variable or use default
 * Defaults to production URL (salvageunion.io)
 * For Netlify previews, can be set to suindex.netlify.app or auto-detected
 */
function getSiteUrl(): string {
  // Check for VITE_SITE_URL environment variable
  const envUrl = import.meta.env.VITE_SITE_URL
  if (envUrl) {
    return envUrl
  }

  // Check for Netlify environment variables
  const netlifyUrl = import.meta.env.NETLIFY_URL
  if (netlifyUrl) {
    return `https://${netlifyUrl}`
  }

  // Default to production URL
  return 'https://salvageunion.io'
}

const siteUrl = getSiteUrl()

/**
 * Prerender configuration for TanStack Start
 */
export const prerenderConfig = {
  routes: getStaticPaths(),

  sitemap: {
    hostname: siteUrl,
    getEntry: (route: string) => {
      if (route === '/') {
        return { priority: 1.0, changefreq: 'weekly' as const }
      }

      if (route.match(/^\/schema\/[^/]+\/?$/)) {
        return { priority: 0.8, changefreq: 'monthly' as const }
      }

      if (route.match(/^\/schema\/[^/]+\/item\//)) {
        return { priority: 0.6, changefreq: 'yearly' as const }
      }

      return { priority: 0.5, changefreq: 'monthly' as const }
    },
  },

  robots: {
    allow: '/',
    disallow: ['/dashboard', '/api'],
    sitemap: `${siteUrl}/sitemap.xml`,
  },
}
