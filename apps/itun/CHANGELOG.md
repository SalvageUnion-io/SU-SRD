# Changelog

Maintained by release-please (see ADR-024).

## [1.11.1](https://github.com/SalvageUnion-io/SU-SRD/compare/itun-v1.11.0...itun-v1.11.1) (2026-08-19)


### Bug Fixes

* three cutover-blocking defects found by running the deploy ([#856](https://github.com/SalvageUnion-io/SU-SRD/issues/856)) ([69862e8](https://github.com/SalvageUnion-io/SU-SRD/commit/69862e803234846f0ca06b8fcb2ac24a663f153f))

## [1.11.0](https://github.com/SalvageUnion-io/SU-SRD/compare/itun-v1.10.0...itun-v1.11.0) (2026-08-19)


### Features

* snapshot write freeze, the five custom domains, and a P7 runbook built on measured DNS ([#854](https://github.com/SalvageUnion-io/SU-SRD/issues/854)) ([f4f6326](https://github.com/SalvageUnion-io/SU-SRD/commit/f4f6326f45db872f86be8af39d09c957eff303fb))

## [1.10.0](https://github.com/SalvageUnion-io/SU-SRD/compare/itun-v1.9.0...itun-v1.10.0) (2026-08-19)


### Features

* all three web surfaces on Cloudflare Workers (P4) ([#852](https://github.com/SalvageUnion-io/SU-SRD/issues/852)) ([1e66485](https://github.com/SalvageUnion-io/SU-SRD/commit/1e66485a74d63d381815aff777682ae2af2234ca))

## [1.9.0](https://github.com/SalvageUnion-io/SU-SRD/compare/itun-v1.8.0...itun-v1.9.0) (2026-08-18)


### Features

* **itun:** R2 SnapshotStorage and one contract for all three backends (P3) ([#846](https://github.com/SalvageUnion-io/SU-SRD/issues/846)) ([833f6d3](https://github.com/SalvageUnion-io/SU-SRD/commit/833f6d3d4babddbe1217711e4c009f257d7db19e))

## [1.8.0](https://github.com/SalvageUnion-io/SU-SRD/compare/itun-v1.7.3...itun-v1.8.0) (2026-08-16)


### Features

* **apps:** load the package stylesheet, layered below Tailwind's utilities ([#816](https://github.com/SalvageUnion-io/SU-SRD/issues/816)) ([2eb54ba](https://github.com/SalvageUnion-io/SU-SRD/commit/2eb54ba0ddb00c7e66509a7b1f8e2ca1baffddc1))
* **component-lib:** move Button and buttonVariants onto .su-btn class names ([#823](https://github.com/SalvageUnion-io/SU-SRD/issues/823)) ([855cc3c](https://github.com/SalvageUnion-io/SU-SRD/commit/855cc3c68a79c63c719cbcce5642e16e60ebb7b3))


### Bug Fixes

* break two import cycles and ratchet the card's size ([#784](https://github.com/SalvageUnion-io/SU-SRD/issues/784)) ([3a0192f](https://github.com/SalvageUnion-io/SU-SRD/commit/3a0192f170d8e96b7f9102e6a99f074e9b6095a5))
* define "an unset pool means full" once, and enforce it ([#780](https://github.com/SalvageUnion-io/SU-SRD/issues/780)) ([5269c60](https://github.com/SalvageUnion-io/SU-SRD/commit/5269c607294a008ce18b9696c222fa7b679753a1))
* **deps:** declare three packages the workspaces import but never listed ([#777](https://github.com/SalvageUnion-io/SU-SRD/issues/777)) ([250af17](https://github.com/SalvageUnion-io/SU-SRD/commit/250af1788ef35a863ef65ae9d848be96c038df98))
* give the SRD route grammar one owner ([#768](https://github.com/SalvageUnion-io/SU-SRD/issues/768)) ([19902db](https://github.com/SalvageUnion-io/SU-SRD/commit/19902dbfdde30543ca7b77b3d41291267b59f880))
* **itun:** bound the Downtime step index, per the book ([#785](https://github.com/SalvageUnion-io/SU-SRD/issues/785)) ([c9cca8d](https://github.com/SalvageUnion-io/SU-SRD/commit/c9cca8dd18deb05f482c94b76a6f552e8f42a3a6))
* **itun:** redirect the retired /sheet/:kind/:id/share URL to the live sheet ([#797](https://github.com/SalvageUnion-io/SU-SRD/issues/797)) ([a4e9beb](https://github.com/SalvageUnion-io/SU-SRD/commit/a4e9bebb88457f2f72502af625450ad99870cc47))
* **itun:** repair the nightly E2E locator and name the rail's View links ([#771](https://github.com/SalvageUnion-io/SU-SRD/issues/771)) ([1ce5759](https://github.com/SalvageUnion-io/SU-SRD/commit/1ce575977d775d6944a4b8b0ca333204612f8ebb))
* **itun:** retry a transient 502 on the idempotent snapshot calls ([#791](https://github.com/SalvageUnion-io/SU-SRD/issues/791)) ([f124464](https://github.com/SalvageUnion-io/SU-SRD/commit/f124464d05130d309d2cfa8ea1b9895ba002fc71))
* **itun:** round field-repair cost down, per the book ([#779](https://github.com/SalvageUnion-io/SU-SRD/issues/779)) ([fa5c47b](https://github.com/SalvageUnion-io/SU-SRD/commit/fa5c47be5951b41538512462680f3409c29ae159))
* **itun:** unbreak every snapshot Function — sharing has been 502ing since [#781](https://github.com/SalvageUnion-io/SU-SRD/issues/781) ([#788](https://github.com/SalvageUnion-io/SU-SRD/issues/788)) ([1476ded](https://github.com/SalvageUnion-io/SU-SRD/commit/1476ded401efc2fc5102c0053eb47440adbe3909))
* **itun:** unbreak sharing — a duplicate zip entry was replacing the handler ([#795](https://github.com/SalvageUnion-io/SU-SRD/issues/795)) ([6dc5859](https://github.com/SalvageUnion-io/SU-SRD/commit/6dc58593d396c7ca96077abd0bc074e336c7a116))
* **tools:** check the docs a contributor actually reads first ([#782](https://github.com/SalvageUnion-io/SU-SRD/issues/782)) ([d0a4d22](https://github.com/SalvageUnion-io/SU-SRD/commit/d0a4d22d1325758ab6cde1a410236ed28b26a7aa))

## [1.7.3](https://github.com/SalvageUnion-io/SU-SRD/compare/itun-v1.7.2...itun-v1.7.3) (2026-08-14)


### Bug Fixes

* **itun:** drop redundant EP/Heat/AP cost figures from sheet card footers ([#763](https://github.com/SalvageUnion-io/SU-SRD/issues/763)) ([a181ccb](https://github.com/SalvageUnion-io/SU-SRD/commit/a181ccbccb20df62fdc1bf29cce893ce874a8854))

## [1.7.2](https://github.com/SalvageUnion-io/SU-SRD/compare/itun-v1.7.1...itun-v1.7.2) (2026-08-14)


### Bug Fixes

* **itun:** drop redundant "View in SRD" link and Slots figure from sheet card footers ([#761](https://github.com/SalvageUnion-io/SU-SRD/issues/761)) ([79c3ad1](https://github.com/SalvageUnion-io/SU-SRD/commit/79c3ad17df4bf5ecd714a66b329148c382a951c3))

## [1.7.1](https://github.com/SalvageUnion-io/SU-SRD/compare/itun-v1.7.0...itun-v1.7.1) (2026-08-14)


### Bug Fixes

* **itun:** stop share links needing five refreshes after a deploy ([#759](https://github.com/SalvageUnion-io/SU-SRD/issues/759)) ([21bd580](https://github.com/SalvageUnion-io/SU-SRD/commit/21bd5808b8a415518197bfc8a42cd3e8cab60fc6))

## [1.7.0](https://github.com/SalvageUnion-io/SU-SRD/compare/itun-v1.6.0...itun-v1.7.0) (2026-08-13)


### Features

* **itun:** public read-only sheets, and a Discord link that isn't a 404 ([#755](https://github.com/SalvageUnion-io/SU-SRD/issues/755)) ([28fedf3](https://github.com/SalvageUnion-io/SU-SRD/commit/28fedf31e12f9ca4e617bbb299152bd329a79714))

## [1.6.0](https://github.com/SalvageUnion-io/SU-SRD/compare/itun-v1.5.1...itun-v1.6.0) (2026-08-13)


### Features

* **bot:** fold the live sheet into /su sheet, and unbreak its links ([#753](https://github.com/SalvageUnion-io/SU-SRD/issues/753)) ([cd1b38c](https://github.com/SalvageUnion-io/SU-SRD/commit/cd1b38c36ae86ba2881632a8e3c6ded98b12a800))

## [1.5.1](https://github.com/SalvageUnion-io/SU-SRD/compare/itun-v1.5.0...itun-v1.5.1) (2026-08-13)


### Bug Fixes

* **itun:** stop printed sheets losing the pilot class, mech chassis and crawler type ([#750](https://github.com/SalvageUnion-io/SU-SRD/issues/750)) ([8fed0eb](https://github.com/SalvageUnion-io/SU-SRD/commit/8fed0eb7b836759fc085d219f869689398357d34))

## [1.5.0](https://github.com/SalvageUnion-io/SU-SRD/compare/itun-v1.4.1...itun-v1.5.0) (2026-08-11)


### Features

* **deps:** hoist shared versions into a workspace catalog ([#743](https://github.com/SalvageUnion-io/SU-SRD/issues/743)) ([e944fc5](https://github.com/SalvageUnion-io/SU-SRD/commit/e944fc5b905cc5a2790e76fc9885eafe4c5817f2))

## [1.4.1](https://github.com/SalvageUnion-io/SU-SRD/compare/itun-v1.4.0...itun-v1.4.1) (2026-08-10)


### Bug Fixes

* **itun:** make a stale Convex backend impossible to ship silently ([#729](https://github.com/SalvageUnion-io/SU-SRD/issues/729)) ([64bb2c5](https://github.com/SalvageUnion-io/SU-SRD/commit/64bb2c5e38d028a1d22d48d8c2eee5bce92ea4e4))

## [1.4.0](https://github.com/SalvageUnion-io/SU-SRD/compare/itun-v1.3.0...itun-v1.4.0) (2026-08-08)


### Features

* **itun:** represent hybrid pilot classes ([#714](https://github.com/SalvageUnion-io/SU-SRD/issues/714)) ([d547a89](https://github.com/SalvageUnion-io/SU-SRD/commit/d547a8956b179a7e832cc3c71bc7d5d4872eaec6))

## [1.3.0](https://github.com/SalvageUnion-io/SU-SRD/compare/itun-v1.2.0...itun-v1.3.0) (2026-08-08)


### Features

* **itun:** a mech's drones are granted, live, and tied to their chassis ([#715](https://github.com/SalvageUnion-io/SU-SRD/issues/715)) ([f4c6ca1](https://github.com/SalvageUnion-io/SU-SRD/commit/f4c6ca187b0f9ce13077cd5eb06b7e11296987ab))

## [1.2.0](https://github.com/SalvageUnion-io/SU-SRD/compare/itun-v1.1.0...itun-v1.2.0) (2026-08-07)


### Features

* **about:** add a Special Thanks section to both about pages ([#716](https://github.com/SalvageUnion-io/SU-SRD/issues/716)) ([92d5cd8](https://github.com/SalvageUnion-io/SU-SRD/commit/92d5cd893669d5b50bd576fcb3a11e9ce27bc31d))

## [1.1.0](https://github.com/SalvageUnion-io/SU-SRD/compare/itun-v1.0.3...itun-v1.1.0) (2026-08-06)


### Features

* **itun:** copy an entity to your shelf, and stop calling a shelved build unclaimed ([#711](https://github.com/SalvageUnion-io/SU-SRD/issues/711)) ([aaa1879](https://github.com/SalvageUnion-io/SU-SRD/commit/aaa187915b2c6c63c178ae3e0beb2f5cd9940f88))

## [1.0.3](https://github.com/SalvageUnion-io/SU-SRD/compare/itun-v1.0.2...itun-v1.0.3) (2026-08-06)


### Bug Fixes

* **itun:** give every seeded Starter Set row its own UUID ([#707](https://github.com/SalvageUnion-io/SU-SRD/issues/707)) ([1333308](https://github.com/SalvageUnion-io/SU-SRD/commit/1333308a9edfddc54d44ab3311d8f3de8ab61d27))

## [1.0.2](https://github.com/SalvageUnion-io/SU-SRD/compare/itun-v1.0.1...itun-v1.0.2) (2026-08-06)


### Bug Fixes

* **itun:** stop game entities silently desyncing, and give the game roster its missing verbs ([#705](https://github.com/SalvageUnion-io/SU-SRD/issues/705)) ([091b5fe](https://github.com/SalvageUnion-io/SU-SRD/commit/091b5fe6780c6bc76711b13239fab9980a6a61bd))

## [1.0.1](https://github.com/SalvageUnion-io/SU-SRD/compare/itun-v1.0.0...itun-v1.0.1) (2026-08-06)


### Bug Fixes

* **itun:** stop claimLocal duplicating rosters, and let refusals say why ([#704](https://github.com/SalvageUnion-io/SU-SRD/issues/704)) ([145789d](https://github.com/SalvageUnion-io/SU-SRD/commit/145789deb765395efb1fffd1164baa057e2a6965))

## [1.0.0](https://github.com/SalvageUnion-io/SU-SRD/compare/itun-v0.10.0...itun-v1.0.0) (2026-08-05)


### ⚠ BREAKING CHANGES

* **srd:** migrate off Astro to an in-house Vite SSG ([#689](https://github.com/SalvageUnion-io/SU-SRD/issues/689))

### Features

* **itun:** read a crewmate's sheet, and stamp ownership on every crew row ([#672](https://github.com/SalvageUnion-io/SU-SRD/issues/672)) ([eb678fa](https://github.com/SalvageUnion-io/SU-SRD/commit/eb678fae47334f1d8d05663b9c4f4dfa327cea1d))
* **srd:** migrate off Astro to an in-house Vite SSG ([#689](https://github.com/SalvageUnion-io/SU-SRD/issues/689)) ([1af4019](https://github.com/SalvageUnion-io/SU-SRD/commit/1af40192f04850a99b6367cba3f36da7cfbf2252))


### Bug Fixes

* **itun:** give the Game panels a proper card header ([#678](https://github.com/SalvageUnion-io/SU-SRD/issues/678)) ([001e8af](https://github.com/SalvageUnion-io/SU-SRD/commit/001e8af4a0e9c528c26b3761a1540d4d78574978))

## [0.10.0](https://github.com/SalvageUnion-io/SU-SRD/compare/itun-v0.9.0...itun-v0.10.0) (2026-08-03)


### Features

* **discord-bot:** the bot as an authenticated ITUN Game client ([#623](https://github.com/SalvageUnion-io/SU-SRD/issues/623)) ([#653](https://github.com/SalvageUnion-io/SU-SRD/issues/653)) ([10fe183](https://github.com/SalvageUnion-io/SU-SRD/commit/10fe183a8a5a7372ec42148f2baf22d0453414df))
* **itun:** the Games lobby as a controls band over its list ([#664](https://github.com/SalvageUnion-io/SU-SRD/issues/664)) ([c45f433](https://github.com/SalvageUnion-io/SU-SRD/commit/c45f43373834d6dbedf46d8483d51104ffe1c389))

## [0.9.0](https://github.com/SalvageUnion-io/SU-SRD/compare/itun-v0.8.0...itun-v0.9.0) (2026-07-29)


### Features

* **itun:** a Game invite scheme that can be managed, carried, and gated ([#655](https://github.com/SalvageUnion-io/SU-SRD/issues/655)) ([a712b75](https://github.com/SalvageUnion-io/SU-SRD/commit/a712b753d33b4bc80256e730bbd45cdc6dbfbd44))
* **itun:** a Game's crew as a roster, and the rules for setting a table up ([#656](https://github.com/SalvageUnion-io/SU-SRD/issues/656)) ([644d133](https://github.com/SalvageUnion-io/SU-SRD/commit/644d1336506d3340dc4ac5b4d3a52a929705483a))
* **itun:** accounts, Games, and a live Mediator surface (ADR-030) ([#647](https://github.com/SalvageUnion-io/SU-SRD/issues/647)) ([eec0a7f](https://github.com/SalvageUnion-io/SU-SRD/commit/eec0a7f5dcf539198b80d7891f9518e9d4aaaeea))
* **itun:** move the account controls into the masthead ([#654](https://github.com/SalvageUnion-io/SU-SRD/issues/654)) ([b72ea0c](https://github.com/SalvageUnion-io/SU-SRD/commit/b72ea0c708c8aefeb637b2b8573d98a0a3128f79))
* **itun:** retire Workspaces in favour of Games and the Shelf ([#652](https://github.com/SalvageUnion-io/SU-SRD/issues/652)) ([ab9ca74](https://github.com/SalvageUnion-io/SU-SRD/commit/ab9ca74594356fdb0b645408d6d9bc330fcd00c9))

## [0.8.0](https://github.com/SalvageUnion-io/SU-SRD/compare/itun-v0.7.0...itun-v0.8.0) (2026-07-28)


### Features

* **itun:** a blocked Push teaches the rule instead of greying out ([#628](https://github.com/SalvageUnion-io/SU-SRD/issues/628)) ([e94e2e4](https://github.com/SalvageUnion-io/SU-SRD/commit/e94e2e43bdaa7e7b54255cf4a09e1919071f6226))
* **itun:** activated contributions with manual expiry — Squeeze It In, Hull Magnetiser ([#635](https://github.com/SalvageUnion-io/SU-SRD/issues/635)) ([9156601](https://github.com/SalvageUnion-io/SU-SRD/commit/91566017bad64f91edf32e3fd60df902c1af7c4b))
* **itun:** ADR-030 accounts & Games — Phase 0 + Phase 1 server layer ([#609](https://github.com/SalvageUnion-io/SU-SRD/issues/609)) ([813e666](https://github.com/SalvageUnion-io/SU-SRD/commit/813e666277e9580c9595a9e3547248a6cf79b8b9))
* **itun:** Downtime Restore actually writes ([#637](https://github.com/SalvageUnion-io/SU-SRD/issues/637)) ([1f0da0a](https://github.com/SalvageUnion-io/SU-SRD/commit/1f0da0aaeeb57b5a537df4f373c99b2f7b4eb1b3))
* **itun:** provision Convex backend and Discord auth scaffold ([#604](https://github.com/SalvageUnion-io/SU-SRD/issues/604)) ([0d6684a](https://github.com/SalvageUnion-io/SU-SRD/commit/0d6684a1bcbcaf9b7e2d97b9bacbbeb75d7e860d))
* **itun:** split cap overrides from manual adjustments; derivations return breakdowns ([#608](https://github.com/SalvageUnion-io/SU-SRD/issues/608)) ([7139ab8](https://github.com/SalvageUnion-io/SU-SRD/commit/7139ab86117c7751e1020f7d739db73b5aefc4a4))
* **itun:** stat provenance on frozen snapshots and partner cards ([#614](https://github.com/SalvageUnion-io/SU-SRD/issues/614)) ([285d873](https://github.com/SalvageUnion-io/SU-SRD/commit/285d8739adbfb5a8ffe48f539d97119ac4891f8f))
* **itun:** wire salvage, crafting and scrap-mech into the Dashboard ([#629](https://github.com/SalvageUnion-io/SU-SRD/issues/629)) ([83f6c2b](https://github.com/SalvageUnion-io/SU-SRD/commit/83f6c2b0788d414397b2cfd16d68699af78a283c))
* **itun:** wire stat provenance into the Live Sheets and the Dashboard ([#613](https://github.com/SalvageUnion-io/SU-SRD/issues/613)) ([fe0a5ce](https://github.com/SalvageUnion-io/SU-SRD/commit/fe0a5ceecee32fb0cc53c58350826069b63db2c3))
* **reference:** abilities can declare stat contributions — Beefcake now applies ([#615](https://github.com/SalvageUnion-io/SU-SRD/issues/615)) ([1ad2625](https://github.com/SalvageUnion-io/SU-SRD/commit/1ad2625fc1b285fda97639b4e527c9b475b4d207))


### Bug Fixes

* **itun:** Change Log truth + Composite Armour's missing +5 Max SP ([#602](https://github.com/SalvageUnion-io/SU-SRD/issues/602)) ([47f53da](https://github.com/SalvageUnion-io/SU-SRD/commit/47f53dacf7132d481c0aca3d846ba4058f041dc9))
* **itun:** spend Dashboard EP/AP/SP from the full pool, not from zero ([#626](https://github.com/SalvageUnion-io/SU-SRD/issues/626)) ([25de4d9](https://github.com/SalvageUnion-io/SU-SRD/commit/25de4d94ba14e43df17f3ce208818dbeb3c3852f))
* **observability:** point the CSP at Sentry's EU ingest region ([#607](https://github.com/SalvageUnion-io/SU-SRD/issues/607)) ([f9ccbdb](https://github.com/SalvageUnion-io/SU-SRD/commit/f9ccbdb35fbf601be67d2eccc7e6999807680d57))
* **observability:** unblock Sentry in CSP, gate the wiring, repair nightly E2E ([#601](https://github.com/SalvageUnion-io/SU-SRD/issues/601)) ([360abc8](https://github.com/SalvageUnion-io/SU-SRD/commit/360abc8ee465b7a6ebac7f591826c23357ec825b))

## [0.7.0](https://github.com/SalvageUnion-io/SU-SRD/compare/itun-v0.6.0...itun-v0.7.0) (2026-07-28)

### Features

- **component-lib:** make the roll-table title its own table picker ([#592](https://github.com/SalvageUnion-io/SU-SRD/issues/592)) ([18f315a](https://github.com/SalvageUnion-io/SU-SRD/commit/18f315ac0501f00f52db63181dbf383d66909245))
- **itun:** render partners in place, delete the partner sheet ([#590](https://github.com/SalvageUnion-io/SU-SRD/issues/590)) ([33ddccd](https://github.com/SalvageUnion-io/SU-SRD/commit/33ddccd79c6b9db417dff0384f27188d3fe0b67f))
- **itun:** render the SRD home page in the Dashboard SRD Explorer ([#593](https://github.com/SalvageUnion-io/SU-SRD/issues/593)) ([05906b6](https://github.com/SalvageUnion-io/SU-SRD/commit/05906b629fe97708f5c9faf8e638e29033e363e9))

## [0.6.0](https://github.com/SalvageUnion-io/SU-SRD/compare/itun-v0.5.0...itun-v0.6.0) (2026-07-28)

### Features

- **itun:** show the Actions deck as one catalog-tile grid, mech + pilot ([#591](https://github.com/SalvageUnion-io/SU-SRD/issues/591)) ([f8979b0](https://github.com/SalvageUnion-io/SU-SRD/commit/f8979b04b8d804c4c464bd596c0b31074d8f4769))

### Bug Fixes

- **itun:** start Heat at zero, never at capacity ([#588](https://github.com/SalvageUnion-io/SU-SRD/issues/588)) ([67cebf2](https://github.com/SalvageUnion-io/SU-SRD/commit/67cebf2901aff7bfda198e55f49c10a3f7442f3f))

## [0.5.0](https://github.com/SalvageUnion-io/SU-SRD/compare/itun-v0.4.1...itun-v0.5.0) (2026-07-25)

### Features

- **itun:** live-sheet redesign — card/slab containers, folding, and a crew-shaped crawler ([#561](https://github.com/SalvageUnion-io/SU-SRD/issues/561)) ([b180c24](https://github.com/SalvageUnion-io/SU-SRD/commit/b180c244ab7b8d8df39512ed3805b80661efc22a))
- Partner Sheets — statted drones/companions owned by a pilot or a mech ([#578](https://github.com/SalvageUnion-io/SU-SRD/issues/578)) ([7ee4d1b](https://github.com/SalvageUnion-io/SU-SRD/commit/7ee4d1b45e11d44f90da0c90dad82e08a1edca30))

## [0.4.1](https://github.com/SalvageUnion-io/SU-SRD/compare/itun-v0.4.0...itun-v0.4.1) (2026-07-24)

### Bug Fixes

- **reference:** resolve data-inspection findings — dead flags, enum, null-marker, redundant fields ([#555](https://github.com/SalvageUnion-io/SU-SRD/issues/555)) ([2658095](https://github.com/SalvageUnion-io/SU-SRD/commit/2658095793f18341538cd977d328aca98a7861cb))

## [0.4.0](https://github.com/SalvageUnion-io/SU-SRD/compare/itun-v0.3.1...itun-v0.4.0) (2026-07-24)

### Features

- **dashboard:** lay the Actions deck out as a masonry grid ([#549](https://github.com/SalvageUnion-io/SU-SRD/issues/549)) ([49fc203](https://github.com/SalvageUnion-io/SU-SRD/commit/49fc203e54bf35c0e90423544d4184981bd06a68))

### Bug Fixes

- **ci:** unbreak the nightly e2e suite, its alerting, and the routeTree drift ([#548](https://github.com/SalvageUnion-io/SU-SRD/issues/548)) ([5fd242a](https://github.com/SalvageUnion-io/SU-SRD/commit/5fd242a0aafd427ab80000f4235b6e1ee62c7712))
- **live-sheets:** black-on-black titles + Workshop Manual redesign (mockup for sign-off) ([#554](https://github.com/SalvageUnion-io/SU-SRD/issues/554)) ([cf5f3ed](https://github.com/SalvageUnion-io/SU-SRD/commit/cf5f3ed45a0127ac6b5f82966dfd6eed539e203f))

## [0.3.1](https://github.com/SalvageUnion-io/SU-SRD/compare/itun-v0.3.0...itun-v0.3.1) (2026-07-23)

### Performance Improvements

- **itun:** route-level code splitting + a PR-blocking bundle budget ([#543](https://github.com/SalvageUnion-io/SU-SRD/issues/543)) ([e75b1e9](https://github.com/SalvageUnion-io/SU-SRD/commit/e75b1e9ec427bc8c714cb3cad0efb8b9961a9fdb))

## [0.3.0](https://github.com/SalvageUnion-io/SU-SRD/compare/itun-v0.2.0...itun-v0.3.0) (2026-07-23)

### Features

- **itun:** make the mech hold and crawler Storage Bay independently usable ([#536](https://github.com/SalvageUnion-io/SU-SRD/issues/536)) ([ba911f3](https://github.com/SalvageUnion-io/SU-SRD/commit/ba911f3ad084ea411d42c46cc0f85d5a0c7f6043))

## [0.2.0](https://github.com/SalvageUnion-io/SU-SRD/compare/itun-v0.1.0...itun-v0.2.0) (2026-07-23)

### Features

- shared about-page colophon + slab section heads on the back pages ([#524](https://github.com/SalvageUnion-io/SU-SRD/issues/524)) ([652e5fc](https://github.com/SalvageUnion-io/SU-SRD/commit/652e5fcdbd107d7eb3fa422d21441924114d2b97))

### Bug Fixes

- **reference:** correct three pattern names and add two missing book patterns ([#523](https://github.com/SalvageUnion-io/SU-SRD/issues/523)) ([736b1b8](https://github.com/SalvageUnion-io/SU-SRD/commit/736b1b8a04736215f63e0eca7831214f290d91ca))
- **reference:** give every mech pattern its own verified source + page ([#529](https://github.com/SalvageUnion-io/SU-SRD/issues/529)) ([578a12f](https://github.com/SalvageUnion-io/SU-SRD/commit/578a12f8a7267bd49559b7dd67448463e7c20d77))

## 0.1.0 (2026-07-18)

### Features

- Initial in-app changelog.
