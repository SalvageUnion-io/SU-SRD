/**
 * Prints every story id the catalog serves, in sidebar order, each with its
 * canvas-only address: `bun run stories:ids [filter]`. It reads the story
 * files' source rather than importing them, so it needs no server or browser;
 * the ids and order come from the same helpers `src/catalog.tsx` uses, and
 * the files from `STORY_GLOBS`, the list its `import.meta.glob` spells out.
 */
import { Glob } from 'bun'
import { join } from 'node:path'
import { routeHref, sortStories, storiesInSource } from './src/catalogRoute'
import { STORY_GLOBS } from './src/storyRoots'

const repo = join(import.meta.dir, '../..')
const filter = (process.argv[2] ?? '').toLowerCase()

const files = STORY_GLOBS.flatMap((pattern) => [...new Glob(pattern).scanSync(repo)])
const sources = await Promise.all(files.map((file) => Bun.file(join(repo, file)).text()))
const stories = sortStories(sources.flatMap(storiesInSource)).filter((s) => s.id.includes(filter))

for (const { id } of stories)
  process.stdout.write(`${id}\t/${routeHref({ id, mode: 'canvas', width: null })}\n`)
