import type { EntitySurfaceValue } from 'component-lib'
import { EntitySurfaceProvider, Mention } from 'component-lib'
import { srdHrefFor } from '../lib/entityHref'
import type { RefText } from '../lib/rollTablePage'

/** The SRD's routes, the one thing a build-time Mention needs from the surface. */
const SRD_SURFACE: Partial<EntitySurfaceValue> = { hrefFor: srdHrefFor }

/**
 * Prose whose references were resolved at build time (`refText`), each drawn
 * as a `Mention`: a link to its page with its Peek, or inert where it names
 * nothing. The same Mention every card's prose draws, so a roll table's bands
 * and the static fallback read as the card does, while the island that mounts
 * them carries only the refs, never the glossary.
 */
export function MentionProse({ parts }: { parts: RefText }) {
  return (
    <EntitySurfaceProvider value={SRD_SURFACE}>
      {parts.map((part, index) =>
        typeof part === 'string' ? (
          part
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: a fixed run of prose; position is identity
          <Mention key={index} entityRef={part.ref ?? undefined}>
            {part.text}
          </Mention>
        )
      )}
    </EntitySurfaceProvider>
  )
}
