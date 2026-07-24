/**
 * Regeneration manifest for the agent-readable rules digest (`docs/rules/`).
 *
 * This is the reusable knowledge that turns the source PDFs back into the
 * curated digest: for each topic doc, which source PDF + pages it covers, the
 * scope of what to write, and what to cross-link. The extraction step is
 * deterministic (`extract-rules.ts`); authoring each doc is an LLM summarization
 * + visual verification step driven from the briefs this manifest produces.
 *
 * The digest itself is NOT committed — it is condensed from copyright-bearing
 * PDFs and is gitignored (`docs/rules/`). Only this tooling lives in git, so the
 * manifest is the durable, reproducible record of what the digest covers.
 *
 * Printed page number == PDF page number for the core book (verified 1:1);
 * expansions use the PDF page (verify against the source when authoring).
 */

/** Default source PDF basename (without extension), under `rules/`. */
export const SOURCE_PDF = 'Salvage Union Digital Edition 1.2'

export type DocSpec = {
  /** Output path under docs/rules/, without `.md` (may include a subdir). */
  slug: string
  /** H1 title. */
  title: string
  /** Source citation line, e.g. "Core Rulebook pp. 232". */
  sourceLabel: string
  /** Source PDF basename under rules/ (defaults to the core book). */
  sourcePdf?: string
  /** PDF page ranges for the Read tool's `pages` param, e.g. "239-243". */
  verifyPages: string
  /** Individual page numbers whose extracted text is inlined into the brief. */
  extractPages: number[]
  /** Authoring scope: what this doc covers and how. */
  brief: string
  /** Sibling docs / data files to cross-link (never enumerate entities). */
  crossLinks: string[]
}

