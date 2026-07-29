/**
 * Built-in "Starter Set" roster — the pre-generated crew from the Salvage
 * Union Starter Set adventure *Reclamation of the Wastes*: the six pilots of
 * Union Crawler #430 'Tenacity', each with their mech, plus the crawler and its
 * crew, wired together with SoftLinks.
 *
 * Design (see the seed migration, db/migrations/7-seed-starter-set.ts):
 *   - Every record here is FULLY STATIC plain data — hard-coded reference slugs
 *     (chassis/systems/modules/class/ability/equipment) and reference UUIDs
 *     (crawler type + bays). A migration writes these straight into IndexedDB,
 *     and migrations may only await IndexedDB ops (never reference-data reads),
 *     so nothing here may resolve against `salvageunion-reference` at runtime.
 *   - IDs are DETERMINISTIC (`starter-*`) so the seed is idempotent: the v7
 *     upgrade seeds each row once per client and never resurrects a row the
 *     user later deletes (a same-version re-open doesn't re-run the upgrade).
 *   - `createdAt`/`updatedAt` are a FIXED constant for the same determinism —
 *     these rows never sort ahead of the user's own newest-first builds.
 *   - Every record is stamped `gameId: null` — the **Shelf** (ADR-030 §2).
 *     These rows used to sit in their own Workspace, which is what kept them
 *     out of the user's own builds; with Workspaces retired there is no such
 *     container, so isolation now comes from the seed being opt-in rather than
 *     from where the rows live. See `seedStarterSet.ts` for the full reasoning.
 *
 * Slugs verified against the reference dataset — the seed test
 * (`__tests__/starterSet.test.ts`) fails if any ref stops resolving.
 *
 * Known fidelity gaps (both minor, flagged deliberately):
 *   - The Mule's "Cooling Module" has no entry in the reference `modules`
 *     dataset, so it is omitted (only its `comms-module` is seeded). Adding it
 *     would be a reference-package data change out of scope here.
 *   - The Armament Bay's mounted Mini Mortar is not pre-selected: that bay
 *     choice is a `schema`-only picker whose stored value format we do not
 *     assert, so we leave it unselected rather than seed a wrong value.
 */

import type { Crawler } from '../schemas/crawler'
import type { Mech } from '../schemas/mech'
import type { Pilot } from '../schemas/pilot'
import type { SoftLink } from '../schemas/softLink'

/** Fixed timestamp for every seeded row (see file header — determinism). */
const SEED_TS = '2020-01-01T00:00:00.000Z'

/** Exploratory crawler-type id (crawler `type` resolves by id/name, not slug). */
const EXPLORATORY_TYPE_ID = 'd850cd93-f1cc-462b-bfa4-babfb0b2812e'

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
// Pilots + mechs — one crew member per row, kept side-by-side for review.
// ---------------------------------------------------------------------------

type CrewMember = { pilot: Pilot; mech: Mech }

/** Build a pilot record with the shared, always-present defaults. */
function pilot(
  fields: Pick<
    Pilot,
    'id' | 'name' | 'classRef' | 'abilities' | 'equipment' | 'motto' | 'keepsake' | 'background'
  >
): Pilot {
  return {
    schemaVersion: 1,
    callsign: fields.name,
    appearance: '',
    conditions: [],
    gameId: null,
    createdAt: SEED_TS,
    updatedAt: SEED_TS,
    ...fields,
  }
}

