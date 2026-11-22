/**
 * What each entity-row confirm says, for every surface that offers the action.
 *
 * Pure strings, no React: a confirm's words are the whole of what it does for
 * the reader, so they live in one place rather than in the JSX of whichever
 * surface happened to grow the button first. The Game roster uses all of them
 * today; the Roster and the live sheet's container move use theirs, and a
 * surface that later lists the same rows reuses them rather than rewording.
 *
 * Every body says two things, in this order: **what will happen**, and
 * **whether it can be undone** (and how, when it can). A confirm that only asks
 * "are you sure?" makes the reader work out the consequence themselves, which
 * is the one job the dialog exists to do for them.
 *
 * The personal container is called **"your Training Bay"** (`PRODUCT.build`)
 * in anything a player reads.
 *
 * The tone is part of the copy because it is part of the message: `danger` for
 * anything that takes a build — or its assignments — away from you or from the
 * table, `default` for the two that only add — picking up and copying.
 */

import type { EntityKind } from 'game-domain/entityKinds'
import { PRODUCT } from 'game-domain/product'
import { libGamesCopy } from '../../messages/lib-games'
import { copyName } from '../copyEntity'
import type { ClearedAssignment } from '../links/clearedByMove'
import { homeName } from './gameRoster'

/** Which kind of build a confirm is about. Decides the pronoun, nothing else. */
export type RowActionKind = EntityKind

export type ConfirmCopy = {
  /** The question, naming the build: "Delete Tenacity?". */
  title: string
  /** One paragraph each: what happens, then whether and how it can be undone. */
  body: readonly string[]
  confirmLabel: string
  pendingLabel: string
  tone: 'danger' | 'default'
  /**
   * The line shown when the action fails with no message the server chose for
   * the player (a refusal brings its own wording; anything else gets this).
   */
  failure: string
}

/** The line saying a deleted pilot's mech stays, when they fly one. */
const mechKept = (mech: string | undefined): string[] =>
  mech ? [libGamesCopy('mechIsKept', { mech })] : []

/** A pilot or an NPC is a person; a mech or a crawler is a thing. */
function them(kind: RowActionKind): string {
  return kind === 'pilot' || kind === 'npc' ? 'them' : 'it'
}

/** Where a container move is headed, by the name the reader knows it by. */
export type MoveDestination = { kind: 'shelf' } | { kind: 'game'; name: string | null }

/** A Game the reader cannot name (still loading, or one they have left). */
const UNNAMED_GAME = libGamesCopy('thisGame')

/**
 * What a move out of a Game undoes (ADR-037: a move prunes every link it would
 * leave straddling two containers). A pilot or mech loses its crawler and its
 * pairing; a crawler loses the crew assigned to it.
 */
function clearedAssignments(kind: RowActionKind, from: string): string {
  if (kind === 'pilot') return libGamesCopy('clearedPilot', { from })
  if (kind === 'mech') return libGamesCopy('clearedMech', { from })
  if (kind === 'npc') return libGamesCopy('clearedNpc', { from })
  return libGamesCopy('clearedCrawler', { from })
}

