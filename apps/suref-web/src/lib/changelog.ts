type ChangelogEntry = {
  date: string
  title: string
  items: string[]
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    date: '2026-07-13',
    title: 'Filter abilities by tree',
    items: [
      'The Abilities listing now has a Tree filter, so you can narrow abilities down to a specific ability tree (e.g. Hacking, Ranger, Legendary Soldier). Like the other filters, the selection is shareable via the page URL.',
    ],
  },
  {
    date: '2026-07-13',
    title: 'Simpler entity pages',
    items: [
      'Removed the Previous/Next paging links from entity pages — use search or the category listing to move between entities.',
    ],
  },
  {
    date: '2026-07-13',
    title: 'Bot Terms & Privacy moved to the Discord page',
    items: [
      "The bot's Terms of Service and Privacy Policy links now live at the bottom of the Discord page instead of in the site footer.",
    ],
  },
  {
    date: '2026-07-09',
    title: 'Link to the character builder',
    items: [
      'The top bar now has a BUILDER link out to In The Union Now — the no-account character builder & game manager — so you can jump straight from the reference to building pilots, mechs, and crawlers.',
    ],
  },
  {
    date: '2026-07-09',
    title: 'Faster page loads',
    items: [
      'Entity and category pages now download only the reference data they actually need, instead of the entire dataset — item and listing pages load noticeably faster, especially on slower connections.',
      'Search now runs against a small pre-built index instead of downloading the full dataset, so search starts working faster the first time you use it.',
    ],
  },
  {
    date: '2026-07-06',
    title: 'Discord bot Terms & Privacy pages',
    items: [
      'Added Terms of Service and Privacy Policy pages for the Salvage Union Discord bot, linked from the site footer.',
    ],
  },
  {
    date: '2026-07-04',
    title: 'First-class search and shareable filtered views',
    items: [
      'A dedicated search page shows the full, uncapped list of matches (press Enter in the search box, or open it directly at /search?q=…) with type filters to narrow by category.',
      'On phones, a search button now sits right in the top bar — no need to open the menu first.',
      'Filtered listing views are now bookmarkable and shareable: your Tech Level, Source, and name filters live in the URL and survive back-navigation.',
      'Entity pages gained Previous/Next links to page through the rest of their category.',
    ],
  },
  {
    date: '2026-07-04',
    title: 'No more text flash when opening an entity',
    items: [
      'Opening a chassis, system, ability, or any other entity no longer briefly flashes an unstyled text-only version before the full card appears — the styled card (or its loading skeleton) is what you see from the first paint.',
    ],
  },
  {
    date: '2026-07-03',
    title: 'Discord bot: install page and the /su command',
    items: [
      'New Discord page (in the nav) with a one-click install button and a reference for using the bot at your table.',
      'Bot commands now live under a single /su namespace \u2014 /su roll and /su lookup \u2014 so they no longer collide with other bots\u2019 /roll in the command picker.',
    ],
  },
  {
    date: '2026-07-03',
    title: '55 community Mech Monday patterns',
    items: [
      'Seven chassis — Mule, Scrapper, Thresher, Spectrum, Mazona, Goliath, and Bobcat — now carry the community-designed patterns from Leyline Press\u2019s official Mech Monday compilations: 55 new patterns in all, each transcribed from the published cards.',
      'A handful of cards that reference homebrew or ambiguous items were left out rather than guessed at.',
    ],
  },
  {
    date: '2026-07-03',
    title: 'Builder: safer data, session drafts, printable sheets',
    items: [
      'Wizard progress survives refreshes and accidental taps — pilot/mech/crawler builds save a session draft as you go, and Cancel asks before discarding changes.',
      'Scrapping a mech, moving cargo, and salvage deposits now apply all-or-nothing, so scrap value can no longer duplicate or vanish if something goes wrong mid-action.',
      'Every sheet has a Print action with a clean paper layout (pips and current stats included) — use "Save as PDF" in the print dialog for a PDF copy.',
      'Snapshot sharing renders a real scannable QR code, and internal links no longer trigger full page reloads on crawler pages.',
    ],
  },
  {
    date: '2026-07-03',
    title: 'Discord bot: /lookup and full table coverage',
    items: [
      'New /lookup command searches every entity type — chassis, systems, modules, equipment, keywords, and more — with autocomplete and a link to the entity\u2019s SRD page.',
      'Both "Salvage Cache Table" roll tables are now individually rollable (one previously shadowed the other), and slash commands re-register automatically on every deploy.',
    ],
  },
  {
    date: '2026-07-03',
    title: 'Builder: live-play rules controls across every sheet',
    items: [
      'Mech sheets gained Take Damage (with the Critical Damage table), Heat Check escalation, Salvage rolls, Scrap-this-Mech, and per-item condition tracking; pilot sheets take damage and injuries; crawler sheets run the full economy — upkeep, upgrades, and trade.',
      'A Downtime control walks the between-mission steps (repairs, healing, training, crafting), and a floating quick-roll button rolls any table from anywhere.',
      'GMs get an encounter tray: track reference NPCs with live HP/SP and roll on the Mediator tables.',
      'Global search (Cmd+K) finds any rule or entity from anywhere in the builder.',
    ],
  },
  {
    date: '2026-07-02',
    title: 'Shadowed table restored, smarter search, tidier sitemap',
    items: [
      'The two "Salvage Cache Table" roll tables (We Were Here First! and Reclamation of the Wastes) shared one URL, so only the first was reachable — they are now disambiguated by source and both have their own page.',
      'Search understands multi-word queries: "heavy laser" now finds Heavy Laser instead of returning nothing, with word-prefix matching and better ranking.',
      'Removed 712 orphaned internal pages (inline-only entries like raw actions) from the sitemap and breadcrumbs — every indexed page now has a working parent listing.',
    ],
  },
  {
    date: '2026-06-29',
    title: 'Builder: smarter mech & crawler building',
    items: [
      'Installed Heat Sinks, Capacitance Banks, cargo holds and similar passives now raise your mech\u2019s maximum Heat/EP/SP/Cargo automatically.',
      'The mech loadout supports duplicate systems and modules (two Heat Sinks are two Heat Sinks), with per-item Add buttons, installed counts, and remove-one controls, plus Bio and Nanite tiers in the tech filter.',
      'New crawlers seed only their base bays — the three expansion bays (Bio Bays, Nanite Processing Bay, VR Tubes) are add-ons you install — and crawler system capacity follows the crawler type.',
    ],
  },
  {
    date: '2026-06-29',
    title: '"View details" opens the full entity page',
    items: [
      'Clicking "View details" on a nested entity (chassis pattern, formation member, integrated system, ability) now opens that entity\'s own page in a new tab instead of a modal, so you can read it alongside the original and link straight to it.',
    ],
  },
  {
    date: '2026-06-29',
    title: 'Link previews now mirror the entity card exactly',
    items: [
      'The preview image shown when you share an entity link is now a 1:1 render of the actual entity display card — the same header, stats, traits, and styling you see on the page — instead of a separately-designed preview.',
    ],
  },
  {
    date: '2026-06-24',
    title: 'Faster, lighter artwork',
    items: [
      'All entity artwork now serves as WebP from a dedicated asset store — noticeably smaller downloads on art-heavy pages, with the about-page map shrunk to a fraction of its old size.',
    ],
  },
  {
    date: '2026-06-24',
    title: 'Non-advanceable classes call it out',
    items: [
      'Classes that cannot advance to a hybrid class now show a "Non-Advanceable" tag, instead of silently omitting the "Advanceable" label and leaving it ambiguous.',
    ],
  },
  {
    date: '2026-06-23',
    title: 'Steadier catalog grid on load',
    items: [
      'Fixed a hydration mismatch on catalog (/schema) pages where the masonry grid rendered one column on the server but two or three in the browser, throwing a React error and forcing the whole grid to re-render on tablet and desktop widths.',
    ],
  },
  {
    date: '2026-06-21',
    title: 'Branded link previews for every entity',
    items: [
      'Sharing a link to any chassis, system, ability, creature (or any other entity) now shows a branded Salvage Union preview card — the entity name, tech level, key stats, traits, and source — instead of a generic banner. Generated at build time for all entity pages.',
    ],
  },
  {
    date: '2026-06-17',
    title: 'Small data & display fixes',
    items: [
      'The "Legal Starting Pattern" badge is driven by each pattern\u2019s data tag instead of being computed, fixing patterns that were mislabeled.',
      'The Adv. Epoxy Applicator\u2019s self-action now bubbles up correctly, and entities whose stats live on a matching action show those stats in the resolved data row.',
      'First Aid Kit no longer shows a spurious 2 AP cost.',
    ],
  },
  {
    date: '2026-06-15',
    title: 'Fabrication Bay options restored',
    items: [
      'The Fabrication Bay system now lists its four activation options — restore up to 15 SP, restore up to 2 EP, repair damaged Systems/Modules, or repair damaged Chassis/Vehicles. Previously the text promised "choose one of the following options" but showed none.',
    ],
  },
  {
    date: '2026-06-13',
    title: 'In The Union Now rebuilt — local-first, no account needed',
    items: [
      'The character builder & game manager was rebuilt from the ground up as a local-first app: your pilots, mechs, and crawlers live in your browser (with export/import backups) — no account, no server, works offline.',
      'Redesigned pilot/mech/crawler wizards with auto-fill selection grids, a floating step footer, and a crawler Crew step with selectable crawler types and editable tech level.',
      'Share read-only snapshots of any sheet via link — the one place a server is involved, and only when you ask for it.',
      'The Discord bot also got steadier: it now finishes loading game data before answering commands.',
    ],
  },
  {
    date: '2026-06-13',
    title: 'Filters above the catalog, smoother window resizing',
    items: [
      'Catalog filters (name, tech level, source) now sit in a bar above the results at every screen size, instead of in a left sidebar on desktop.',
      'The catalog grid no longer stutters when you resize the window — large schemas (chassis, abilities, equipment) stay smooth.',
    ],
  },
  {
    date: '2026-06-13',
    title: 'Smoother loads on catalog & entity pages',
    items: [
      'Fixed a hydration mismatch that could make a catalog or entity page throw away the server-rendered HTML and re-render (a brief flicker) once game data finished loading.',
    ],
  },
  {
    date: '2026-06-12',
    title: 'Buy links on source books',
    items: [
      "Each source book and expansion now shows a Buy button — in both the catalog listing and on its page — linking straight to the publisher's store.",
    ],
  },
  {
    date: '2026-06-11',
    title: 'Vehicles read as actions, not installable systems',
    items: [
      'Conventional vehicles now list their loadout — weapons and locomotion — as actions, the way their statblocks read, rather than as installable Mech Systems.',
      "The Power Loader's rigging arm now shows its own melee profile (Close, 1 SP), distinct from the mech utility arm, and two placeholder systems (Integrated Amphibious Locomotion System and Shanty Home) were folded into the vehicles that use them.",
    ],
  },
  {
    date: '2026-06-11',
    title: 'Audit sweep: search fixes, offline support, faster pages',
    items: [
      'Search no longer breaks if you type before game data finishes loading, Enter now jumps to the top result, and category matches no longer crowd out item hits.',
      'The SRD now works offline after your first visit — install it to your phone for table use on bad venue wifi.',
      'Every page loads ~1.3 MB less JavaScript, schema listings gained a name filter plus loading skeletons and clearer empty states, and printed pages drop the site chrome.',
      'Item pages link their traits and keywords directly, trait tooltips fixed for six pilot-equipment items (armor/armour mismatch), and the Salvage Cache Table now references SRD listings instead of print-book page numbers.',
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
