/**
 * Built-in "Quickstart" roster — the six premade Pilots and Mechs of the
 * Salvage Union Quickstart (2.0, pp.18–41), one for each core class, all of
 * Union Crawler #279. Each pilot is wired to their mech with a SoftLink.
 *
 * Same design as the Starter Set (`./starterSet`): fully static plain data with
 * hard-coded reference slugs, deterministic `quickstart-*` ids, a fixed
 * timestamp, and every record on the Shelf (`gameId: null`). A player copies
 * from it, never into it.
 *
 * The sheets are pilot-and-mech pairs only. The Quickstart describes Crawler
 * #279 in prose (Tech 3, Exploratory, p.44) but prints no crawler sheet, so no
 * crawler is seeded: inventing its bays and crew would be guesswork.
 *
 * Known fidelity gaps:
 *   - Every sheet prints 12 HP / 6 AP: one tier of Pilot Bay Stat Training.
 *     `crawlerLevel: 2` derives exactly that while the pilot has no crawler;
 *     aboard one, its Tech Level takes over, as for any pilot.
 *   - Blackjack's Hacking Kit comes with Eggs Mayhem and Reactor Overload
 *     programmed into it. The kit has no stored-ability field, so the
 *     programmed hacks are not seeded.
 *   - The sheets name no Patterns and print no mech Description, Appearance or
 *     Quirk, so none are seeded.
 *   - Bios are the sheets' words, but for the house capitals on game terms
 *     (Blackjack's "Systems", where the sheet prints "systems").
 */

import type { Mech } from '../schemas/mech'
import type { Pilot } from '../schemas/pilot'
import type { SoftLink } from '../schemas/softLink'

/** Fixed timestamp for every seeded row (see `./starterSet` — determinism). */
const SEED_TS = '2020-01-01T00:00:00.000Z'

type CrewMember = { pilot: Pilot; mech: Mech }

function pilot(
  fields: Pick<
    Pilot,
    | 'id'
    | 'name'
    | 'classRef'
    | 'abilities'
    | 'equipment'
    | 'motto'
    | 'keepsake'
    | 'background'
    | 'description'
  >
): Pilot {
  return {
    schemaVersion: 1,
    callsign: fields.name,
    appearance: '',
    conditions: [],
    // One tier of Stat Training: the sheets' 12 HP / 6 AP (file header).
    crawlerLevel: 2,
    gameId: null,
    createdAt: SEED_TS,
    updatedAt: SEED_TS,
    ...fields,
  }
}

function mech(fields: Pick<Mech, 'id' | 'name' | 'chassisRef' | 'systems' | 'modules'>): Mech {
  return {
    schemaVersion: 1,
    cargoLots: [],
    conditions: [],
    gameId: null,
    createdAt: SEED_TS,
    updatedAt: SEED_TS,
    ...fields,
  }
}

