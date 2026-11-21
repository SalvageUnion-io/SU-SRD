/** The words of apps/web/src/build/wiring: the message catalogue (ADR-054). */

import { messages } from './define'

export const wiringCopy = messages({
  inThisGame: 'In this Game',
  fromYourTrainingBay: 'From your Training Bay',
  movesIntoThisGame: '{name} moves into this Game, then is assigned.',
  moveInAndAssign: 'Move into this Game and assign',
  assignMechToPilot: 'Assign Mech to Pilot',
  aPilotFliesOneMech:
    'A Pilot flies one Mech and a Mech carries one Pilot — picking a Mech already flown moves it to this Pilot.',
  assignPilotToCrawler: 'Assign Pilot to Crawler',
  aPilotCrewsOneCrawler:
    'A Pilot crews one crawler — picking another moves them there. Their Mech is assigned separately.',
  assignPilotToMech: 'Assign Pilot to Mech',
  aMechCarriesOnePilot:
    'A Mech carries one Pilot and a Pilot flies one Mech — picking a Pilot already in another Mech moves them here.',
  assignMechToCrawler: 'Assign Mech to Crawler',
  aMechIsAssignedTo:
    'A Mech is assigned to one crawler, on its own — its Pilot is assigned separately.',
  addPilotToCrew: 'Add Pilot to Crew',
  aPilotCrewsOneCrawler2:
    'A Pilot crews one crawler — adding one already assigned to another moves them here.',
  aMechIsAssignedTo2:
    'A Mech is assigned to one crawler — assigning one from another bay moves it here. Its Pilot is assigned separately.',
  tl: 'TL',
})
