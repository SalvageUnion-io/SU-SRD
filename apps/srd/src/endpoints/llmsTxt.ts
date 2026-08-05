/**
 * `/llms.txt` — port of `src/pages/llms.txt.ts`.
 *
 * The parity gate compares this file BYTE for byte against the Astro baseline,
 * so the template literal below is a verbatim copy of the original — including
 * its trailing newline. Do not reflow it.
 */

import type { EndpointModule } from '../../ssg/types'
import { SITE_URL } from '../lib/constants'
import { schemaHref } from '../lib/entityHref'
import { getEntitySchemas } from '../lib/gameData'

function body(): string {
  const entitySchemas = getEntitySchemas()

  const contentCategories = entitySchemas
    .map((s) => `- ${s.displayNamePlural} (${s.description}): ${SITE_URL}${schemaHref(s.id)}`)
    .join('\n')

  const schemaIds = entitySchemas.map((s) => `- \`${s.id}\` — ${s.description}`).join('\n')

  return `# Salvage Union System Reference Document (SRD)

> An open-source, searchable reference for the Salvage Union tabletop RPG by Leyline Press.

salvageunion.io is a community-built System Reference Document (SRD) for Salvage Union, a post-apocalyptic mech TTRPG. It provides stats, descriptions, abilities, and rules for game text and mechanics released under the Salvage Union Open Game Licence.

## Content Categories

All game data is organized into browsable categories:

${contentCategories}

## Licensing

Game text and mechanics are published under the Salvage Union Open Game Licence (OGL 1.0b): https://leyline.press/pages/salvage-union-open-game-licence-1-0b
Artwork is NOT covered by the licence — used with special permission of Leyline Press; do not redistribute.
Republication of licensed text must include the legal notices required by OGL 1.0b.
Salvage Union is created and published by Leyline Press (https://leyline.press).

## Rules Content Map

Rules prose (player-facing guides and processes) lives at: ${SITE_URL}${schemaHref('guides')}
Individual guide pages are accessible at: ${SITE_URL}/schema/guides/item/{slug}/
Guide data as JSON: ${SITE_URL}/schema/guides.json
All other schema endpoints contain structured game DATA (stats, abilities, tables, etc.), not narrative rules prose.
Guides are the primary resource for LLM consumers seeking rule explanations and procedures.

## JSON API

salvageunion.io exposes a public JSON API for machine consumption of all game data. CORS is enabled for all endpoints (\`Access-Control-Allow-Origin: *\`), so requests can be made from any origin.

Base URL: \`${SITE_URL}\`

### Endpoints

- \`GET /schema/{schemaId}.json\` — full data array for a schema (e.g., \`/schema/chassis.json\`)
- \`GET /schema/{schemaId}.schema.json\` — JSON Schema definition for a schema (e.g., \`/schema/chassis.schema.json\`)
- \`GET /schema/{schemaId}/item/{itemId}.json\` — individual entity by slug (e.g., \`/schema/chassis/item/iron-mongrel.json\`)

### Available Schema IDs

The following schema IDs can be used in the endpoint patterns above:

${schemaIds}

Full API documentation: ${SITE_URL}/api/

## Other Pages

- About: ${SITE_URL}/about/
- API Reference: ${SITE_URL}/api/
- Sitemap: ${SITE_URL}/sitemap-index.xml
`
}

export const llmsTxtEndpoint: EndpointModule = {
  pattern: 'llms.txt',
  contentType: 'text/plain; charset=utf-8',
  body,
}
