/** The words of apps/web/src/build/starterSet: the message catalogue (ADR-054). */

import { messages } from './define'

export const buildStarterSetCopy = messages({
  copyTo: 'Copy {name} to {label}?',
  makeACopy: 'Make a copy',
  makeACopyOfName: 'Make a copy of {name}',
  copying: 'Copying…',
  copiedTo: 'Copied {name} to {label}.',
  pilotAndMech: '{name} and {mech}',
  yourTrainingBay: 'your Training Bay',
  copyBody: 'This makes {name} a build of your own in {label}, to edit and play.',
  copyPairBody:
    'This makes {name} and their Mech, {mech}, builds of your own in {label}, the Mech already assigned.',
  signInToMakeA: 'Sign in to make a copy',
  starterSet2: 'Starter Set',
  copyOneIntoYourTraining:
    'Copy one, or the whole crew, into your Training Bay or into one of your Games to play it.',
  signInToCopyOne:
    'Sign in to copy one, or the whole crew, into your Training Bay or into a Game and play it.',
  thatIsntInTheStarter: 'That isn’t in the Starter Set',
  noStarterSetBuildLives: 'No Starter Set build lives at this address.',
  copyTheCrewTo: 'Copy the crew to…',
  copyTheWholeCrewTo: 'Copy the whole crew to…',
  signInToCopyTheCrew: 'Sign in to copy the crew',
  copyTheWholeCrew: 'Copy the whole crew?',
  copyTheWholeCrewBody:
    'This puts all six Pilots, their Mechs and Crawler #430 ‘Tenacity’ in {label}, each a build of your own, crewed and docked as the Starter Set has them.',
  copyTheQuickstartCrewBody:
    'This puts all six Pilots and their Mechs in {label}, each a build of your own, every Pilot in their Mech as the Quickstart has them.',
  theStarterSetStaysAs:
    'The {crew} stays as {publisher} published it. Don’t want a copy later? Delete it like any other build.',
  quickstartCrew: 'Quickstart crew',
  quickstartCrewIntro:
    'The six premade Pilots and Mechs of the {book}, one for each Core Class, all of Crawler #279. Read-only reference: open any sheet to read it.',
  copyTheCrew: 'Copy the crew',
  theCrewCouldNotBe: 'The crew could not be copied. Try again.',
  copiedBuildsTo: 'Copied {builds} builds to {label}.',
  tl: 'TL',
  techLevel: 'Tech Level',
  thePreGeneratedCrewOf: 'The pre-generated crew of',
  byPublisher: ', by {publisher}.',
  // The paired crew manifest.
  hp: 'HP',
  ap: 'AP',
  sp: 'SP',
  ep: 'EP',
  heat: 'Heat',
  mech: 'Mech',
  type: 'Type',
  bays: 'Bays',
  pilots: 'Pilots',
  pilotsAndTheirMechs: 'Pilots & their Mechs',
  unionCrawler: 'Union Crawler',
  mechsWithNoPilot: 'Mechs with no Pilot',
  // The page's side track: from a premade crew to the table.
  fromCrewToTable: 'From crew to table',
  stepRead: 'Open any sheet above and read it.',
  stepSignIn: 'Sign in with Discord.',
  stepCopy: 'Copy one Pilot, or the whole crew, into your Training Bay.',
  stepGame: 'Start a Game in Your Games and share its invite link.',
  stepPlay: 'Seat your Pilots and open their Play screen at the table.',
  yourGames: 'Your Games',
  signIn: 'Sign in',
  theBook: 'The book',
  theBookBody:
    '{adventure} is the Starter Set’s campaign: maps, NPCs, monsters and a Mediator’s advice for this crew.',
  readAboutTheBook: 'Read about the book',
  staysAsPublished:
    "The {roster}'s {name} stays as {publisher} published it. Don't want the copy later? Delete it like any other build.",
  notCopied: '{name} could not be copied. Try again.',
  thePreGeneratedCrewOwnedBy:
    'The pre-generated crew of {adventure}, owned by {publisher}. Read-only reference: open any sheet to read it.',
})
