import { srdHrefFor } from '../lib/entityHref'
import type { RefText } from '../lib/rollTablePage'
import type { EntitySurfaceValue } from './index'
import { EntitySurfaceProvider, Mention } from './index'

/** The SRD's routes, the one thing a build-time Mention needs from the surface. */
const SRD_SURFACE: Partial<EntitySurfaceValue> = { hrefFor: srdHrefFor }

/**
 * Prose whose references were resolved at build time (`refText`), each drawn
 * as a `Mention`: a link to its page with its Peek, or inert where it names
 * nothing. The same Mention every card's prose draws, so a roll table's bands
 * and the server-rendered stand-ins read as the card does, while the island that mounts
 * them carries only the refs, never the glossary.
 */
export function MentionProse({ parts }: { parts: RefText }) {
  // One run is one paragraph: a term's first link is the keyboard's stop, a
  // later one still a link (`Mention`'s `repeat`).
  const stops = new Set<string>()
  return (
    <EntitySurfaceProvider value={SRD_SURFACE}>
      {parts.map((part, index) => {
        if (typeof part === 'string') return part
        const term = part.ref ? `${part.ref.schemaName}:${part.ref.id}` : ''
        const repeat = term !== '' && stops.has(term)
        stops.add(term)
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: a fixed run of prose; position is identity
          <Mention key={index} entityRef={part.ref ?? undefined} repeat={repeat}>
            {part.text}
          </Mention>
        )
      })}
    </EntitySurfaceProvider>
  )
}
