/**
 * Built-in "The Eldridge Coast" workspace — a home-campaign roster transcribed
 * from its Salvage Union character-sheet workbook: six pilots, ten mech /
 * companion patterns, and two Union Crawlers (Haven and Gladhand) with their
 * named NPC bay crews.
 *
 * Modelled exactly on the Starter Set (lib/starterSet/) — the second built-in,
 * on-demand-seeded workspace:
 *   - Every record here is FULLY STATIC plain data — hard-coded reference slugs
 *     (chassis / systems / modules / class / ability / equipment) and reference
 *     ids (crawler type + bays). Nothing resolves against `salvageunion-reference`
 *     at runtime; the seed test asserts each ref still resolves.
 *   - IDs are DETERMINISTIC (`eldridge-*`) so the on-demand seed is idempotent:
 *     re-opening the workspace after deleting a single member does not resurrect
 *     it (the guard is the workspace's existence), and a double-open overwrites
 *     rather than duplicates.
 *   - `createdAt`/`updatedAt` are a FIXED constant so these rows never sort
 *     ahead of the user's own newest-first builds.
 *   - Everything lives in `ELDRIDGE_WORKSPACE_ID`; it is reachable only by
 *     selecting it in the Workspace switcher (like the Starter Set).
 *
 * Fidelity notes — the workbook mixes canonical SRD content with home-brew.
 * Best-effort mapping (canonical refs where a name resolves; free-text notes in
 * `description` / `quirk` / `appearance` / NPC descriptions otherwise):
 *   - Four companions are ability-granted equipment, NOT mechs (Survey Drone →
 *     Custos & PR-1, Mecha Companion → Incitatus, Auto-Turret → Rek Jet). They
 *     live on their owning pilot: the drone-equipment slug in `equipment[]`, its
 *     Name/Appearance/A.I.-Personality in `equipmentChoices`, and its installed
 *     systems/modules in `partners` (ADR-027). The stat block carries its
 *     own SP/EP/slots, so it renders as a proper stat card with an editable
 *     loadout — no "unknown chassis" artifact.
 *   - The crawlers' home-brew Library / Bar bays are not SRD bays (only the ten
 *     canonical bays exist), so that crew is folded into the crawler
 *     `description` rather than a `crawlerBays[]` entry.
 *   - Crawler type-abilities (All Terrain Locomotion / Improved Trading Bay)
 *     and mech cargo/ownership notes are captured in mech `appearance` / `quirk`
 *     (the mech `description` field is deprecated and NOT rendered by the sheet,
 *     so it is left unset — unlike pilot `description`, which renders as the
 *     Bio). The crawlers' mounted weapons (Mechapult, CACB Laser) are stored by
 *     NAME as canonical Systems so the crawler sheet's id/name resolver renders
 *     them as full weapon cards.
 *   - Pilot real names that the sheet left blank/unknown fall back to the
 *     callsign (Roach-Boy); the pilots' sheet HP/AP maxima above the 10/5 base
 *     are encoded via `maxHpModifier` / `maxApModifier`.
 */

import type { Crawler } from '../schemas/crawler'
import type { Mech } from '../schemas/mech'
import type { Pilot } from '../schemas/pilot'
import type { SoftLink } from '../schemas/softLink'
import type { Workspace } from '../schemas/workspace'

/** Deterministic id of the built-in Eldridge Coast workspace. */
export const ELDRIDGE_WORKSPACE_ID = 'eldridge-coast-workspace'

/** Fixed timestamp for every seeded row (see file header — determinism). */
const SEED_TS = '2020-01-01T00:00:00.000Z'

/** Crawler-type ids (crawler `type` resolves by id/name, not slug). */
const EXPLORATORY_TYPE_ID = 'd850cd93-f1cc-462b-bfa4-babfb0b2812e'
const TRADE_CARAVAN_TYPE_ID = '46e44f56-be78-49d8-bfe4-32628ad4b8ef'

/** Base crawler-bay ids (resolve by id/name, not slug). */
const BAY = {
  command: '233d7930-1c4d-475d-9ea8-c88a1c70350c',
  mech: '3234f326-0fae-4ec1-a31e-900be859c156',
  storage: '4522e605-a384-4c3d-b556-c377e4cc2a97',
  armament: '6b0e9620-06ed-40ee-9feb-5f635518e48e',
  crafting: 'e4612293-d3a1-4533-889a-977c92ea1313',
  trading: '2a4ac355-95fc-451b-8b46-cf8ba5eec31b',
  med: '0850a891-19e3-4372-af35-0a1679130c8f',
  pilot: '74904a14-92be-41e0-80d9-63fce02b8851',
  armoury: '3075663e-0ee6-4e82-8697-4778f303adc7',
  cantina: '674a412f-486b-4693-b912-1838cc39b77d',
} as const