/** Build a mech record with the shared, always-present defaults. */
function mech(
  fields: Pick<Mech, 'id' | 'name' | 'chassisRef' | 'patternName' | 'systems' | 'modules'>
): Mech {
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
      id: 'starter-pilot-bonesaw',
      name: 'Bonesaw',
      classRef: 'engineer',
      abilities: ['jury-rig'],
      equipment: ['handheld-riveting-gun', 'first-aid-kit'],
      motto: 'Mechs are not built in a day.',
      keepsake: 'Lucky Tooth',
      background: 'Prodigy',
    }),
    mech: mech({
      id: 'starter-mech-scrapper',
      name: 'Scrapper',
      chassisRef: 'scrapper',
      patternName: 'Swiss Cheese Pattern',
      systems: [
        'cargo-pod',
        'chainsaw-arm',
        'escape-hatch',
        'riveting-gun',
        'locomotion-system',
        'rigging-arm',
      ],
      modules: ['comms-module', 'eggs-mayhem'],
    }),
  },
  {
    pilot: pilot({
      id: 'starter-pilot-pickle',
      name: 'Pickle',
      classRef: 'hacker',
      abilities: ['well-actually'],
      equipment: ['improvised-explosive-device', 'heavy-duty-torch'],
      motto: 'Carpe diem!',
      keepsake: 'Walkman and tapes',
      background: 'VIP',
    }),
    mech: mech({
      id: 'starter-mech-spectrum',
      name: 'Spectrum',
      chassisRef: 'spectrum',
      patternName: 'Pyrotechnic Pattern',
      systems: ['escape-hatch', 'locomotion-system', 'loudspeakers', 'fm-3-flamethrower'],
      modules: ['comms-module', 'firewall', 'a-little-bit-rude', 'eggs-mayhem'],
    }),
  },
  {
    pilot: pilot({
      id: 'starter-pilot-judge',
      name: 'Judge',
      classRef: 'hauler',
      abilities: ['read-a-person'],
      equipment: ['handheld-riveting-gun', 'high-tensile-wire'],
      motto: 'Dance like nobody is watching.',
      keepsake: 'Leatherbound Journal',
      background: 'Survivor',
    }),
    mech: mech({
      id: 'starter-mech-mule',
      name: 'Mule',
      chassisRef: 'mule',
      patternName: 'Survivor Pattern',
      // Seven Systems, per Judge's Reclamation-of-the-Wastes pre-gen sheet. The
      // Starter Set Parts Catalogue's Survivor Pattern (p.13) prints an eighth,
      // High Pressure Hose, which the pre-gen sheet omits. The sheets are the
      // source of truth for these pre-gens, so this list intentionally differs
      // from the reference dataset's Survivor pattern (which follows the
      // catalogue) — it is not a missing entry.
      systems: [
        '50-cal-machine-gun',
        'armour-plating',
        'escape-hatch',
        'hydraulic-crusher',
        'floodlights',
        'locomotion-system',
        'loudspeakers',
      ],
      // The pre-gen sheet calls the Mule's second module "Cooling Module"; the
      // canonical Starter Set Parts Catalogue name is "Cooling Unit" (the heat
      // mirror of the Heating Unit) — resolved via its `cooling-unit` slug.
      modules: ['comms-module', 'cooling-unit'],
    }),
  },
  {
    pilot: pilot({
      id: 'starter-pilot-driftwood',
      name: 'Driftwood',
      classRef: 'salvager',
      abilities: ['squeeze-it-in'],
      equipment: ['heavy-duty-torch', 'salvaging-tools'],
      motto: 'Live and Let Live.',
      keepsake: 'Butterfly Earrings',
      background: 'Hermit',
    }),
    mech: mech({
      id: 'starter-mech-bobcat',
      name: 'Mr Dig',
      chassisRef: 'bobcat',
      patternName: 'Mr Dig Pattern',
      systems: [
        'escape-hatch',
        'riveting-gun',
        'locomotion-system',
        'high-pressure-hose',
        'mining-rig',
      ],
      modules: ['comms-module', 'survey-scanner'],
      // Derives naturally to its chassis stats (SP 11 / EP 8 / Heat 8), which
      // match the Starter Set Parts Catalogue (p.10) and the reference dataset.
      // The Reclamation-of-the-Wastes pre-gen sheet prints SP 10 / EP 10 / Heat 6
      // for this mech, but that contradicts the catalogue (and all five other
      // pre-gens match theirs) — a character-sheet misprint we do not follow.
    }),
  },
  {
    pilot: pilot({
      id: 'starter-pilot-hotdog',
      name: 'Hotdog',
      classRef: 'scout',
      abilities: ['you-shot-first'],
      equipment: ['improvised-melee-weapon', 'portable-comms-unit'],
      motto: 'Everything is impossible until it is done.',
      keepsake: 'Pack of smokes',
      background: 'Freelancer',
    }),
    mech: mech({
      id: 'starter-mech-mazona',
      name: 'Mazona',
      chassisRef: 'mazona',
      patternName: 'Pop Pattern',
      systems: ['escape-hatch', 'floodlights', 'mini-mortar'],
      modules: ['comms-module', 'survey-scanner', 'zoom-optics'],
    }),
  },
  {
    pilot: pilot({
      id: 'starter-pilot-razor',
      name: 'Razor',
      classRef: 'soldier',
      abilities: ['provoke'],
      equipment: ['first-aid-kit', 'improvised-firearm'],
      motto: 'Those who have a why can bear any how.',
      keepsake: "Snow's Dogtags",
      background: 'Mercenary',
    }),
    mech: mech({
      id: 'starter-mech-thresher',
      name: 'Thresher',
      chassisRef: 'thresher',
      patternName: 'Slugger Pattern',
      systems: ['chainsaw-arm', 'escape-hatch', 'locomotion-system', 'red-laser'],
      modules: ['comms-module', 'self-destruct'],
    }),
  },
]

