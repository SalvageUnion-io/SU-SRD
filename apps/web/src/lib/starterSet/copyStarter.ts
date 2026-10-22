/**
 * The Starter Set as reference data: read by anyone, owned by Leyline Press,
 * written by nobody.
 *
 * The templates in `./starterSet` are never stored, never adopted and never
 * edited. They are read through a read-only sheet store (the `/starter` pages),
 * and the only way to play one is to **copy** it into a container the player
 * picks — Shelves or one of their Games. The copy is an ordinary build the
 * player owns, made through `entityStore.create`, so it is refused signed out
 * and committed to the server of record before anything local is written.
 *
 * This replaces "Load Starter Set", which seeded the whole crew onto the
 * player's Shelf. That made the reference data look like the player's own
 * builds, and every row of it editable and deletable.
 *
 * ## A copy is a new thing
 *
 * `create` mints a fresh id: a template's id in an account would put one id in
 * every account that copied it, and a duplicate `appId` resolves to the oldest
 * row, so a second player's writes would aim at the first player's entity. The
 * template slug is kept as `seedRef`, which is what it is for. The name is kept
 * as it is — a copied pre-gen is the character you are going to play, not a
 * "COPY OF" anything.
 */

import type { Container } from 'game-domain/container'
import { moveTo } from 'game-domain/container'
import type { SheetKind } from 'game-domain/entityKinds'
import { STARTER_SOFT_LINKS } from 'game-domain/starterSet/starterSet'
import { useEntityStore } from '../../stores/entityStore'
import { starterTemplate, starterTemplates } from './starterTemplates'

/**
 * Copy one template into `to`, as a build the player owns. Resolves to what was
 * stored; rejects when the store refuses (signed out, offline) or the server
 * does.
 */
export async function copyStarter(
  kind: SheetKind,
  templateId: string,
  to: Container
): Promise<{ id: string; name: string }> {
  const template = starterTemplate(kind, templateId)
  if (template === null) throw new Error(`There is no Starter Set ${kind} "${templateId}".`)

  // A deep copy, so nothing the new build does can reach back into the
  // template it came from.
  const {
    id: _id,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    ...body
  } = structuredClone(template) as Record<string, unknown> & { id: string }

  return await useEntityStore
    .getState()
    .create(kind, { ...body, seedRef: templateId, ...moveTo(to) } as never)
}

/** What a whole-crew copy made: how many builds, and how many links between them. */
export type CrewCopy = { builds: number; links: number }

/**
 * Copy the whole crew into `to` in one go: every Starter Set build, then the
 * links the box draws between them (each pilot flies their mech, and pilots
 * and mechs crew the Tenacity), redrawn between the copies.
 *
 * The crawler goes first, so a destination that refuses it (a Game the player
 * does not run) refuses before anything else is made. Links go last, through
 * the assignment model like any other link: both ends are in `to`, so none
 * straddles two containers.
 *
 * All or nothing: when any create is refused part way, the copies already made
 * are deleted again (which takes their links with them) before the refusal is
 * passed on, so a retry starts from an empty slate rather than doubling the
 * crew.
 */
export async function copyStarterCrew(to: Container): Promise<CrewCopy> {
  const copies = new Map<string, { kind: SheetKind; id: string }>()
  const store = useEntityStore.getState()
  try {
    for (const kind of CREW_ORDER) {
      for (const template of starterTemplates(kind)) {
        const copy = await copyStarter(kind, template.id, to)
        copies.set(template.id, { kind, id: copy.id })
      }
    }

    let links = 0
    for (const link of STARTER_SOFT_LINKS) {
      const from = copies.get(link.from.id)
      const toCopy = copies.get(link.to.id)
      if (from === undefined || toCopy === undefined) continue
      await store.create('softLink', {
        from: { type: link.from.type, id: from.id },
        to: { type: link.to.type, id: toCopy.id },
        type: link.type,
      })
      links += 1
    }
    return { builds: copies.size, links }
  } catch (error) {
    await undoCopies([...copies.values()])
    throw error
  }
}

/** Delete what a refused crew copy made, newest first; a delete that fails too is left for the player. */
async function undoCopies(made: { kind: SheetKind; id: string }[]): Promise<void> {
  const store = useEntityStore.getState()
  for (const { kind, id } of made.reverse()) {
    await store.delete(kind, id).catch(() => undefined)
  }
}

/** The crawler first (the one a destination may refuse), then the pilots, then their mechs. */
const CREW_ORDER: readonly SheetKind[] = ['crawler', 'pilot', 'mech']
