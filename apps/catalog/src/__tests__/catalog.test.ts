import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { STORY_GLOBS } from '../storyRoots'

const entry = readFileSync(join(import.meta.dir, '../catalog.tsx'), 'utf8')

describe('the catalog entry', () => {
  test('loads the condensed display face the OG card sets its titles in', () => {
    // As the SRD's styles entry does, so `OgCard`'s story draws in it.
    expect(entry).toContain('@fontsource/barlow-semi-condensed/700.css')
  })

  test('its literal glob is STORY_GLOBS, relative to src/', () => {
    // `import.meta.glob` cannot take a variable, so the list is spelled twice;
    // `bun run stories:ids` and `bun run shot` read STORY_GLOBS.
    for (const pattern of STORY_GLOBS) expect(entry).toContain(`'../../../${pattern}'`)
  })
})