/** Pilot backstories (Reclamation of the Wastes sheets), keyed by pilot id. */
const PILOT_BIOS: Record<string, string> = {
  'starter-pilot-bonesaw':
    "Bonesaw grew up in the slums of Osiris' home Arco in The Great Cape, always watching the Glass Pyramid where the corpos lived, casting a shadow over the town. He showed an aptitude for engineering from a young age, using his expertise to help maintain the meagre low-Tech Mechs that his community relied on to survive and scavenge.\n\nIt was during a routine repair of his trusted Scrapper Mech that one of the supports failed and his hand was crushed under the machine. He managed to cut it free with a welding tool and cauterise the wound with a homemade Med Bay, replacing it with a mechanical prosthetic. This moment made him realise he didn't want to die in the slums. He took to the road with his Mech, eventually finding his way to Crawler #430.",
  'starter-pilot-pickle':
    "Pickle grew to underground music fame as creator and lead of the holo-EDM band 'Drone.Trap', who play energetic hyperpop mixed with dark, vulgar images of the horrors of the wastes. In their early days, she broadcast their pirate signal across the wastes from deep within the Stefanus data centres, hacking their networks to play music across every comms module, receiver, and jukebox in every Arco, hub, and dingy holo-club that could pick it up.\n\nTheir song 'Wires in my veins' went viral, and soon Stefanus took notice. Rather than be thrown in a prison cube, she persuaded them to use her as an asset — touring the arcos and leeching information back to Stefanus. Fearing her fame (and therefore Stefanus' mercy) would wane, she swapped herself for a hologram during a concert in Neo-Nara and escaped into the wastelands, eventually reaching the last place the corpos would look: Crawler #430.",
  'starter-pilot-judge':
    "Judge has been everywhere: Haven, Novosrik, Phoenix, Ashfall... you name it, he's hauled to it while building up his own trading company. He earned a reputation for working with anyone — waster, corpo, or raider — and getting the job done, no questions asked, as long as he gets paid fair and square.\n\nA routine Sakura hauling job through the Central Wastes went bad when his caravan was ambushed by an Evantis patrol packing heat. Judge barely survived, crawling from the wreck of his mule while the attackers left him for dead. He later hunted down one of the merc pilots and squeezed him for information: they'd been hired by Sakura using Evantis body kits, a ploy to justify expansion into the Arid Steppes. Filled with rage, his crew dead and only a single Mule surviving, he signed up to the Union and got assigned Crawler #430 for some payback against the corpos.",
  'starter-pilot-driftwood':
    "Driftwood likes to keep to herself. She lives on the outskirts of waster settlements, alone in caverns, or tags along with trade caravans. She never stays anywhere too long and scavenges for what she needs. Her only companion is her Bobcat Mech 'Mr Dig', who she has been known to have entire conversations with as the sun sets on the wastes.\n\nShe's occasionally visited by those who have heard of her wide-ranging skillset and need her help, which she's happy to provide for some peace and quiet. She found her way onto Crawler #430 through one of these chance meetings with the crew, who asked her to join them in their foray into Caldera. She agreed, and is enjoying crawler life so far — probably because it's always on the move, just how she likes it.",
  'starter-pilot-hotdog':
    "Hotdog is a match lit at both ends: he'll dive into a nest of Artls to save your skin, then not talk to you for a week for forgetting his drink order. In his youth he fell into the street-gang life of Neo-Nara, the home Arco of Sakura, gambling his life in high-speed Mazona races across the neon strip until he caught the eye of the notorious Black Steel gang.\n\nThe boss, Takeda, took Hotdog under his wing with driving and delivery jobs — but these soon became wetwork, and Hotdog used cheap thrills to forget, until the morning he was asked to drive Sunshine, Takeda's daughter. The two fell in love, and of course it ended messily. Hotdog fled into the wastes and has been running ever since, taking whatever jobs he could until Crawler #430 needed a Pilot for a scouting job. Now he finds solace in the wilds, watching the windswept steppes to support his crew.",
  'starter-pilot-razor':
    "Razor and her life partner Snow were a Mech mercenary power couple for hire. They took whatever jobs the corpos offered, travelling far and wide across the Arcos of the wastes in hopes of earning enough DebtCredit to settle down and put the merc life behind them. They worked together sometimes, but were often apart for long, painful stretches.\n\nDuring one of these periods apart, Razor took a sabotage job against an Aeon agri convoy in the Verdant Crescent. Unbeknownst to her, Snow had taken the job to defend it. Under cover of night a deadly firefight of missiles and lasers was exchanged; when the dust settled, Razor approached to confirm the kill and found herself pulling Snow's body from the cockpit. She fell into a dark hole, drinking through her scrip until she hit rock bottom at a Union Cantina. After hearing her story, the crew invited Razor to stay on Crawler #430 — no questions asked, no work required — and she now has a new purpose as part of the salvaging crew.",
}

