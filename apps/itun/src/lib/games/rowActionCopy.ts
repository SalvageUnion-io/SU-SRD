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
 * The personal shelf is called **"My Stuff"** in anything a player reads — that
 * is the player's name for it, here and everywhere else in the app.
 *
 * The tone is part of the copy because it is part of the message: `danger` for
 * anything that takes a build away from you or from the table, `default` for
 * the two that only add — picking up and copying.
 */

import { copyName } from '../copyEntity'

/** Which kind of build a confirm is about. Decides the pronoun, nothing else. */
export type RowActionKind = 'pilot' | 'mech' | 'crawler'

export type ConfirmCopy = {
  /** The question, naming the build: "Scrap #430 Tenacity?". */
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

/** A pilot is a person; a mech or a crawler is a thing. */
function them(kind: RowActionKind): string {
  return kind === 'pilot' ? 'them' : 'it'
}

/** Where a container move is headed, by the name the reader knows it by. */
export type MoveDestination = { kind: 'shelf' } | { kind: 'game'; name: string | null }

/** A Game the reader cannot name (still loading, or one they have left). */
const UNNAMED_GAME = 'this game'

/**
 * What a move out of a Game undoes (ADR-037: a move prunes every link it would
 * leave straddling two containers). A pilot or mech loses its crawler and its
 * pairing; a crawler loses the crew assigned to it.
 */
function clearedAssignments(kind: RowActionKind, from: string): string {
  if (kind === 'pilot') {
    return `Their crawler assignment in ${from} is cleared, and so is the mech they fly there, if any.`
  }
  if (kind === 'mech') {
    return `Its crawler assignment in ${from} is cleared, and so is the pilot flying it there, if any.`
  }
  return `Everyone in ${from} assigned to it is unassigned.`
}

export const ROW_ACTION_COPY = {
  /**
   * Taking an unclaimed character. Constructive, so the default tone — the
   * dialog exists to say what happens next (it becomes yours, and it lands in
   * this browser), which the seal alone cannot.
   */
  pickUp(name: string): ConfirmCopy {
    return {
      title: `Pick up ${name}?`,
      body: [
        `${name} is unclaimed — the Mediator left them for somebody to take. Picking them up makes you their owner: they become yours to edit, they open in this browser, and every change saves back to the game.`,
        'Changed your mind later? Hand them back with “Offer to the crew”.',
      ],
      confirmLabel: 'Pick up',
      pendingLabel: 'Picking up…',
      tone: 'default',
      failure: `${name} could not be picked up. Try again.`,
    }
  },

  /**
   * Releasing what you hold. Generous and reversible — but only while nobody
   * else takes it, so the undo is stated with its condition.
   */
  offer(name: string, kind: RowActionKind): ConfirmCopy {
    return {
      title: `Offer ${name} to the crew?`,
      body: [
        `You'll stop owning ${name}, and anyone in the game can pick ${them(kind)} up.`,
        `You can pick ${them(kind)} up again yourself, as long as nobody else has first.`,
      ],
      confirmLabel: 'Offer to the crew',
      pendingLabel: 'Offering…',
      tone: 'danger',
      failure: `${name} could not be offered to the crew. Try again.`,
    }
  },

  /**
   * A copy into My Stuff. Destroys nothing, but it does make something, and a
   * player who expected a move would otherwise find two of them — so it names
   * the copy it will make and says the two will not stay in step.
   */
  copy(name: string): ConfirmCopy {
    return {
      title: `Copy ${name} to My Stuff?`,
      body: [
        `This makes “${copyName(name)}” in My Stuff. The copy is separate: changes to it won't sync back, and ${name} is left as it is.`,
        "Don't want it later? Delete the copy from My Stuff.",
      ],
      confirmLabel: 'Make a copy',
      pendingLabel: 'Copying…',
      tone: 'default',
      failure: `${name} could not be copied. Try again.`,
    }
  },

  /**
   * Deleting a character from a Game. It names the alternative on purpose: at
   * a shared table, "I am done with this character" almost always means
   * somebody else could have them, and a player who deletes when they meant to
   * hand over cannot undo it.
   */
  deleteFromGame(name: string): ConfirmCopy {
    return {
      title: `Delete ${name}?`,
      body: [
        `This cannot be undone. ${name} will be removed from this game for everyone, and from this browser.`,
        'Only leaving the table? “Offer to the crew” hands them back instead — they stay in the game for somebody else to pick up.',
      ],
      confirmLabel: 'Delete',
      pendingLabel: 'Deleting…',
      tone: 'danger',
      failure: `${name} could not be deleted. Try again.`,
    }
  },

  /** Deleting a build from the Roster — wherever it lives. */
  deleteBuild(name: string): ConfirmCopy {
    return {
      title: `Delete ${name}?`,
      body: [`This action cannot be undone. ${name} will be permanently removed.`],
      confirmLabel: 'Delete',
      pendingLabel: 'Deleting…',
      tone: 'danger',
      failure: `${name} could not be deleted. Try again.`,
    }
  },

  /** Scrapping the crew's crawler — the table runner's act, and a crawler's Delete. */
  scrap(name: string): ConfirmCopy {
    return {
      title: `Scrap ${name}?`,
      body: [`This deletes ${name} for everyone in the game and can't be undone.`],
      confirmLabel: 'Scrap',
      pendingLabel: 'Scrapping…',
      tone: 'danger',
      failure: `${name} could not be scrapped. Try again.`,
    }
  },

  /**
   * Moving a build OUT of a Game — back to My Stuff, or on to another Game.
   *
   * Only this direction asks. Moving something from My Stuff into a Game takes
   * nothing from anybody; moving it out takes it off a shared roster that the
   * rest of the table was reading. It is the same record either way (a move
   * keeps its id), so it can always be moved back.
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
    const failure = `${args.name} could not be moved. Try again.`

    if (args.to.kind === 'shelf') {
      return {
        title: `Take ${args.name} out of ${from}?`,
        body: [
          `${args.name} leaves the game's roster and goes back to My Stuff, so the rest of the table won't see ${it} any more.`,
          clearedAssignments(args.kind, from),
          `You can move ${it} back into the game later.`,
        ],
        confirmLabel: 'Move to My Stuff',
        pendingLabel: 'Moving…',
        tone: 'danger',
        failure,
      }
    }

    const to = args.to.name ?? 'another game'
    return {
      title: `Move ${args.name} to ${to}?`,
      body: [
        `${args.name} leaves ${from}'s roster and joins ${to}'s, so ${from}'s table won't see ${it} any more.`,
        clearedAssignments(args.kind, from),
        `You can move ${it} back later.`,
      ],
      confirmLabel: 'Move',
      pendingLabel: 'Moving…',
      tone: 'danger',
      failure,
    }
  },
}