// ---------------------------------------------------------------------------
// Workspace
// ---------------------------------------------------------------------------

export const ELDRIDGE_WORKSPACE: Workspace = {
  id: ELDRIDGE_WORKSPACE_ID,
  schemaVersion: 1,
  name: 'The Eldridge Coast',
  createdAt: SEED_TS,
}

// ---------------------------------------------------------------------------
// Pilots
// ---------------------------------------------------------------------------

/** Build a pilot record with the shared, always-present defaults. */
function pilot(
  fields: Pick<
    Pilot,
    | 'id'
    | 'name'
    | 'callsign'
    | 'classRef'
    | 'abilities'
    | 'equipment'
    | 'motto'
    | 'keepsake'
    | 'appearance'
    | 'background'
  > &
    Partial<
      Pick<
        Pilot,
        | 'description'
        | 'maxHpModifier'
        | 'maxApModifier'
        | 'trainingPoints'
        | 'equipmentChoices'
        | 'partners'
      >
    >
): Pilot {
  return {
    schemaVersion: 1,
    conditions: [],
    workspaceId: ELDRIDGE_WORKSPACE_ID,
    createdAt: SEED_TS,
    updatedAt: SEED_TS,
    ...fields,
  }
}

const PILOT_CALIGULA = 'eldridge-pilot-caligula'
const PILOT_NELL = 'eldridge-pilot-nell'
const PILOT_PARCEL = 'eldridge-pilot-parcel'
const PILOT_GERSIN = 'eldridge-pilot-gersin'
const PILOT_ROACH_BOY = 'eldridge-pilot-roach-boy'
const PILOT_LESTER = 'eldridge-pilot-lester'

// Drone/companion equipment choice ids (from each granting equipment's SRD
// `choices`) — used to seed the companion's Name / Appearance / A.I. Personality
// via the pilot's equipmentChoices, alongside the partners below.
const SURVEY_DRONE_NAME = '0b31fd03-df8b-485b-9a1e-d048496e89b7'
const MECHA_COMPANION_NAME = 'c0d1e2f3-a4b5-4c6d-9e0f-1a2b3c4d5e6f'
const MECHA_COMPANION_APPEARANCE = 'a901dcdc-8c95-4bea-90ee-3c02cd695d93'
const AUTO_TURRET_NAME = 'b9c0d1e2-f3a4-4b5c-9d0e-1f2a3b4c5d6e'
const AUTO_TURRET_AI = 'b1dae587-1448-41df-9194-97d5dd3a23d8'

