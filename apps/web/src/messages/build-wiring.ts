/** The words of apps/web/src/build/wiring: the message catalogue (ADR-053). */

import { messages } from './define'

export const wiringCopy = messages({
  assignMechToPilot: 'Assign Mech to Pilot',
  aPilotFliesOneMech:
    'A pilot flies one mech and a mech carries one pilot — picking a mech already flown moves it to this pilot.',
  assignPilotToCrawler: 'Assign Pilot to Crawler',
  aPilotCrewsOneCrawler:
    'A pilot crews one crawler — picking another moves them there. Their mech is assigned separately.',
  assignPilotToMech: 'Assign Pilot to Mech',
  aMechCarriesOnePilot:
    'A mech carries one pilot and a pilot flies one mech — picking a pilot already in another mech moves them here.',
  assignMechToCrawler: 'Assign Mech to Crawler',
  aMechIsAssignedTo:
    'A mech is assigned to one crawler, on its own — its pilot is assigned separately.',
  addPilotToCrew: 'Add Pilot to Crew',
  aPilotCrewsOneCrawler2:
    'A pilot crews one crawler — adding one already assigned to another moves them here.',
  aMechIsAssignedTo2:
    'A mech is assigned to one crawler — assigning one from another bay moves it here. Its pilot is assigned separately.',
  callsign: 'Callsign',
  tl: 'TL',
})
