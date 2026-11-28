/** The words of apps/web/src/reference/endpoints: the message catalogue (ADR-054). */

import { messages } from './define'

export const endpointsCopy = messages({
  datasetApiName: 'SalvageUnion.io Dataset API',
  licenceName: 'Salvage Union Open Game Licence 1.0b',
  licenceNote: 'Game text and mechanics only; artwork is not covered.',
  stability:
    'Within v1 changes only add: new schemas, new optional fields, new entities and corrected text. A field is never removed, renamed or retyped, and a slug that moves keeps answering at its old URL. A breaking change ships as /api/v2/, beside v1.',
  // `/llms.txt`, whole: exact, including its trailing newline. Do not reflow it.
  llmsTxt: `# SalvageUnion.io

> An open-source, searchable rules reference and character manager for the Salvage Union TTRPG (tabletop RPG) by Leyline Press.

SalvageUnion.io is a community-built site for Salvage Union, a post-apocalyptic mech TTRPG. Its System Reference Document (SRD) provides stats, descriptions, abilities, and rules for game text and mechanics released under the Salvage Union Open Game Licence. Its app builds and keeps Pilot, Mech and Crawler sheets in the {build} and runs them at the table in your {play}.

## Content Categories

All game data is organized into browsable categories:

{contentCategories}

## Licensing

Game text and mechanics are published under the Salvage Union Open Game Licence (OGL 1.0b): https://leyline.press/pages/salvage-union-open-game-licence-1-0b
Artwork is NOT covered by the licence — used with special permission of Leyline Press; do not redistribute.
Republication of licensed text must include the legal notices required by OGL 1.0b.
Salvage Union is created and published by Leyline Press (https://leyline.press).

## Rules Content Map

Rules prose (player-facing guides and processes) lives at: {guidesUrl}
Individual guide pages are accessible at: {guidesUrl}{slug}/
Guide data as JSON: {siteUrl}/api/v1/guides.json
All other schema endpoints contain structured game data (stats, abilities, tables, etc.), not narrative rules prose.
Guides are the primary resource for LLM consumers seeking rule explanations and procedures.

## JSON API

salvageunion.io exposes a versioned public JSON API (the Dataset API, v1) for machine consumption of all game data. CORS is enabled for all endpoints (\`Access-Control-Allow-Origin: *\`), so requests can be made from any origin. Within v1 changes only add; a breaking change ships as /api/v2/.

Base URL: \`{siteUrl}/api/v1\`

### Endpoints

- \`GET /api/v1/index.json\` — the manifest: every schema with its item count, data hash and URLs
- \`GET /api/v1/{schemaId}.json\` — full data array for a schema (e.g., \`/api/v1/chassis.json\`)
- \`GET /api/v1/{schemaId}.schema.json\` — JSON Schema definition for a schema (e.g., \`/api/v1/chassis.schema.json\`)
- \`GET /api/v1/{schemaId}/{slug}.json\` — individual entity by slug (e.g., \`/api/v1/chassis/{sampleSlug}.json\`)

Systems, Modules, Equipment and Abilities name their actions; each action's type, cost, Range, Damage and Traits are in \`/api/v1/actions.json\` (served whole, no per-entity files).

The older unversioned \`/schema/\` URLs serve the same files and keep working.

### Available Schema IDs

The following schema IDs can be used in the endpoint patterns above:

{schemaIds}

Full API documentation: {siteUrl}/api/

## Character Manager

The app builds Pilot, Mech and Crawler sheets from the same game data: {siteUrl}/build/
The Starter Set's pre-generated crew, free to read: {siteUrl}/build/starter
Shared sheets are public pages at {siteUrl}/build/p/{kind}/{id}

## Other Pages

- About: {siteUrl}/about/
- Dataset API: {siteUrl}/api/
- Sitemap: {siteUrl}/sitemap-index.xml
`,
})