export const ELDRIDGE_PILOTS: readonly Pilot[] = [
  pilot({
    id: PILOT_CALIGULA,
    name: 'Caligula',
    callsign: 'Cali',
    classRef: 'scout',
    abilities: [
      'you-shot-first',
      'spotter',
      'custom-sniper-rifle',
      'gather-intelligence',
      'tail',
      'survey-drone',
      'mecha-companion',
      'snipe',
      'infiltration',
    ],
    equipment: [
      'remote-mine',
      'portable-comms-unit',
      'holofoil-tent',
      'handheld-epoxy-canister',
      // Ability-granted companions (Survey Drone → Custos, Mecha Companion →
      // Incitatus), each with its installed loadout below.
      'survey-drone',
      'mecha-companion',
    ],
    equipmentChoices: {
      'survey-drone': { [SURVEY_DRONE_NAME]: ['Custos'] },
      'mecha-companion': {
        [MECHA_COMPANION_NAME]: ['Incitatus'],
        [MECHA_COMPANION_APPEARANCE]: ['Industrial and utilitarian.'],
      },
    },
    partners: [
      {
        id: 'eldridge-partner-custos',
        hostRef: 'survey-drone',
        hostSchema: 'equipment',
        name: 'Custos',
        systems: ['nanofibre-net-launcher', '50-cal-machine-gun'],
        modules: ['hacking-repeater-node', 'damage-assessor', 'comms-module'],
        conditions: [],
      },
      {
        id: 'eldridge-partner-incitatus',
        hostRef: 'mecha-companion',
        hostSchema: 'equipment',
        name: 'Incitatus',
        appearance: 'Industrial and utilitarian.',
        systems: [
          'locomotion-system',
          'long-barrelled-green-laser',
          'composite-armour',
          'tracking-node',
        ],
        modules: ['comms-module', 'navigation-module'],
        conditions: [],
      },
    ],
    motto: 'Feel the fear and do it anyway.',
    keepsake: 'Butterfly Earrings',
    appearance: 'Gaunt, all hair buzzed with the shortest clippers. He/him, age 34.',
    background: 'Survivor',
    maxHpModifier: 4,
    maxApModifier: 2,
    trainingPoints: 2,
    description:
      'Scout who advanced into the Ranger tree. Custom Sniper Rifle (Tech 3): Energy, 5 SP, Range Long, Silent; Mods: High Caliber, Compact, Silenced. Fields a Mecha Companion (Incitatus) and a Survey Drone (Custos).',
  }),
  pilot({
    id: PILOT_NELL,
    name: 'Nell',
    callsign: 'Nell',
    classRef: 'hacker',
    abilities: [
      'bionic-senses',
      'bionic-arms',
      'bionic-legs',
      'hacking-kit',
      'system-and-software-hacker',
      'denial-of-service-attack',
      'trojan-horse',
      'counter-hacking',
      'worm',
    ],
    equipment: [
      'reactive-armour',
      'fell-rifle',
      'handheld-epoxy-canister',
      'disposable-camera',
      'high-tensile-wire',
      'portable-comms-unit',
    ],
    motto: "I've Got You",
    keepsake: 'Family Photo',
    appearance: 'Homebrewed Android. She/her.',
    background: 'Fugitive Corporate Property',
    maxHpModifier: 8,
    maxApModifier: 2,
    trainingPoints: 1,
    description:
      'Hacking Kit loadout: Reactor Overload, Firewall, Sleeping Beauty. Disposable Camera: 24 photos left.',
  }),
  pilot({
    id: PILOT_PARCEL,
    name: 'Parcel',
    callsign: 'Parcel',
    classRef: 'hauler',
    abilities: [
      'squeeze-it-in',
      'expert-salvager',
      'emergency-salvage-drop',
      'folk-song',
      'behemoth',
      'valiant-speech',
      'union-representative',
      'union-call',
      'recruit',
    ],
    equipment: [
      'rocket-launcher',
      'salvaging-tools',
      'reactive-armour',
      'rigging-jack',
      'reinforced-polycarbonate-shield',
      'melee-armament',
    ],
    motto: "i'll turn this mech around",
    keepsake: 'Pinecone',
    appearance: 'Big burly lumberjacky guy. He/him.',
    background: 'Born Salvager',
    trainingPoints: 3,
    description: 'Hauler who advanced into the Union Rep tree.',
  }),
  pilot({
    id: PILOT_GERSIN,
    name: 'Gersin',
    callsign: 'Part',
    classRef: 'scout',
    abilities: [
      'you-shot-first',
      'spotter',
      'custom-sniper-rifle',
      'gather-intelligence',
      'tail',
      'survey-drone',
      'flashback',
      'camo-suit',
      'wingsuit',
    ],
    equipment: [
      'reactive-armour',
      'green-laser-rifle',
      'portable-comms-unit',
      'holofoil-tent',
      'hazard-protection-suit',
      // Ability-granted Survey Drone → PR-1, with its loadout below.
      'survey-drone',
    ],
    equipmentChoices: {
      'survey-drone': { [SURVEY_DRONE_NAME]: ['PR-1'] },
    },
    partners: [
      {
        id: 'eldridge-partner-pr-1',
        hostRef: 'survey-drone',
        hostSchema: 'equipment',
        name: 'PR-1',
        systems: ['hydraulic-crusher'],
        modules: ['hull-magnetiser', 'self-destruct', 'survey-scanner'],
        conditions: [],
      },
    ],
    motto: "It's worth a shot.",
    keepsake: 'Tatterfolk family photo',
    appearance: 'Wiry. They/them, age 38.',
    background: 'Corpo Worker',
    maxHpModifier: 4,
    maxApModifier: 2,
    description:
      'Custom Sniper Rifle (Tech 3): 5 SP dmg, Far Range; Mods: Laser Guidance, Pinpoint Targeter, Rangefinder. Fields a Survey Drone.',
  }),
  pilot({
    id: PILOT_ROACH_BOY,
    name: 'Roach-Boy',
    callsign: 'Roach-Boy',
    classRef: 'engineer',
    abilities: [
      'engineering-expertise',
      'jury-rig',
      'talk-shop',
      'mech-gyver',
      'auto-turret',
      'mech-acquisition',
      'field-fabrication',
      'miniaturised-emp',
      'chassis-modder',
    ],
    equipment: [
      'portable-comms-unit',
      'high-tensile-wire',
      'tranquiliser-rifle',
      'green-laser-rifle',
      // Ability-granted Auto-Turret → Rek Jet, with its loadout below.
      'auto-turret',
    ],
    equipmentChoices: {
      'auto-turret': {
        [AUTO_TURRET_NAME]: ['Rek Jet'],
        [AUTO_TURRET_AI]: ['Changes personality frequently'],
      },
    },
    partners: [
      {
        id: 'eldridge-partner-rek-jet',
        hostRef: 'auto-turret',
        hostSchema: 'equipment',
        name: 'Rek Jet',
        aiPersonality: 'Changes personality frequently',
        systems: [
          'red-laser',
          'locomotion-system',
          'nanofibre-net-launcher',
          'composite-armour',
          'welding-laser',
        ],
        modules: ['comms-module'],
        conditions: [],
      },
    ],
    motto: 'It is not a bug, it is a feature.',
    keepsake: 'Roach Squad Pin',
    appearance: 'Small and Dirty. He/him.',
    background: 'Prodigy',
    maxHpModifier: 4,
    maxApModifier: 2,
    trainingPoints: 2,
    description:
      'Engineer who advanced into the Fabricator tree; deploys an Auto-Turret (Rek Jet). Real name unknown. Associates: the Roach Scouts; Jan and Wayne (the vent kids); Davey the Hartford; Tiberius (AI bracelet); Roger Belamy. The Evil Roach is in the Abandoned Eldridge Outpost.',
  }),
  pilot({
    id: PILOT_LESTER,
    name: 'Lester Owens',
    callsign: 'Stumpy',
    classRef: 'soldier',
    abilities: [
      'charge',
      'wastelander-rapport',
      'overpower',
      'provoke',
      'duel',
      'resourceful',
      'custom-missile-launcher',
      'glanded-stims',
      'modular-face-implant',
      'bionic-endoskeleton',
    ],
    equipment: [
      'improvised-melee-weapon',
      'first-aid-kit',
      'shotgun',
      'portable-arc-welder',
      'reactive-armour',
      'rigging-jack',
    ],
    motto: 'No job too big.',
    keepsake: 'Stuffed Toy',
    appearance: '',
    background: 'Mercenary',
    maxHpModifier: 4,
    maxApModifier: 2,
    trainingPoints: 1,
    description: 'Soldier who advanced into the Cyborg tree.',
  }),
]