export const manifest: DocSpec[] = [
  {
    slug: '00-overview',
    title: 'Overview',
    sourceLabel: 'Core Rulebook pp. 9, 14–17',
    verifyPages: '9,14-17',
    extractPages: [9, 14, 15, 16, 17],
    brief:
      'Orientation: what Salvage Union is (one setting sentence, no lore), the Mediator vs Salvager Pilot roles, session shape, and the describe→act→narrate→roll-if-uncertain core loop. High level only; deep mechanics live in sibling docs.',
    crossLinks: ['01-core-mechanic.md', '06-pilots.md', '07-mechs.md', '08-crawlers.md'],
  },
  {
    slug: '01-core-mechanic',
    title: 'The Core Mechanic',
    sourceLabel: 'Core Rulebook p. 232',
    verifyPages: '232',
    extractPages: [2, 232],
    brief:
      'The single d20 roll and the exact outcome table (20 / 11–19 / 6–10 / 2–5 / 1) as a clean markdown table. Note the no-flat-modifiers rule and that SU has no advantage/disadvantage — Push is the only sanctioned re-roll.',
    crossLinks: ['03-heat-and-pushing.md', '02-actions-and-scenes.md'],
  },
  {
    slug: '02-actions-and-scenes',
    title: 'Actions & Scenes',
    sourceLabel: 'Core Rulebook pp. 235–238',
    verifyPages: '235-238',
    extractPages: [2, 235, 236, 237, 238],
    brief:
      'The action-scene turn loop: group initiative, the Move + one Turn Action budget (there is no action-point pool), the action types and timings (Reaction/Free/Turn/Short/Long/Downtime) as a table, and the four range bands (Close/Medium/Long/Far) as a table.',
    crossLinks: [
      '01-core-mechanic.md',
      '03-heat-and-pushing.md',
      'data/actions.json',
      'data/distances.json',
    ],
  },
  {
    slug: '03-heat-and-pushing',
    title: 'Heat & Pushing',
    sourceLabel: 'Core Rulebook pp. 233–234',
    verifyPages: '233-234',
    extractPages: [2, 233, 234],
    brief:
      'Heat and Heat Cap, the full Push sequence (roll → optional re-roll → resolve → +2 Heat → Heat Check → Reactor Overload on fail), the can’t-push-past-cap rule, the Heat Check triggers, and the roll-equal-or-under check (20 always succeeds).',
    crossLinks: ['01-core-mechanic.md', 'rules/heatCheck.ts', 'data/roll-tables.json'],
  },
  {
    slug: '04-attacks-and-damage',
    title: 'Attacks & Damage',
    sourceLabel: 'Core Rulebook pp. 239–243',
    verifyPages: '239-243',
    extractPages: [2, 239, 240, 241, 242, 243],
    brief:
      'Attack resolution tied to the d20 bands, SP (mech) vs HP (pilot) and the conversion (mech HP-dmg = SP/2; pilot SP-dmg = 2× HP), 0 SP → Critical Damage and 0 HP → Critical Injury, and the Intact→Damaged→Destroyed condition ladder with repair rules. Tables for the conversions and ladder.',
    crossLinks: [
      '01-core-mechanic.md',
      '05-salvaging.md',
      'rules/takeDamage.ts',
      'data/roll-tables.json',
    ],
  },
  {
    slug: '05-salvaging',
    title: 'Salvaging',
    sourceLabel: 'Core Rulebook pp. 244–251',
    verifyPages: '244-251',
    extractPages: [2, 244, 245, 246, 247, 248, 249, 250, 251],
    brief:
      'Salvage types & condition, Area Salvaging (cost, attempts = Supply, roll table), salvaging a Mech/Vehicle, Cargo Capacity, the scrap/cargo/tech-level math (1 scrap = 1 cargo; scrap value = tech level; 2×T6 = 12×T1), and salvaging abilities at a high level.',
    crossLinks: [
      '04-attacks-and-damage.md',
      '08-crawlers.md',
      'data/roll-tables.json',
      'data/tech-levels.json',
      'data/abilities.json',
    ],
  },
  {
    slug: '06-pilots',
    title: 'Pilots',
    sourceLabel: 'Core Rulebook pp. 18–23',
    verifyPages: '18-23',
    extractPages: [18, 19, 20, 21, 22, 23],
    brief:
      'Pilot creation steps and sheet structure (not a catalogue): pilot stats (HP/AP/Inventory), how Classes and ability trees work (tiers, ordering, caps), TP/training costs and prerequisites, equipment & inventory at a system level. Describe the system; point to data for the lists.',
    crossLinks: [
      '07-mechs.md',
      '02-actions-and-scenes.md',
      '04-attacks-and-damage.md',
      'data/classes.json',
      'data/abilities.json',
      'data/ability-tree-requirements.json',
      'data/equipment.json',
      'data/roll-tables.json',
    ],
  },
  {
    slug: '07-mechs',
    title: 'Mechs',
    sourceLabel: 'Core Rulebook pp. 94–99',
    verifyPages: '94-99',
    extractPages: [2, 94, 95, 96, 97, 98, 99],
    brief:
      'Mech build/assembly rules and sheet structure (not a catalogue): choosing a Chassis and fitting Systems/Modules, and a stat table defining SP, EP, Heat/Heat Cap, System Slots, Module Slots, Cargo Capacity, Tech Level, Salvage Value with meaning + constraint each. Distinguish build-time vs operating constraints.',
    crossLinks: [
      '03-heat-and-pushing.md',
      '04-attacks-and-damage.md',
      '05-salvaging.md',
      '08-crawlers.md',
      'data/chassis.json',
      'data/systems.json',
      'data/modules.json',
      'data/tech-levels.json',
    ],
  },
  {
    slug: '08-crawlers',
    title: 'Union Crawler',
    sourceLabel: 'Core Rulebook pp. 212–231',
    verifyPages: '212-231',
    extractPages: [
      212, 213, 214, 215, 216, 217, 218, 219, 220, 221, 222, 223, 224, 225, 226, 227, 228, 229, 230,
      231,
    ],
    brief:
      'The Union Crawler base: creation, sheet, Types, Upkeep & Upgrade (costs), Deterioration & Damage tables, Bays at a system level, Tech Level progression, and the Downtime Procedure (repair mechs/pilots, craft, upgrade). Tight summary of a large page range; point to data for bay/type lists.',
    crossLinks: [
      '05-salvaging.md',
      '06-pilots.md',
      '07-mechs.md',
      'data/crawlers.json',
      'data/crawler-bays.json',
      'data/crawler-tech-levels.json',
      'data/npcs.json',
      'data/squads.json',
    ],
  },
  {
    slug: '09-mediator-guide',
    title: "Mediator's Guide",
    sourceLabel: 'Core Rulebook pp. 12–13, 252–269',
    verifyPages: '12-13,252-269',
    extractPages: [
      12, 13, 252, 253, 254, 255, 256, 257, 258, 259, 260, 261, 262, 263, 264, 265, 266, 267, 268,
      269,
    ],
    brief:
      'Running the game: Safety Protocols (the safety tools), adjudicating Setbacks & Tough Choices, controlling NPCs, balancing combat, campaign design, scrap progression & placement, exploration, and the NPC Action/Reaction/Morale/Retreat tables (concrete mechanics — note the encounter-roll bands differ). Bestiary at system level only; reference, never transcribe.',
    crossLinks: [
      '00-overview.md',
      '01-core-mechanic.md',
      'data/guides.json',
      'data/roll-tables.json',
      'data/npcs.json',
      'data/bio-titans.json',
      'data/meld.json',
      'data/creatures.json',
      'data/drones.json',
      'data/vehicles.json',
    ],
  },

  // --- Expansions (adventure modules). Digest covers NEW rules subsystems
  // each adds; entities and tables are source-tagged in the data package. ---
  {
    slug: 'expansions/false-flag',
    title: 'False Flag',
    sourceLabel:
      'False Flag (expansion) — Meld Salvaging & Crafting p. 66; module guidance pp. 8–11',
    sourcePdf: 'False Flag Digital Edition 1.1',
    verifyPages: '8-11,66',
    extractPages: [8, 9, 10, 11, 66],
    brief:
      'Short module overview (adventure by Aled Lawlor & Panayiotis Lines), then the new rules it adds — chiefly Meld Salvaging & Crafting (p.66: Meld Nanites as an alternate salvage/craft chain) and reusable environmental subsystems from "How To Run This Module" (pp.8–11). Point entities (chassis/systems/modules/equipment) and tables to the data package, filterable by source "False Flag". Exclude scenario/region narrative.',
    crossLinks: ['../05-salvaging.md', '../09-mediator-guide.md', 'data/roll-tables.json'],
  },
  {
    slug: 'expansions/we-were-here-first',
    title: 'We Were Here First',
    sourceLabel: 'We Were Here First (expansion) — Chimerium pp. 9–11, 58–59; meteors pp. 8–9',
    sourcePdf: 'We Were Here First Digital Edition 1.1',
    verifyPages: '8-12,58-59',
    extractPages: [8, 9, 10, 11, 12, 58, 59],
    brief:
      'Short module overview (adventure by Diogo Nogueira), then the new subsystems: Chimerium (harvesting, the Exposure mechanic/table, Mutation, and the opt-in Chimerium Mutant ability tree) and meteor encounters (the Chimerid Meteor shower as a ~10–20 week campaign clock). Link the source-tagged WWHF roll tables; exclude scenario/region narrative.',
    crossLinks: [
      '../05-salvaging.md',
      '../06-pilots.md',
      '../09-mediator-guide.md',
      'data/roll-tables.json',
    ],
  },
  {
    slug: 'expansions/rainmaker',
    title: 'Rainmaker',
    sourceLabel: 'Rainmaker (expansion) — content module, no new core rules',
    sourcePdf: 'Rainmaker Digital Edition 1.1',
    verifyPages: '6-10',
    extractPages: [6, 7, 8, 9, 10],
    brief:
      'Short module overview (adventure by Luke Gearing). Rainmaker adds essentially no new connective rules — it is content-only (new Chassis incl. the named "Titan" mechs Ravager/Agares/Black Dragon/Paladin/Cerberus, new Bio-Titans Apophis/Physalis/Genbu, new Systems/Modules/Equipment), all source-tagged in the data. Keep the doc short: overview + entity pointers + any genuinely-new rule found. Do not invent data; flag gaps. Exclude scenario narrative.',
    crossLinks: ['../07-mechs.md', '../09-mediator-guide.md'],
  },
]