/**
 * Mech Description / Appearance / Quirk (Reclamation of the Wastes sheets),
 * folded into the single description field, keyed by mech id.
 */
const MECH_DESCRIPTIONS: Record<string, string> = {
  'starter-mech-scrapper':
    'Originally built by Bonesaw to support his wasteland community, this build bakes in a wide range of utility — it can salvage, repair, and even hack, all of which have proved useful to the crew of Crawler #430.\n\nAppearance: Rugged and well worn, covered in anti-corpo graffiti.\nQuirk: Multiple cockpit mods including a coffee dispenser, vibrating pilot chair, and concealed mini-fridge.',
  'starter-mech-spectrum':
    "Pickle's Spectrum was the real star of Drone.Trap. She would mix the entire set from the cockpit, pumping out beats alongside gouts of fire — while covertly hacking into and causing mayhem within whatever Arco she was performing in.\n\nAppearance: Glossy metallic black, with a jagged rainbow sprayed across it.\nQuirk: A series of RGB lights on the exterior that flash in time to the music played out of the loudspeaker.",
  'starter-mech-mule':
    'The only Mech that survived the trade-caravan ambush, and the one Judge crawled out of. It is built to withstand anything the wastes throw at it and to haul cargo wherever it needs to go.\n\nAppearance: Battle-scarred and weatherworn.\nQuirk: Bulky and oversized compared to other Mules.',
  'starter-mech-bobcat':
    "This build favours utility, with a mining rig that can dig holes in cave networks and create hiding places to weather long nights in the wastes. Though many assume Driftwood talking to Mr Dig means she's lost her marbles, the Mech can actually reply and has basic artificial intelligence — it's just shy, and will only speak when it's alone with Driftwood.\n\nAppearance: Patches of maroon cloth and rags cover the chassis like a makeshift suit; Driftwood has painted a yellow smiley face on the underside of the magnet.\nQuirk: Rudimentary AI personality (shy and introverted).",
  'starter-mech-mazona':
    'A build Hotdog favoured in Neon Strip races. Though using weapons directly against other Pilots was prohibited, the mortar — if timed right — can propel the Mazona forwards with the force of the explosion, acting as a speed bump to clear gaps and obstacles.\n\nAppearance: Sleek, monochrome, and aerodynamic.\nQuirk: Hover function fumes multicoloured smoke.',
  'starter-mech-thresher':
    'Razor designed this Mech to get up close and personal with its dual chainsaw and laser. The Self-Destruct was added to feed her fantasies of explosive redemption in battle — at least Judge persuaded her to include the Escape Hatch.\n\nAppearance: Mil-Tech, clean and built for purpose, with a series of jagged tally marks from its own chainsaw arm counting confirmed kills.\nQuirk: Grinding, loud gears — especially the cacophonous reverb of the chainsaw.',
}