// ---------------------------------------------------------------------------
// Mechs — the tab name is the pattern name (a chassis + systems + modules
// combination). All six use standard SRD chassis. The four ability-granted
// companions (Survey Drone / Mecha Companion / Auto-Turret) are NOT here — they
// live on their owning pilot as equipment with a loadout (see the header notes).
// ---------------------------------------------------------------------------

/** Build a mech record with the shared, always-present defaults. */
function mech(
  fields: Pick<Mech, 'id' | 'name' | 'chassisRef' | 'patternName' | 'systems' | 'modules'> &
    Partial<Pick<Mech, 'quirk' | 'appearance' | 'systemConditions'>>
): Mech {
  return {
    schemaVersion: 1,
    cargoLots: [],
    conditions: [],
    workspaceId: ELDRIDGE_WORKSPACE_ID,
    createdAt: SEED_TS,
    updatedAt: SEED_TS,
    ...fields,
  }
}

const MECH_GOAT = 'eldridge-mech-goat'
const MECH_DAMNATIO = 'eldridge-mech-damnatio-memoriae'
const MECH_NEW_DUKE = 'eldridge-mech-new-duke'
const MECH_PEEKABOO = 'eldridge-mech-peekaboo'
const MECH_RUST_BUCKET = 'eldridge-mech-rust-bucket'
const MECH_SOB = 'eldridge-mech-son-of-beanstalk'

