import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { renderCommandListModule } from './commandList'

/**
 * Write the `/su` command list into the srd (`bun run gen:command-list`). A
 * local CLI like `deploy-commands.ts`, never imported by the Worker.
 */

const OUTPUT = join(import.meta.dir, '../../web/src/generated/discordCommands.ts')

await writeFile(OUTPUT, renderCommandListModule(), 'utf-8')
console.log(`[command-list] wrote ${OUTPUT}`)
