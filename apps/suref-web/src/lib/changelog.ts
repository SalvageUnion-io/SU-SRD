type ChangelogEntry = {
  date: string
  title: string
  items: string[]
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    date: '2026-06-11',
    title: 'Vehicles read as actions, not installable systems',
    items: [
      'Conventional vehicles now list their loadout — weapons and locomotion — as actions, the way their statblocks read, rather than as installable Mech Systems.',
      "The Power Loader's rigging arm now shows its own melee profile (Close, 1 SP), distinct from the mech utility arm, and two placeholder systems (Integrated Amphibious Locomotion System and Shanty Home) were folded into the vehicles that use them.",
    ],
  },
  {
    date: '2026-06-09',
    title: 'Expansion crawler bays added',
    items: [
      'Four expansion / found Crawler bays now appear in the reference: the Bio-Mech Bay and Bio-Crafting Bay (We Were Here First!), the Nanite Processing Bay (False Flag), and the VR Tubes (Rainmaker).',
      'Unlike the core fixed facilities, these are player-addable upgrade bays — each shows its build cost (Scrap and/or Bio-Salvage), tech level, or salvage value instead of a crew member and damaged effect.',
    ],
  },
  {
    date: '2026-06-04',
    title: 'Bio-Titans restored; Iron Lady reclassified',
    items: [
      'The Titans schema is once again Bio-Titans, and each Bio-Titan now shows its bio-salvage value (equal to its Structure Points).',
      'The Iron Lady — an android, not a Bio-Titan — now lives under Drones with a salvage value, while keeping her Titanic Actions and equipped Mech Modules.',
    ],
  },
  {
    date: '2026-06-03',
    title: 'Mobile fix for guide entity grids',
    items: [
      'Side-by-side entity cards in guides (e.g. the Base Classes and abilities on Create a Pilot) now stack into a single column on mobile instead of overflowing off the right edge, and still show two balanced columns on wider screens.',
    ],
  },
  {
    date: '2026-06-01',
    title: 'Site restyle + interactive equipment customisation',
    items: [
      "New Salvage Union 'Cargo' brand header with a breadcrumb description sub-bar that surfaces each schema's description as you browse.",
      'Refreshed entity-card and typography styling across the SRD, and the old landing-page hero has been removed.',
      'Pilot equipment with player choices (weapon type, modifications) now shows an interactive customisation panel — toggle options to watch the damage, range, and traits update live.',
    ],
  },
  {
    date: '2026-05-12',
    title: 'Iron Lady modules + custom expansion themes',
    items: [
      'Iron Lady (titans) now lists its equipped Mech Modules — Comms Module, IR Night Vision Optics, Firewall — as compact entries you can click through.',
      'Titans schema accepts optional `systems` and `modules` arrays; both render as compact cards beneath the titan actions.',
      "New custom themes for Reclamation of the Wastes (wind-blown dust), The Hive (honeycomb mesh), Thatcher's Mech Base (industrial steel grate), and Relics of a Time Gone By (weathered parchment).",
      'Changelog entries are now rendered as readable bullet lists instead of paragraphs.',
      'API page documents that appending `.json` to any schema or item URL returns the raw data.',
    ],
  },
  {
    date: '2026-05-11',
    title: 'Salvage Union Starter Set archived',
    items: [
      "Reclamation of the Wastes and the Asset Pack mini-adventures (Hive, Thatcher's Mech Base, Relics of a Time Gone By) are now reachable: chassis patterns, systems, modules, abilities, equipment, drones, creatures, titans (monsters and bosses), NPCs with unique statblocks, lances, and roll tables.",
      'New `titans` schema (replaces `bio-titans`) consolidates monster-class and boss-class mech-scale enemies, including Iron Lady.',
      'Mobile schema list pages no longer overflow horizontally.',
    ],
  },
]