export const ELDRIDGE_MECHS: readonly Mech[] = [
  mech({
    id: MECH_GOAT,
    name: 'GOAT',
    chassisRef: 'atlas',
    patternName: 'GOAT',
    systems: [
      'armour-plating',
      'escape-hatch',
      'aff-coolant-foam',
      'prawn-sifter',
      'locomotion-system',
      'electro-magnetic-shield-projector',
      '120mm-cannon',
    ],
    modules: ['metal-detector', 'comms-module'],
    quirk: 'constantly leaks coolant',
    appearance:
      'Overgrown with plants and vines. Cargo: melee armament, ejection system, "Panda sneeze".',
  }),
  mech({
    id: MECH_DAMNATIO,
    name: 'Damnatio Memoriae',
    chassisRef: 'solo',
    patternName: 'Damnatio Memoriae',
    systems: ['rail-rifle', 'locomotion-system', 'ejection-system', 'high-gain-antenna'],
    modules: ['comms-module', 'survey-scanner', 'ir-night-vision-optics', 'pinpoint-targeter'],
    quirk: 'Unusual cockpit location.',
    appearance:
      "Covered in camo and foliage. The main gun cuts through the cockpit, only slightly to the right of the pilot's headrest.",
  }),
  mech({
    id: MECH_NEW_DUKE,
    name: 'New Duke',
    chassisRef: 'brawler',
    patternName: 'New Duke',
    systems: [
      'rigging-arm',
      'escape-hatch',
      'mech-melee-armament',
      'locomotion-system',
      'needle-missile-pod',
      'armour-plating',
      'grappling-harpoon',
    ],
    modules: ['adv-weapon-link', 'personal-recreation-device'],
    quirk: 'Novelty Car Horn',
    appearance: 'Beat up and Orange. Its Armour Plating is destroyed.',
    systemConditions: { 'armour-plating': 'destroyed' },
  }),
  mech({
    id: MECH_PEEKABOO,
    name: 'Peekaboo',
    chassisRef: 'solo',
    patternName: 'Peekaboo',
    systems: ['ejection-system', 'long-barrelled-green-laser', 'hover-locomotion-system'],
    modules: ['zoom-optics', 'comms-module', 'firewall', 'ecm-transmitter'],
    quirk: 'Exterior fluctuates in colour.',
    appearance: 'Industrial and utilitarian.',
  }),
  mech({
    id: MECH_RUST_BUCKET,
    name: 'Rust Bucket',
    chassisRef: 'goliath',
    patternName: 'Rust Bucket',
    systems: [
      'heavy-duty-mining-rig',
      'escape-hatch',
      'spider-locomotion-system',
      'adv-fabrication-arm',
      'rigging-arm',
      'shotgun-pit',
    ],
    modules: ['offensive-protocols', 'comms-module', 'personal-recreation-device'],
    quirk: 'Cockpit has far, far too many buttons.',
    appearance: 'Looks Like Shit, Runs like Butter.',
  }),
  mech({
    id: MECH_SOB,
    name: 'Son of Beanstalk',
    chassisRef: 'mirrorball',
    patternName: 'Son of Beanstalk',
    systems: [
      'locomotion-system',
      'escape-hatch',
      'high-gain-antenna',
      'capacitance-bank',
      'electro-magnetic-hardening',
    ],
    modules: ['comms-module'],
    quirk: 'Mismatched Hardware',
    appearance: 'Hostile Ladybug.',
  }),
]

// ---------------------------------------------------------------------------
// Crawlers — Haven (Exploratory) and Gladhand (Trade Caravan), both Tech 4
// (City, base SP 35). The home-brew Library / Bar bays are folded into the
// description (only the ten canonical bays exist as SRD bays).
// ---------------------------------------------------------------------------

const CRAWLER_HAVEN = 'eldridge-crawler-haven'
const CRAWLER_GLADHAND = 'eldridge-crawler-gladhand'

type BayCrew = { ref: string; npcName: string; npcDescription?: string }

