type ChangelogEntry = {
  date: string
  title: string
  description: string
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    date: '2026-05-11',
    title: 'PAX, the Apis sisters, and Skinless Jim crew added',
    description:
      "Filled in named antagonists previously skipped as 'narrative-only': PAX (second boss in Relics, no statblock), Dr Mortimer Apis (Holo-Companion) and Dr Regina Apis (Queen Bee Atlas pilot) from The Hive, plus Skinless Jim, Gorgut, Ayana, and Dragonfly from Relics.",
  },
  {
    date: '2026-05-11',
    title: 'New schema: bosses',
    description:
      "Promoted The Iron Lady and CURNOS to a new `bosses` schema for mech-scale named threats. Iron Lady's Titanic Actions are now structured alongside her other actions.",
  },
  {
    date: '2026-05-11',
    title: 'Pre-made characters in catalog',
    description:
      'Added `pre-made-characters` to the Pilot catalog so the six RotW pre-made pilots are reachable from the main page.',
  },
  {
    date: '2026-05-11',
    title: 'Mobile viewport fix on schema pages',
    description: 'Schema list pages no longer overflow horizontally on mobile devices.',
  },
  {
    date: '2026-05-09',
    title: 'Pre-made character schema added',
    description:
      'Added `PreMadeCharacterSchema` and the six Reclamation of the Wastes pre-made pilots.',
  },
  {
    date: '2026-05-08',
    title: 'Reclamation of the Wastes archive complete',
    description:
      'Finished archiving the Reclamation of the Wastes supplement: chassis patterns, systems, modules, abilities, equipment, drones, creatures, bio-titans, NPCs, lances, roll tables, and 21 guides.',
  },
  {
    date: '2026-05-04',
    title: 'Asset Pack mini-adventures',
    description:
      "Added Hive, Thatcher's Mech Base, and Relics of a Time Gone By content: chassis patterns, NPCs, lances, equipment, and roll tables.",
  },
]
