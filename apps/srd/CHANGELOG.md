# Changelog

Maintained by release-please. Older entries below predate automation.

## [1.1.0](https://github.com/SalvageUnion-io/SU-SRD/compare/srd-v1.0.0...srd-v1.1.0) (2026-07-23)


### Features

* **srd:** chassis patterns get their own pages, roll tables render again ([#518](https://github.com/SalvageUnion-io/SU-SRD/issues/518)) ([02824e9](https://github.com/SalvageUnion-io/SU-SRD/commit/02824e9767d0865f8371ee856995ad1644089cf0))

## 2026-07-14 — Support the project on Ko-fi

* The About page now has a Ko-fi support link, so you can chip in toward hosting and development.

## 2026-07-14 — Chassis patterns open their loadout again

* Clicking a pattern on a chassis page now opens its pattern-specific systems and modules in a modal, instead of re-opening the chassis page in a new tab.

## 2026-07-13 — Filter abilities by tree

* The Abilities listing now has a Tree filter, so you can narrow abilities down to a specific ability tree (e.g. Hacking, Ranger, Legendary Soldier). Like the other filters, the selection is shareable via the page URL.

## 2026-07-13 — Simpler entity pages

* Removed the Previous/Next paging links from entity pages — use search or the category listing to move between entities.

## 2026-07-13 — Bot Terms & Privacy moved to the Discord page

* The bot's Terms of Service and Privacy Policy links now live at the bottom of the Discord page instead of in the site footer.

## 2026-07-09 — Link to the character builder

* The top bar now has a BUILDER link out to In The Union Now — the no-account character builder & game manager — so you can jump straight from the reference to building pilots, mechs, and crawlers.

## 2026-07-09 — Faster page loads

* Entity and category pages now download only the reference data they actually need, instead of the entire dataset — item and listing pages load noticeably faster, especially on slower connections.
* Search now runs against a small pre-built index instead of downloading the full dataset, so search starts working faster the first time you use it.

## 2026-07-06 — Discord bot Terms & Privacy pages

* Added Terms of Service and Privacy Policy pages for the Salvage Union Discord bot, linked from the site footer.

## 2026-07-04 — First-class search and shareable filtered views

* A dedicated search page shows the full, uncapped list of matches (press Enter in the search box, or open it directly at /search?q=…) with type filters to narrow by category.
* On phones, a search button now sits right in the top bar — no need to open the menu first.
* Filtered listing views are now bookmarkable and shareable: your Tech Level, Source, and name filters live in the URL and survive back-navigation.
* Entity pages gained Previous/Next links to page through the rest of their category.

## 2026-07-04 — No more text flash when opening an entity

* Opening a chassis, system, ability, or any other entity no longer briefly flashes an unstyled text-only version before the full card appears — the styled card (or its loading skeleton) is what you see from the first paint.

## 2026-07-03 — Discord bot: install page and the /su command

* New Discord page (in the nav) with a one-click install button and a reference for using the bot at your table.
* Bot commands now live under a single /su namespace — /su roll and /su lookup — so they no longer collide with other bots' /roll in the command picker.

## 2026-07-03 — 55 community Mech Monday patterns

* Seven chassis — Mule, Scrapper, Thresher, Spectrum, Mazona, Goliath, and Bobcat — now carry the community-designed patterns from Leyline Press's official Mech Monday compilations: 55 new patterns in all, each transcribed from the published cards.
* A handful of cards that reference homebrew or ambiguous items were left out rather than guessed at.

## 2026-07-03 — Builder: safer data, session drafts, printable sheets

* Wizard progress survives refreshes and accidental taps — pilot/mech/crawler builds save a session draft as you go, and Cancel asks before discarding changes.
* Scrapping a mech, moving cargo, and salvage deposits now apply all-or-nothing, so scrap value can no longer duplicate or vanish if something goes wrong mid-action.
* Every sheet has a Print action with a clean paper layout (pips and current stats included) — use "Save as PDF" in the print dialog for a PDF copy.
* Snapshot sharing renders a real scannable QR code, and internal links no longer trigger full page reloads on crawler pages.

## 2026-07-03 — Discord bot: /lookup and full table coverage

* New /lookup command searches every entity type — chassis, systems, modules, equipment, keywords, and more — with autocomplete and a link to the entity's SRD page.
* Both "Salvage Cache Table" roll tables are now individually rollable (one previously shadowed the other), and slash commands re-register automatically on every deploy.

## 2026-07-03 — Builder: live-play rules controls across every sheet

* Mech sheets gained Take Damage (with the Critical Damage table), Heat Check escalation, Salvage rolls, Scrap-this-Mech, and per-item condition tracking; pilot sheets take damage and injuries; crawler sheets run the full economy — upkeep, upgrades, and trade.
* A Downtime control walks the between-mission steps (repairs, healing, training, crafting), and a floating quick-roll button rolls any table from anywhere.
* GMs get an encounter tray: track reference NPCs with live HP/SP and roll on the Mediator tables.
* Global search (Cmd+K) finds any rule or entity from anywhere in the builder.

## 2026-07-02 — Shadowed table restored, smarter search, tidier sitemap

* The two "Salvage Cache Table" roll tables (We Were Here First! and Reclamation of the Wastes) shared one URL, so only the first was reachable — they are now disambiguated by source and both have their own page.
* Search understands multi-word queries: "heavy laser" now finds Heavy Laser instead of returning nothing, with word-prefix matching and better ranking.
* Removed 712 orphaned internal pages (inline-only entries like raw actions) from the sitemap and breadcrumbs — every indexed page now has a working parent listing.

## 2026-06-29 — Builder: smarter mech & crawler building

* Installed Heat Sinks, Capacitance Banks, cargo holds and similar passives now raise your mech's maximum Heat/EP/SP/Cargo automatically.
* The mech loadout supports duplicate systems and modules (two Heat Sinks are two Heat Sinks), with per-item Add buttons, installed counts, and remove-one controls, plus Bio and Nanite tiers in the tech filter.
* New crawlers seed only their base bays — the three expansion bays (Bio Bays, Nanite Processing Bay, VR Tubes) are add-ons you install — and crawler system capacity follows the crawler type.

## 2026-06-29 — "View details" opens the full entity page

* Clicking "View details" on a nested entity (chassis pattern, formation member, integrated system, ability) now opens that entity's own page in a new tab instead of a modal, so you can read it alongside the original and link straight to it.

## 2026-06-29 — Link previews now mirror the entity card exactly

* The preview image shown when you share an entity link is now a 1:1 render of the actual entity display card — the same header, stats, traits, and styling you see on the page — instead of a separately-designed preview.

## 2026-06-24 — Faster, lighter artwork

* All entity artwork now serves as WebP from a dedicated asset store — noticeably smaller downloads on art-heavy pages, with the about-page map shrunk to a fraction of its old size.

## 2026-06-24 — Non-advanceable classes call it out

* Classes that cannot advance to a hybrid class now show a "Non-Advanceable" tag, instead of silently omitting the "Advanceable" label and leaving it ambiguous.

## 2026-06-23 — Steadier catalog grid on load

* Fixed a hydration mismatch on catalog (/schema) pages where the masonry grid rendered one column on the server but two or three in the browser, throwing a React error and forcing the whole grid to re-render on tablet and desktop widths.

## 2026-06-21 — Branded link previews for every entity

* Sharing a link to any chassis, system, ability, creature (or any other entity) now shows a branded Salvage Union preview card — the entity name, tech level, key stats, traits, and source — instead of a generic banner. Generated at build time for all entity pages.

## 2026-06-17 — Small data & display fixes

* The "Legal Starting Pattern" badge is driven by each pattern's data tag instead of being computed, fixing patterns that were mislabeled.
* The Adv. Epoxy Applicator's self-action now bubbles up correctly, and entities whose stats live on a matching action show those stats in the resolved data row.
* First Aid Kit no longer shows a spurious 2 AP cost.

## 2026-06-15 — Fabrication Bay options restored

* The Fabrication Bay system now lists its four activation options — restore up to 15 SP, restore up to 2 EP, repair damaged Systems/Modules, or repair damaged Chassis/Vehicles. Previously the text promised "choose one of the following options" but showed none.

## 2026-06-13 — In The Union Now rebuilt — local-first, no account needed

* The character builder & game manager was rebuilt from the ground up as a local-first app: your pilots, mechs, and crawlers live in your browser (with export/import backups) — no account, no server, works offline.
* Redesigned pilot/mech/crawler wizards with auto-fill selection grids, a floating step footer, and a crawler Crew step with selectable crawler types and editable tech level.
* Share read-only snapshots of any sheet via link — the one place a server is involved, and only when you ask for it.
* The Discord bot also got steadier: it now finishes loading game data before answering commands.

## 2026-06-13 — Filters above the catalog, smoother window resizing

* Catalog filters (name, tech level, source) now sit in a bar above the results at every screen size, instead of in a left sidebar on desktop.
* The catalog grid no longer stutters when you resize the window — large schemas (chassis, abilities, equipment) stay smooth.

## 2026-06-13 — Smoother loads on catalog & entity pages

* Fixed a hydration mismatch that could make a catalog or entity page throw away the server-rendered HTML and re-render (a brief flicker) once game data finished loading.

## 2026-06-12 — Buy links on source books

* Each source book and expansion now shows a Buy button — in both the catalog listing and on its page — linking straight to the publisher's store.

## 2026-06-11 — Vehicles read as actions, not installable systems

* Conventional vehicles now list their loadout — weapons and locomotion — as actions, the way their statblocks read, rather than as installable Mech Systems.
* The Power Loader's rigging arm now shows its own melee profile (Close, 1 SP), distinct from the mech utility arm, and two placeholder systems (Integrated Amphibious Locomotion System and Shanty Home) were folded into the vehicles that use them.

## 2026-06-11 — Audit sweep: search fixes, offline support, faster pages

* Search no longer breaks if you type before game data finishes loading, Enter now jumps to the top result, and category matches no longer crowd out item hits.
* The SRD now works offline after your first visit — install it to your phone for table use on bad venue wifi.
* Every page loads ~1.3 MB less JavaScript, schema listings gained a name filter plus loading skeletons and clearer empty states, and printed pages drop the site chrome.
* Item pages link their traits and keywords directly, trait tooltips fixed for six pilot-equipment items (armor/armour mismatch), and the Salvage Cache Table now references SRD listings instead of print-book page numbers.

## 2026-06-09 — Expansion crawler bays added

* Four expansion / found Crawler bays now appear in the reference: the Bio-Mech Bay and Bio-Crafting Bay (We Were Here First!), the Nanite Processing Bay (False Flag), and the VR Tubes (Rainmaker).
* Unlike the core fixed facilities, these are player-addable upgrade bays — each shows its build cost (Scrap and/or Bio-Salvage), tech level, or salvage value instead of a crew member and damaged effect.

## 2026-06-04 — Bio-Titans restored; Iron Lady reclassified

* The Titans schema is once again Bio-Titans, and each Bio-Titan now shows its bio-salvage value (equal to its Structure Points).
* The Iron Lady — an android, not a Bio-Titan — now lives under Drones with a salvage value, while keeping her Titanic Actions and equipped Mech Modules.

## 2026-06-03 — Mobile fix for guide entity grids

* Side-by-side entity cards in guides (e.g. the Base Classes and abilities on Create a Pilot) now stack into a single column on mobile instead of overflowing off the right edge, and still show two balanced columns on wider screens.

## 2026-06-01 — Site restyle + interactive equipment customisation

* New Salvage Union 'Cargo' brand header with a breadcrumb description sub-bar that surfaces each schema's description as you browse.
* Refreshed entity-card and typography styling across the SRD, and the old landing-page hero has been removed.
* Pilot equipment with player choices (weapon type, modifications) now shows an interactive customisation panel — toggle options to watch the damage, range, and traits update live.

## 2026-05-12 — Iron Lady modules + custom expansion themes

* Iron Lady (titans) now lists its equipped Mech Modules — Comms Module, IR Night Vision Optics, Firewall — as compact entries you can click through.
* Titans schema accepts optional `systems` and `modules` arrays; both render as compact cards beneath the titan actions.
* New custom themes for Reclamation of the Wastes (wind-blown dust), The Hive (honeycomb mesh), Thatcher's Mech Base (industrial steel grate), and Relics of a Time Gone By (weathered parchment).
* Changelog entries are now rendered as readable bullet lists instead of paragraphs.
* API page documents that appending `.json` to any schema or item URL returns the raw data.

## 2026-05-11 — Salvage Union Starter Set archived

* Reclamation of the Wastes and the Asset Pack mini-adventures (Hive, Thatcher's Mech Base, Relics of a Time Gone By) are now reachable: chassis patterns, systems, modules, abilities, equipment, drones, creatures, titans (monsters and bosses), NPCs with unique statblocks, lances, and roll tables.
* New `titans` schema (replaces `bio-titans`) consolidates monster-class and boss-class mech-scale enemies, including Iron Lady.
* Mobile schema list pages no longer overflow horizontally.