const HAVEN_BAY_CREW: readonly BayCrew[] = [
  {
    ref: BAY.command,
    npcName: 'Singh',
    npcDescription:
      'Princep. Takes his job very seriously, but refuses the hierarchy of his position.',
  },
  {
    ref: BAY.mech,
    npcName: 'Tommins',
    npcDescription: 'Greaser. Kind of a stoner. Really, really, *Really* into mechs.',
  },
  {
    ref: BAY.armament,
    npcName: 'Alvarez',
    npcDescription:
      'Gunny. Loud and Fabulous, large and in charge of the Mechapult. Loves the thrill and majesty of explosions.',
  },
  { ref: BAY.crafting, npcName: 'Yusef', npcDescription: 'Forger. Former corpo.' },
  {
    ref: BAY.trading,
    npcName: 'Lapp',
    npcDescription:
      'Operator. A somewhat unsettling man, though a sharp operator and keen trader. Distaste for organized religion; struggles with memory issues — but never about the deal.',
  },
  {
    ref: BAY.med,
    npcName: 'Guo',
    npcDescription:
      'Doctor. Kind-hearted older gentleman. Optimistic; tries to keep things jovial. Not above a gentle lie for your own good.',
  },
  {
    ref: BAY.pilot,
    npcName: 'Yancy',
    npcDescription:
      'Ace. Broad-shouldered woman, a little intense but excited to train new pilots. Sees mech piloting as an art. Former (illegal) racer.',
  },
  {
    ref: BAY.armoury,
    npcName: 'Slott',
    npcDescription:
      'Quartermaster. A quirky thin man left near-deaf by a life beside powerful weaponry. Lighthearted and goofy; often mistaken for stupid when he is just searching for the right rhyme.',
  },
  {
    ref: BAY.cantina,
    npcName: 'Hobart',
    npcDescription:
      'Chef. An incredibly kind elderly man, though a tyrant once the cooking begins. Keeps an "Eternal Stew" he all but exclusively eats.',
  },
  {
    ref: BAY.storage,
    npcName: 'Tanner',
    npcDescription:
      'Bullwhacker. Incredibly good at the job — maybe too good; occasionally misses the forest for the trees.',
  },
]

const GLADHAND_BAY_CREW: readonly BayCrew[] = [
  { ref: BAY.command, npcName: 'Fawkes', npcDescription: 'Princep.' },
  { ref: BAY.mech, npcName: 'Quisling', npcDescription: 'Greaser.' },
  { ref: BAY.armament, npcName: 'Ames', npcDescription: 'Gunny.' },
  { ref: BAY.crafting, npcName: 'Cariot', npcDescription: 'Forger.' },
  { ref: BAY.trading, npcName: 'Jingwei', npcDescription: 'Operator. Looks like Santa.' },
  { ref: BAY.med, npcName: 'Hansenn', npcDescription: 'Doctor.' },
  { ref: BAY.pilot, npcName: 'Ephi', npcDescription: 'Ace.' },
  { ref: BAY.armoury, npcName: 'Benedict', npcDescription: 'Quartermaster.' },
  { ref: BAY.cantina, npcName: 'Brutus', npcDescription: 'Chef.' },
  { ref: BAY.storage, npcName: 'Tanner', npcDescription: 'Bullwhacker.' },
]

const HAVEN_CRAWLER: Crawler = {
  id: CRAWLER_HAVEN,
  schemaVersion: 1,
  name: 'Haven',
  description:
    'Union Crawler #812. Exploratory, Tech 4 (City). Type ability: All Terrain Locomotion. Also crewed by the home-brew Library (Archivist: Glinda — 74-year-old widower, big Star Trek fan, incense aficionado) and Bar (Bartend: Francis "Frank" Bulwark — does not go by Frank). Notable stores: Bio Scrap Freezer upgrade (40 units), Ejection System, Rolling Thunder Raider Chit, Target Painter, a T4 Mech Reactor Bomb, the Roiling Earth Chit, and a tier-1 GOAT chassis.',
  techLevel: 'tech-4',
  type: EXPLORATORY_TYPE_ID,
  typeNpc: {
    npcName: 'Rappaport',
    npcCurrentHP: 4,
    npcDescription: 'Wasteland Explorer. Barber, wise beyond his years. Keepsake: Empty Mug.',
  },
  // Stored by NAME (not slug): the crawler sheet's mounted-weapon resolver
  // matches by id/name only, so a slug would render as a raw chit.
  systems: ['Mechapult'],
  crawlerBays: HAVEN_BAY_CREW.map((c) => ({
    bayRef: c.ref,
    npcName: c.npcName,
    npcCurrentHP: 4,
    npcDescription: c.npcDescription,
  })),
  scrapPool: { tl1: 8, tl3: 2, tl4: 2, tl5: 2, tl6: 1 },
  upgradePool: 300,
  workspaceId: ELDRIDGE_WORKSPACE_ID,
  createdAt: SEED_TS,
  updatedAt: SEED_TS,
}