export const STARTER_PILOTS: readonly Pilot[] = CREW.map((c) => ({
  ...c.pilot,
  description: PILOT_BIOS[c.pilot.id],
}))
export const STARTER_MECHS: readonly Mech[] = CREW.map((c) => ({
  ...c.mech,
  description: MECH_DESCRIPTIONS[c.mech.id],
}))

// ---------------------------------------------------------------------------
// Crawler #430 'Tenacity' — Exploratory, Tech Level 1, with its base bays and
// named crew. Base SP for tech-1 is 20 (matches the sheet), so `currentSP` is
// left absent and derives from the tech level.
// ---------------------------------------------------------------------------

const STARTER_CRAWLER_ID = 'starter-crawler-tenacity'

/**
 * Each base bay's crew NPC (rules C11). The name is structured live-play state
 * (`crawlerBays[].npcName`); the Keepsake/Motto are freeform choice selections
 * persisted in `bayChoices`, keyed by the bay ref then the NPC's Keepsake/Motto
 * choice id (from the reference bay's `npc.choices`). The seed test asserts each
 * id pair still matches the reference NPC's Keepsake/Motto choices.
 */
type BayCrew = {
  ref: string
  npcName: string
  keepsakeId: string
  keepsake: string
  mottoId: string
  motto: string
}

const BAY_CREW: readonly BayCrew[] = [
  {
    ref: BAY.command,
    npcName: "Cara 'Blaze' Voss",
    keepsakeId: 'f99d2c89-3bd5-4573-a7d0-1b608f93467b',
    keepsake: 'Harmonica',
    mottoId: 'f64fd72a-ae30-4712-b36b-3c690c98ccb0',
    motto: 'An ounce of prevention is worth a pound of cure.',
  },
  {
    ref: BAY.mech,
    npcName: "Yuri 'Tinker' Petrov",
    keepsakeId: 'f94dcbf5-5fa4-4a77-9fe1-1c96ff4a4a32',
    keepsake: 'Dog Tags',
    mottoId: 'aced717b-0856-4c79-adea-fd3f071c9e3c',
    motto: 'Salvagers know nothing is truly lost.',
  },
  {
    ref: BAY.armament,
    npcName: "Sergio 'Grip' Cruz",
    keepsakeId: '937d3b47-62ce-4325-8ec8-6c17d87214d6',
    keepsake: 'Cloth Patch',
    mottoId: '8c492816-24f1-4f92-b7ed-43005d4356cf',
    motto: 'Everything is impossible until it is done.',
  },
  {
    ref: BAY.crafting,
    npcName: "Danika 'Artificer' Gujar",
    keepsakeId: '1c5d1210-e24e-4a59-8fd9-959ead68ecfc',
    keepsake: 'Polaroid Picture',
    mottoId: '6ef37fd2-b0f4-4fc8-852a-ff6cf4b9d41f',
    motto: 'Failure is the mother of success.',
  },
  {
    ref: BAY.trading,
    npcName: "Olivia 'Tout' Ortega",
    keepsakeId: 'b2c50eed-15b2-461a-8bbe-0e88a8064a30',
    keepsake: 'Butterfly Earrings',
    mottoId: '915e31d0-b796-4686-9550-b6d1d0b20a68',
    motto: 'Live and let live.',
  },
  {
    ref: BAY.med,
    npcName: "Maya 'Hale' Turner",
    keepsakeId: '996ccad4-076e-4fba-948d-012fa1e3ae12',
    keepsake: 'Leather Journal',
    mottoId: 'df6503ae-9e91-4caf-9d2b-af3d3a91f65f',
    motto: 'The grass is greener where you water it.',
  },
  {
    ref: BAY.pilot,
    npcName: "Shariq 'Hawk' Rahimi",
    keepsakeId: '4f0b6a75-252e-474a-a253-8f06b0e48c19',
    keepsake: 'Silver Pendant',
    mottoId: 'cb86391d-6013-4263-a46c-1a47434b36dd',
    motto: 'Carpe diem!',
  },
  {
    ref: BAY.armoury,
    npcName: "Paloma 'Hammer' Fane",
    keepsakeId: '9781ac99-9355-4bf8-b4f7-31180175518b',
    keepsake: 'M2 Racing Mug',
    mottoId: 'ff881e9b-344e-4cd4-83aa-48defd4132a5',
    motto: 'No job too big!',
  },
  {
    ref: BAY.cantina,
    npcName: "Jaxon 'Blazemaxer' Todd",
    keepsakeId: 'f20e995b-a503-4689-b64c-49c26f5bbadd',
    keepsake: 'Walkman',
    mottoId: '71d45c7a-2865-40c9-8ff0-cff86665c300',
    motto: 'Be kind, for everyone you meet is fighting a hard battle.',
  },
  {
    ref: BAY.storage,
    npcName: "Sofia 'Stormcrow' Costa",
    keepsakeId: '0d51ae6a-e98d-4696-bb17-52b220e4459b',
    keepsake: 'Peach Lipstick',
    mottoId: '4f73538b-dbad-474a-8303-f0c4cb1d80d2',
    motto: 'Keep it secret, keep it safe.',
  },
]

