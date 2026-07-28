# Changelog

Maintained by release-please (see ADR-024).

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
