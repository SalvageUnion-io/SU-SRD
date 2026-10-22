import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { SalvageUnionReference } from 'salvageunion-reference'
import { renderSampleRepliesModule } from './sampleReplies'

/**
 * Write the sample replies into apps/web (`bun --filter discord-bot gen:sample-replies`). A
 * local CLI like `gen-command-list.ts`, never imported by the Worker.
 */

const OUTPUT = join(import.meta.dir, '../../web/src/generated/discordSamples.ts')

await SalvageUnionReference.preload('all')
await writeFile(OUTPUT, renderSampleRepliesModule(), 'utf-8')
console.log(`[sample-replies] wrote ${OUTPUT}`)