/** The Exploratory type's Wasteland Explorer NPC — Keepsake/Motto choice ids. */
const WASTELAND_KEEPSAKE_ID = '235a2a03-b2f2-4fb3-8afb-a1e87155b4c6'
const WASTELAND_MOTTO_ID = 'f0aa1340-f2a2-41a3-96b1-865afd27f25a'

const STARTER_CRAWLER: Crawler = {
  id: STARTER_CRAWLER_ID,
  schemaVersion: 1,
  name: "Crawler #430 'Tenacity'",
  description:
    'Built by its salvager pilots, the Tenacity (Crawler #430) is a quadrupedal crawler on stilt-like legs, able to explore the most rugged of terrain.',
  techLevel: 'tech-1',
  type: EXPLORATORY_TYPE_ID,
  // The Exploratory type's special NPC — the Wasteland Explorer.
  typeNpc: { npcName: "Hannah 'Trek' Lane", npcCurrentHP: 4 },
  // The Armament Bay's mounted weapon: weapon systems live in the crawler's
  // systems[] and are surfaced as Armament-Bay weapons by the crawler wizard
  // (capped at one for a non-Battle crawler). Mini Mortar is Tenacity's mount.
  systems: ['mini-mortar'],
  crawlerBays: BAY_CREW.map((c) => ({ bayRef: c.ref, npcName: c.npcName, npcCurrentHP: 4 })),
  // Keepsake/Motto for each bay NPC (keyed by bay ref) plus the Wasteland
  // Explorer (keyed by the crawler-type ref) — freeform choice selections.
  bayChoices: {
    ...Object.fromEntries(
      BAY_CREW.map((c) => [c.ref, { [c.keepsakeId]: [c.keepsake], [c.mottoId]: [c.motto] }])
    ),
    [EXPLORATORY_TYPE_ID]: {
      [WASTELAND_KEEPSAKE_ID]: ['Snowglobe'],
      [WASTELAND_MOTTO_ID]: ['The early bird gets the worm.'],
    },
  },
  gameId: null,
  createdAt: SEED_TS,
  updatedAt: SEED_TS,
}

export const STARTER_CRAWLERS: readonly Crawler[] = [STARTER_CRAWLER]

// ---------------------------------------------------------------------------
// SoftLinks — each pilot ↔ their mech (mech-to-pilot: from mech, to pilot) and
// each pilot ↔ the crawler (pilot-to-crawler: from pilot, to crawler).
// ---------------------------------------------------------------------------

export const STARTER_SOFT_LINKS: readonly SoftLink[] = CREW.flatMap(({ pilot: p, mech: m }) => [
  {
    id: `starter-link-mech-${p.id}`,
    from: { type: 'mech' as const, id: m.id },
    to: { type: 'pilot' as const, id: p.id },
    type: 'mech-to-pilot' as const,
    createdAt: SEED_TS,
  },
  {
    id: `starter-link-crew-${p.id}`,
    from: { type: 'pilot' as const, id: p.id },
    to: { type: 'crawler' as const, id: STARTER_CRAWLER_ID },
    type: 'pilot-to-crawler' as const,
    createdAt: SEED_TS,
  },
])
