type ChangelogEntry = {
  date: string
  title: string
  description: string
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    date: '2026-05-11',
    title: 'Salvage Union Starter Set archived',
    description:
      "Reclamation of the Wastes and the Asset Pack mini-adventures (Hive, Thatcher's Mech Base, Relics of a Time Gone By) are now reachable: chassis patterns, systems, modules, abilities, equipment, drones, creatures, titans (monsters and bosses), NPCs with unique statblocks, lances, roll tables, and guides. New schemas: `titans` (replaces `bio-titans`; consolidates monster-class and boss-class mech-scale enemies, including Iron Lady) and `pre-made-characters` (six RotW pilots). Mobile schema list pages no longer overflow horizontally.",
  },
]