const CREW: readonly CrewMember[] = [
  {
    pilot: pilot({
      id: 'quickstart-pilot-twitch',
      name: 'Twitch',
      classRef: 'engineer',
      abilities: ['engineering-expertise', 'if-i-cut-this-wire', 'mass-field-repair'],
      equipment: [
        'handheld-epoxy-canister',
        'rigging-jack',
        'salvaging-tools',
        'improvised-firearm',
      ],
      motto: 'Call me, or screw it up yourself',
      keepsake: 'Red toy box wheel',
      background: 'Freelancer',
      description:
        'Originating from the Verdant Crescent, Twitch became a member of Crawler #279 after deftly repairing the salvagers’ Mechs following a rough encounter with Aeon Mercs. Displaying remarkable resourcefulness, she has evolved into an indispensable asset for the crew, able to even keep scrap built salvager Mechs in tip top shape.',
    }),
    mech: mech({
      id: 'quickstart-mech-magpie',
      name: 'Magpie',
      chassisRef: 'magpie',
      systems: [
        '30mm-autocannon',
        'articulated-rigging-arm',
        'locomotion-system',
        'escape-hatch',
        'floodlights',
        'fabrication-arm',
      ],
      modules: ['comms-module', 'sonic-screecher', 'damage-assessor'],
    }),
  },
  {
    pilot: pilot({
      id: 'quickstart-pilot-blackjack',
      name: 'Blackjack',
      classRef: 'hacker',
      abilities: ['hacking-kit', 'well-actually', 'system-and-software-hacker'],
      equipment: ['hacking-kit', 'red-laser-pistol', 'portable-comms-unit', 'flare-gun'],
      motto: 'It’s not a bug, it’s a feature.',
      keepsake: 'Pre-war handheld games console',
      background: 'Born Salvager',
      description:
        'Blackjack was born and bred right on Crawler #279, a prodigy who had an affinity for the complex electronic Systems of the Crawler at a young age, managing to hack into the AMS D-base to extract the blueprints of their signature Spectrum Mech, making it available in the Salvage Union Workshop Manual. Blackjack soon became the go-to Hacker of the crew, able to effortlessly resolve an array of tech related problems salvagers face. At least most of the time.',
    }),
    mech: mech({
      id: 'quickstart-mech-spectrum',
      name: 'Spectrum',
      chassisRef: 'spectrum',
      systems: [
        '50-cal-machine-gun',
        'escape-hatch',
        'locomotion-system',
        'loudspeakers',
        'high-gain-antenna',
      ],
      modules: ['comms-module', 'comms-tapper', 'mech-scrambler', 'voice-modulator'],
    }),
  },
  {
    pilot: pilot({
      id: 'quickstart-pilot-commodore',
      name: 'Commodore',
      classRef: 'hauler',
      abilities: ['squeeze-it-in', 'behemoth', 'folk-song'],
      equipment: ['shotgun', 'high-tensile-wire', 'portable-comms-unit', 'hover-sled'],
      motto: 'No Job Too Big',
      keepsake: 'Bobblehead Toy',
      background: 'Wastelander',
      description:
        '‘No job too big’ is the motto Commodore lives her life by. There’s nothing too tough, dirty or beneath her that she wont do to help her crew. Commodore grew up in a wasteland settlement in the Arid Steppes where learning how to bond with one another was key to their survival. She brought that spirit to Crawler #279 which has become like a family to her which she will defend with her life.',
    }),
    mech: mech({
      id: 'quickstart-mech-atlas',
      name: 'Atlas',
      chassisRef: 'atlas',
      systems: [
        '50-cal-machine-gun',
        'blue-mining-laser',
        'fabrication-arm',
        'locomotion-system',
        'escape-hatch',
        'articulated-rigging-arm',
        'loudspeakers',
        'shotgun-pit',
      ],
      modules: ['comms-module', 'coolant-flow-manifold'],
    }),
  },
  {
    pilot: pilot({
      id: 'quickstart-pilot-flea',
      name: 'Flea',
      classRef: 'salvager',
      abilities: ['squeeze-it-in', 'expert-salvager', 'charge'],
      // The sheet's "Melee Armament (Sledgehammer)": the Sledgehammer is its look.
      equipment: ['melee-armament', 'handheld-epoxy-canister', 'salvaging-tools', 'first-aid-kit'],
      motto: 'A salvager knows nothing is truly lost.',
      keepsake: 'Stuffed teddybear',
      background: 'Miner',
      // As printed, "Crawler #298" included: the sheet is the source.
      description:
        'Flea was press-ganged by Thatcher Steel ‘recruiters’ to work in their blood mines within the Ferrous Range. They spent their formative years in a hell of death and iron stripping rare earth minerals from the rock whilst living on nutrient gruel. When rebellion began ferment they were first to begin to sabotage from the inside. Sabotaging industrial equipment, blowing up pipelines and ambushing Thatcher Steel black boots. These attacks lead to the Night of Red Iron where miners would turn their Mechs against the Thatcher Steel thugs and tear them apart. Flea took those miners and headed into the wastes, becoming one of the formative members of Crawler #298. They kept two things from their mining days, their trusty Jackhammer Mech and the persistent cough.',
    }),
    mech: mech({
      id: 'quickstart-mech-jackhammer',
      name: 'Jackhammer',
      chassisRef: 'jackhammer',
      systems: ['green-laser', 'heavy-duty-mining-rig', 'rigging-arm', 'locomotion-system'],
      modules: ['comms-module', 'hull-magnetiser', 'metal-detector'],
    }),
  },
  {
    pilot: pilot({
      id: 'quickstart-pilot-catfish',
      name: 'Catfish',
      classRef: 'scout',
      abilities: ['you-shot-first', 'spotter', 'custom-sniper-rifle'],
      equipment: [
        'custom-sniper-rifle',
        'holofoil-tent',
        'electro-grappling-hook',
        'portable-comms-unit',
      ],
      motto: 'Failure is the mother of success',
      keepsake: 'Snowglobe of home Arco',
      background: 'Corpo Exile',
      description:
        'Catfish was raised in the Sakura home arco in the Central Wastes, paradise compared to most of her salvager crewmates. Her family’s prominent position as stock holding execs in the company meant she had the best schooling and quickly rose the ranks until qualifying for Sakura Special Operations. On one fateful mission she was tasked with assassinating a Union Rep travelling in a salvager convoy as part of a diplomatic envoy. She refused to detonate the explosives, when she realised the salvager convoy had entire families with them, including children. She was exiled from her Arco as punishment. Wandering the wastes she wasn’t even able to get merc work as Sakura blacklisted her licences. The Salvage Unions were the only ones to welcome her in, despite her past.',
    }),
    mech: mech({
      id: 'quickstart-mech-mazona',
      name: 'Mazona',
      chassisRef: 'mazona',
      systems: [
        'armour-plating',
        'escape-hatch',
        'chaff-launcher',
        'high-gain-antenna',
        'tracking-node',
      ],
      modules: ['reactor-overload', 'self-destruct', 'survey-scanner'],
    }),
  },
  {
    pilot: pilot({
      id: 'quickstart-pilot-socrates',
      name: 'Socrates',
      classRef: 'soldier',
      abilities: ['provoke', 'tactical-retreat', 'wastelander-rapport'],
      equipment: ['rifle', 'reactive-armour', 'grenade', 'healing-bio-foam'],
      motto: 'Be kind, for everyone you meet is fighting a hard battle',
      keepsake: '“Madcat” Dog Tags',
      background: 'Salvage War Veteran',
      description:
        'Socrates fought as a merc for whatever side would pay in the First Salvage Wars, whether corpo, salvager, or independent opportunists. Fighting was close up, dirty and brutal and Socrates still wears the scars of that conflict. After the war he fell deep into the bottle, wandering the wastes drinking away his credits. He met a Union recruiter in a bar one night and joined up. Though at first he just took it as another merc job, he soon came to realise the Union was really a family he could rely on.',
    }),
    mech: mech({
      id: 'quickstart-mech-brawler',
      name: 'Brawler',
      chassisRef: 'brawler',
      systems: [
        '30mm-autocannon',
        'locomotion-system',
        'floodlights',
        'articulated-rigging-arm',
        'ejection-system',
        'nanofibre-net-launcher',
      ],
      modules: ['comms-module', 'offensive-protocols', 'reactor-flare'],
    }),
  },
]

export const QUICKSTART_PILOTS: readonly Pilot[] = CREW.map((c) => c.pilot)
export const QUICKSTART_MECHS: readonly Mech[] = CREW.map((c) => c.mech)

/** Each pilot flies their mech (mech-to-pilot: from mech, to pilot). */
export const QUICKSTART_SOFT_LINKS: readonly SoftLink[] = CREW.map(({ pilot: p, mech: m }) => ({
  id: `quickstart-link-mech-${p.id}`,
  from: { type: 'mech' as const, id: m.id },
  to: { type: 'pilot' as const, id: p.id },
  type: 'mech-to-pilot' as const,
  createdAt: SEED_TS,
}))