/** "a, b and c". */
function listOf(names: readonly string[]): string {
  if (names.length <= 1) return names.join('')
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/** "One build", "3 builds". */
function builds(n: number): string {
  return n === 1 ? libGamesCopy('oneBuild') : `${n} builds`
}

/** Where the other end of a link cleared on the way into a Game still is. */
const STILL_IN_TRAINING_BAY = libGamesCopy('stillInBay', { bay: PRODUCT.build })

/**
 * What a move from your shelf into a Game clears, one line per assignment: a
 * pilot or mech's pairing first, then the crawler crew it leaves. A crawler's
 * crew is one line, naming everyone who leaves it.
 */
function clearedOnEntry(kind: RowActionKind, cleared: readonly ClearedAssignment[]): string[] {
  if (kind === 'crawler') {
    const named = cleared.flatMap((c) => (c.other.name === null ? [] : [c.other.name]))
    const unnamed = cleared.length - named.length
    const who = [
      ...(named.length > 0 ? [`${listOf(named)} ${STILL_IN_TRAINING_BAY}`] : []),
      ...(unnamed === 0 ? [] : [named.length > 0 ? `${unnamed} more` : builds(unnamed)]),
    ].join(' and ')
    return [libGamesCopy(cleared.length === 1 ? 'crewLeaves' : 'crewLeave', { who })]
  }
  const person = kind === 'pilot' || kind === 'npc'
  const pairings = cleared.filter((c) => c.type === 'mech-to-pilot')
  const crews = cleared.filter((c) => c.type !== 'mech-to-pilot')
  return [
    ...pairings.map((c) =>
      c.other.name === null
        ? libGamesCopy(person ? 'pairingUnnamedTheir' : 'pairingUnnamedIts', {
            kind: c.other.kind,
          })
        : libGamesCopy(person ? 'pairingNamedTheir' : 'pairingNamedIts', {
            name: c.other.name,
            still: STILL_IN_TRAINING_BAY,
          })
    ),
    ...crews.map((c) =>
      c.other.name === null
        ? libGamesCopy(person ? 'theyLeaveTheirCrew' : 'itLeavesItsCrew')
        : libGamesCopy(person ? 'theyLeaveNamedCrew' : 'itLeavesNamedCrew', {
            name: c.other.name,
          })
    ),
  ]
}

export const ROW_ACTION_COPY = {
  /**
   * Assigning an unassigned character to yourself. Constructive, so the
   * default tone — the dialog exists to say what happens next (you edit it,
   * and it lands in this browser), which the seal alone cannot.
   */
  assignSelf(name: string): ConfirmCopy {
    return {
      title: libGamesCopy('assignSelfTitle', { name }),
      body: [libGamesCopy('assignSelfBody', { name }), libGamesCopy('assignSelfUndo')],
      confirmLabel: libGamesCopy('assignToMe'),
      pendingLabel: libGamesCopy('assigning'),
      tone: 'default',
      failure: libGamesCopy('assignSelfFailed', { name }),
    }
  },

  /**
   * Unassigning: by its holder, or the table runner on their behalf. Reversible
   * — but only while nobody else takes it, so the undo is stated with its
   * condition.
   */
  unassign(name: string, kind: RowActionKind, mine: boolean): ConfirmCopy {
    return {
      title: libGamesCopy('unassignTitle', { name }),
      body: [
        mine
          ? libGamesCopy('unassignMine', { name, them: them(kind) })
          : libGamesCopy('unassignTheirs', { name, them: them(kind) }),
        mine
          ? libGamesCopy('unassignUndoMine', { them: them(kind) })
          : libGamesCopy('unassignUndoTheirs', { them: them(kind) }),
      ],
      confirmLabel: libGamesCopy('unassign'),
      pendingLabel: libGamesCopy('unassigning'),
      tone: 'danger',
      failure: libGamesCopy('unassignFailed', { name }),
    }
  },

  /**
   * "Make a copy" in the Training Bay: a second build of something already on
   * your shelf, in no Game. It names the copy and says
   * the two will not stay in step — for a reader who is already on the shelf.
   */
  copyOnShelf(name: string): ConfirmCopy {
    return {
      title: libGamesCopy('copyTitle', { name }),
      body: [
        libGamesCopy('copyBody', { copy: copyName(name), bay: PRODUCT.build, name }),
        libGamesCopy('copyUndo'),
      ],
      confirmLabel: libGamesCopy('makeACopy'),
      pendingLabel: 'Copying…',
      tone: 'default',
      failure: libGamesCopy('copyFailed', { name }),
    }
  },

  /**
   * Deleting a character from a Game. It names the alternative on purpose: at
   * a shared table, "I am done with this character" almost always means
   * somebody else could have them, and a player who deletes when they meant to
   * hand over cannot undo it.
   */
  deleteFromGame(name: string, mech?: string): ConfirmCopy {
    return {
      title: `Delete ${name}?`,
      body: [
        libGamesCopy('deleteFromGameBody', { name }),
        ...mechKept(mech),
        libGamesCopy('deleteFromGameInstead'),
      ],
      confirmLabel: 'Delete',
      pendingLabel: 'Deleting…',
      tone: 'danger',
      failure: libGamesCopy('deleteFailed', { name }),
    }
  },

  /**
   * Deleting a build from the Roster — wherever it lives. A pilot's `mech` is
   * named as kept: the delete takes the pilot alone.
   */
  deleteBuild(name: string, mech?: string): ConfirmCopy {
    return {
      title: `Delete ${name}?`,
      body: [libGamesCopy('deleteBuildBody', { name }), ...mechKept(mech)],
      confirmLabel: 'Delete',
      pendingLabel: 'Deleting…',
      tone: 'danger',
      failure: libGamesCopy('deleteFailed', { name }),
    }
  },

  /**
   * Deleting an NPC the Mediator designed (MD3-08): theirs alone, so nothing
   * of crews, browsers or handing back. `encounters` are the names of those
   * that field it, which it leaves on confirm.
   */
  deleteNpc(name: string, encounters: readonly string[]): ConfirmCopy {
    return {
      title: `Delete ${name}?`,
      body: [
        libGamesCopy('deleteNpcBody', { name }),
        ...(encounters.length === 0
          ? []
          : [
              libGamesCopy(encounters.length === 1 ? 'deleteNpcFromOne' : 'deleteNpcFromMany', {
                name,
                encounters: listOf(encounters),
              }),
            ]),
      ],
      confirmLabel: 'Delete',
      pendingLabel: 'Deleting…',
      tone: 'danger',
      failure: libGamesCopy('deleteFailed', { name }),
    }
  },

  /**
   * Removing the rows an earlier Game delete left in the Kit (MD3-03): fielded
   * copies, named, so the Mediator sees what goes before anything does.
   */
  removeLeftovers(names: readonly string[]): ConfirmCopy {
    return {
      title:
        names.length === 1
          ? libGamesCopy('removeLeftoversOne', { names: listOf(names) })
          : libGamesCopy('removeLeftoversMany', { count: names.length }),
      body: [libGamesCopy('removeLeftoversBody', { names: listOf(names) })],
      confirmLabel: 'Remove',
      pendingLabel: 'Removing…',
      tone: 'danger',
      failure: libGamesCopy('removeLeftoversFailed'),
    }
  },

  /** Deleting the crew's crawler — the table runner's act, so it says it is for everyone. */
  scrap(name: string): ConfirmCopy {
    return {
      title: `Delete ${name}?`,
      body: [libGamesCopy('scrapBody', { name })],
      confirmLabel: 'Delete',
      pendingLabel: 'Deleting…',
      tone: 'danger',
      failure: libGamesCopy('deleteFailed', { name }),
    }
  },

  /**
   * Moving a build OUT of a Game — back to your shelf, or on to another Game.
   *
   * This direction always asks: moving a build out takes it off a shared
   * roster that the rest of the table was reading. (Moving one in takes nothing
   * from the table, so it asks only when it clears an assignment —
   * {@link ROW_ACTION_COPY.enterGame}.) It is the same record either way (a
   * move keeps its id), so it can always be moved back.
   *
   * It names the wiring it undoes. A move prunes every assignment that would
   * straddle two containers (ADR-037), so whatever the build was assigned to
   * in the Game it leaves — its crawler, and the pilot or mech it was paired
   * with — is cleared, and a crawler leaves its whole crew unassigned. The
   * copy says so before the player commits, not after.
   */
  leaveGame(args: {
    name: string
    kind: RowActionKind
    /** The Game it is leaving, by name; `null` when the reader cannot name it. */
    from: string | null
    to: MoveDestination
  }): ConfirmCopy {
    const from = args.from ?? UNNAMED_GAME
    const it = them(args.kind)
    const failure = libGamesCopy('moveFailed', { name: args.name })

    if (args.to.kind === 'shelf') {
      return {
        title: libGamesCopy('moveOutTitle', { name: args.name, from }),
        body: [
          libGamesCopy('moveOutBody', { name: args.name, bay: homeName(args.kind), it }),
          clearedAssignments(args.kind, from),
          libGamesCopy('moveBackIntoGame', { it }),
        ],
        confirmLabel: libGamesCopy('moveToYourBay', { bay: homeName(args.kind) }),
        pendingLabel: 'Moving…',
        tone: 'danger',
        failure,
      }
    }

    const to = args.to.name ?? libGamesCopy('anotherGame')
    return {
      title: `Move ${args.name} to ${to}?`,
      body: [
        libGamesCopy('moveOnBody', { name: args.name, from, to, it }),
        clearedAssignments(args.kind, from),
        libGamesCopy('moveBackLater', { it }),
      ],
      confirmLabel: 'Move',
      pendingLabel: 'Moving…',
      tone: 'danger',
      failure,
    }
  },

  /**
   * Moving a build from your shelf INTO a Game, when the move clears something.
   *
   * Joining a Game takes nothing from the table, so a move in with nothing to
   * clear runs straight away and never reaches this. But a move prunes every
   * assignment that would straddle two containers (ADR-037), so a build going
   * in loses whatever it was paired with that stays on your shelf. The callers
   * ask only when `assignmentsClearedByMove` is non-empty, and this names each
   * one: the pilot or mech it was paired with, the crawler whose crew it
   * leaves — or, for a crawler, the crew that leaves it. `danger`, like
   * `leaveGame`: it is the same loss, in the other direction.
   */
  enterGame(args: {
    name: string
    kind: RowActionKind
    /** The Game it is joining, by name; `null` when the reader cannot name it. */
    game: string | null
    /** What the move clears — never empty, or there is nothing to ask. */
    cleared: readonly ClearedAssignment[]
  }): ConfirmCopy {
    const game = args.game ?? UNNAMED_GAME
    return {
      title: `Move ${args.name} into ${game}?`,
      body: [
        `${args.name} joins ${game}'s roster.`,
        ...clearedOnEntry(args.kind, args.cleared),
        libGamesCopy(args.cleared.length === 1 ? 'enterUndoOne' : 'enterUndoMany', {
          them: them(args.kind),
          bay: PRODUCT.build,
        }),
      ],
      confirmLabel: 'Move',
      pendingLabel: 'Moving…',
      tone: 'danger',
      failure: libGamesCopy('moveFailed', { name: args.name }),
    }
  },
}
