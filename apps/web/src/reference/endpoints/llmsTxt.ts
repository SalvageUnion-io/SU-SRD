/**
 * `/llms.txt` — the site summary for LLM crawlers.
 *
 * Its words are the catalogue's `llmsTxt` (`messages/reference-endpoints.ts`): exact,
 * including the trailing newline, and shipped byte for byte. **Do not reflow it.**
 */

import { PRODUCT } from 'game-domain/product'
import { getEntitySlug } from 'salvageunion-reference'
import { apiSampleChassis } from '../../lib/apiSample'
import { SITE_URL } from '../../lib/constants'
import { schemaHref } from '../../lib/entityHref'
import { getEntitySchemas } from '../../lib/gameData'
import { endpointsCopy } from '../../messages/reference-endpoints'
import type { EndpointModule } from '../types'

function body(): string {
  const entitySchemas = getEntitySchemas()

  const contentCategories = entitySchemas
    .map((s) => `- ${s.displayNamePlural} (${s.description}): ${SITE_URL}${schemaHref(s.id)}`)
    .join('\n')

  const schemaIds = entitySchemas.map((s) => `- \`${s.id}\` — ${s.description}`).join('\n')

  const sampleSlug = getEntitySlug(apiSampleChassis())

  // `{schemaId}`, `{slug}`, `{kind}` and `{id}` are the document's own URL patterns: said as written.
  return endpointsCopy('llmsTxt', {
    build: PRODUCT.build,
    play: PRODUCT.play,
    contentCategories,
    guidesUrl: `${SITE_URL}${schemaHref('guides')}`,
    siteUrl: SITE_URL,
    sampleSlug,
    schemaIds,
    schemaId: '{schemaId}',
    slug: '{slug}',
    kind: '{kind}',
    id: '{id}',
  })
}

export const llmsTxtEndpoint: EndpointModule = {
  pattern: 'llms.txt',
  contentType: 'text/plain; charset=utf-8',
  body,
}
