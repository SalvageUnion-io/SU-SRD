type ChangelogEntry = {
  date: string
  title: string
  items: string[]
}

export const CHANGELOG: ChangelogEntry[] = [
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