const GLADHAND_CRAWLER: Crawler = {
  id: CRAWLER_GLADHAND,
  schemaVersion: 1,
  name: 'Gladhand',
  description:
    'Union Crawler #213. Trade Caravan, Tech 4 (City). Type ability: Improved Trading Bay. Home-brew Library bay is unstaffed and the Bar is offline. Notable stores: Bio Scrap Freezer upgrade (40 units), Ejection System, Rolling Thunder Raider Chit, Target Painter, a T4 Mech Reactor Bomb, a Decommissioned Murmur, and a tier-1 GOAT chassis.',
  techLevel: 'tech-4',
  type: TRADE_CARAVAN_TYPE_ID,
  typeNpc: {
    npcName: 'Tiberius',
    npcCurrentHP: 4,
    npcDescription: 'Savvy Trader. A corpo trading AI.',
  },
  // Stored by NAME (see Haven's note).
  systems: ['CACB Laser'],
  crawlerBays: GLADHAND_BAY_CREW.map((c) => ({
    bayRef: c.ref,
    npcName: c.npcName,
    npcCurrentHP: 4,
    npcDescription: c.npcDescription,
  })),
  scrapPool: { tl1: 9, tl2: 4, tl3: 3, tl4: 2, tl5: 2, tl6: 1 },
  upgradePool: 5,
  workspaceId: ELDRIDGE_WORKSPACE_ID,
  createdAt: SEED_TS,
  updatedAt: SEED_TS,
}

export const ELDRIDGE_CRAWLERS: readonly Crawler[] = [HAVEN_CRAWLER, GLADHAND_CRAWLER]

// ---------------------------------------------------------------------------
// SoftLinks — pilot↔mech assignments (confirmed by the campaign owner) and
// pilot↔crawler crew membership. Companions are NOT mechs: they live on their
// owning pilot as ability-granted equipment with an installed loadout (see the
// pilots' partners above) — Caligula's Custos (Survey Drone) + Incitatus
// (Mecha Companion), Gersin's PR-1 (Survey Drone), Roach-Boy's Rek Jet
// (Auto-Turret). The mech-to-pilot links cover only the true mechs:
//   - Parcel → GOAT
//   - Caligula → Damnatio Memoriae
//   - Roach-Boy → Rust Bucket
//   - Lester 'Stumpy' Owens → New Duke
//   - Nell → Son of Beanstalk
//   - Gersin 'Part' → Peekaboo
// All six pilots crew Haven (the Exploratory party crawler; its Storage-bay note
// names pilot Parcel). Gladhand is a second crawler with its own NPC crew, no
// pilots auto-assigned.
// ---------------------------------------------------------------------------

const CREW_PILOT_IDS = [
  PILOT_CALIGULA,
  PILOT_NELL,
  PILOT_PARCEL,
  PILOT_GERSIN,
  PILOT_ROACH_BOY,
  PILOT_LESTER,
] as const

/** Owning pilot for each mech. Companions are pilot equipment, not mechs. */
const MECH_PILOT_LINKS: ReadonlyArray<readonly [string, string]> = [
  [MECH_GOAT, PILOT_PARCEL],
  [MECH_DAMNATIO, PILOT_CALIGULA],
  [MECH_RUST_BUCKET, PILOT_ROACH_BOY],
  [MECH_NEW_DUKE, PILOT_LESTER],
  [MECH_SOB, PILOT_NELL],
  [MECH_PEEKABOO, PILOT_GERSIN],
]

export const ELDRIDGE_SOFT_LINKS: readonly SoftLink[] = [
  ...CREW_PILOT_IDS.map((pilotId) => ({
    id: `eldridge-link-crew-${pilotId}`,
    from: { type: 'pilot' as const, id: pilotId },
    to: { type: 'crawler' as const, id: CRAWLER_HAVEN },
    type: 'pilot-to-crawler' as const,
    createdAt: SEED_TS,
  })),
  ...MECH_PILOT_LINKS.map(([mechId, pilotId]) => ({
    id: `eldridge-link-mech-${mechId}`,
    from: { type: 'mech' as const, id: mechId },
    to: { type: 'pilot' as const, id: pilotId },
    type: 'mech-to-pilot' as const,
    createdAt: SEED_TS,
  })),
]
