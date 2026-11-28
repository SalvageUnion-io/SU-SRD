/** The words of apps/web/src/lib: the message catalogue (ADR-054). */

import { messages } from './define'

/** The words of the loose modules of `lib/`: one that belongs to an area's folder says its words from that area's module. */
export const libCopy = messages({
  pilotBay: 'Pilot Bay',
  mechWorkshop: 'Mech Workshop',
  unionCrawler: 'Union Crawler',
  denizensOfTheWasteland: 'Denizens of the Wasteland',
  previewTitle: '{name} · Salvage Union {kind}',
  referenceSection: 'Reference section',
  defaultDescription:
    'The rules reference and character manager for the Salvage Union TTRPG: every chassis, System, Module and ability, and the app to run Pilots, Mechs and Crawlers.',
  leylinePress: 'Leyline Press',
  salvageUnion: 'Salvage Union',
  systemReferenceDocument: 'System Reference Document',
  justNow: 'just now',
  minAgo: '{minutes} min ago',
  heroSearchPlaceholder: 'Gopher, Hacker, Heat, Bio-Titan…',
  techLevel: 'Tech Level {level}',
  hybridClasses: 'Hybrid Classes',
  coreClasses: 'Core Classes',
  changeNotSaved: 'That change could not be saved.',
  // A unit at 0 SP or 0 HP, wherever it is listed (r6 C6).
  down: 'Down',
  needsRepair: 'needs repair',
})
