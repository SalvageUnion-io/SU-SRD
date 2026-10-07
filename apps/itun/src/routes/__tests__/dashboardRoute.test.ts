/**
 * `/dashboard/$pilotId` names itself in the browser tab.
 *
 * The title is static: loaders never read player entities
 * (`.claude/rules/tanstack-router.md`), so the route cannot know the pilot's
 * name when its `head` runs. `HeadContent` in `__root.tsx` renders it.
 */

import { describe, expect, test } from 'bun:test'
import { Route } from '../dashboard/$pilotId'

describe('the Dashboard route', () => {
  test('has a page title', async () => {
    const head = await Route.options.head?.({} as never)
    expect(head?.meta).toEqual([{ title: 'Dashboard — In The Union Now' }])
  })
})
