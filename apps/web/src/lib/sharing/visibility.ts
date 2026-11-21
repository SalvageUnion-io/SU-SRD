/**
 * Who can see a player thing: one model and one set of words for the five
 * kinds a player can share (pilot, mech, crawler, built NPC and mech pattern).
 *
 * Every kind answers the same three-way question, "Who can see it": Only me,
 * My Game's crew, or Public (anyone with the link). What differs is which answers a
 * kind can take, and why:
 *
 *  - **A sheet** (pilot, mech, crawler, NPC) lives in one container
 *    (ADR-030 §2). In a Game, its crew can see it because it is there; on the
 *    shelf, only its owner can. So the crew answer follows the container, and
 *    the one switch is "Public" (`publicSheet.setPublic`).
 *  - **A pattern** never moves into a Game, so its crew answer is its own
 *    choice of Game (`shelf.setPatternVisibility`).
 *
 * Pure: the control (`build/sharing/WhoCanSee.tsx`) draws these, and the
 * connected settings (`ShareSettings.tsx`) decide which write each one makes.
 */
import type { PublicKind } from 'game-domain/entityKinds'
import { libSharingCopy } from '../../messages/lib-sharing'
import type { PatternVisibility } from '../patterns/patterns'

/** The kinds of player thing a player can share. */
export type ShareKind = PublicKind

/** Who can see it: the same three answers for every kind. */
export type Visibility = PatternVisibility

/** One answer as the control draws it. */
export type VisibilityChoice = {
  value: Visibility
  label: string
  description: string
  /** An answer this thing cannot take where it is now; `description` says why. */
  disabled: boolean
}

const LABEL: Record<Visibility, string> = {
  private: libSharingCopy('onlyMe'),
  game: libSharingCopy('myGamesCrew'),
  link: 'Public',
}

/**
 * A sheet's answers. `gameName` is the Game it is in, or null on the shelf;
 * `inGame` is whether it is in one at all (a Game this viewer cannot name is
 * still a Game).
 */
export function sheetChoices(args: {
  inGame: boolean
  gameName: string | null
}): VisibilityChoice[] {
  const { inGame } = args
  const game = args.gameName ?? libSharingCopy('itsGame')
  return [
    {
      value: 'private',
      label: LABEL.private,
      description: inGame
        ? libSharingCopy('sheetPrivateInGame', { game })
        : libSharingCopy('sheetPrivateOnShelf'),
      disabled: inGame,
    },
    {
      value: 'game',
      label: LABEL.game,
      description: inGame
        ? libSharingCopy('sheetGameInGame', { game })
        : libSharingCopy('sheetGameOnShelf'),
      disabled: !inGame,
    },
    {
      value: 'link',
      label: LABEL.link,
      description: libSharingCopy('sheetLink'),
      disabled: false,
    },
  ]
}

/** A pattern's answers. `gameName` is the Game "My Game's crew" would share it with. */
export function patternChoices(args: { gameName: string | null }): VisibilityChoice[] {
  return [
    {
      value: 'private',
      label: LABEL.private,
      description: libSharingCopy('patternPrivate'),
      disabled: false,
    },
    {
      value: 'game',
      label: LABEL.game,
      description:
        args.gameName === null
          ? libSharingCopy('patternNoGame')
          : libSharingCopy('patternGame', { game: args.gameName }),
      disabled: args.gameName === null,
    },
    {
      value: 'link',
      label: LABEL.link,
      description: libSharingCopy('patternLink'),
      disabled: false,
    },
  ]
}

/** A sheet's current answer: public by link, else whoever its container lets in. */
export function sheetVisibility(args: { isPublic: boolean; inGame: boolean }): Visibility {
  if (args.isPublic) return 'link'
  return args.inGame ? 'game' : 'private'
}
