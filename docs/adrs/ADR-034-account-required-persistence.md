# ADR-034: Persistence Requires an Account, and the Local Store Is Only a Cache

## Status

**Accepted. Nothing is built yet — delivery is phased, and the executable plan
with its per-phase gates and progress table is
[architecture/persistence-and-pwa.md](../architecture/persistence-and-pwa.md).**

**Partially supersedes [ADR-030](ADR-030-accounts-games-server-of-record.md)** —
its §1 guarantee that Solo mode ("not signed in, IndexedDB is the source of
truth") "must keep working forever", and nothing else. **ADR-030 remains the
governing ADR** for Games, memberships, the role model, ownership, the two
containers, and Convex as the server of record; it is not superseded, and it
stays the right thing to cite for all of that.

**Amends [ADR-002](ADR-002-indexeddb-idb-zod.md)** (IndexedDB + Zod). The
storage technology and the Zod-parses-at-the-edge discipline are unchanged; what
changes is IndexedDB's *status* — it stops being anywhere's source of truth and
becomes a cache of Convex.

**Amends [ADR-022](ADR-022-provenance-log-and-overrides.md)** for the second
time. ADR-030 already claimed the Change Log is "now synchronized"; that claim
was never delivered on the client side, and this ADR makes it a requirement with
a phase behind it rather than a statement.

**Interacts with [ADR-033](ADR-033-cloudflare-hosting.md)**, which is mid-flight
at P7. See *Sequencing against the Cloudflare cutover* below — this work does
not start on `srd` until that ADR's P7 completes.

Re-affirms [ADR-032](ADR-032-public-read-only-sheets.md) without changing it: a
public sheet stays an unauthenticated **read** of a row that an account owns.
Reading has never required an account and still does not.

## Context

ADR-030 replaced ADR-001's no-backend stance with Convex as a server of record,
but it kept a promise: an anonymous user would always have a fully working app
whose data lived in IndexedDB, and that mode would be supported forever. The
promise was load-bearing at the time. ITUN had years of local-first users, no
accounts existed yet, and a migration that could strand somebody's roster was
the worst outcome available.

That promise has since produced a **second source of truth**, and the cost is no
longer hypothetical. Three separate observations converge on the same defect.

**The app holds records the server has never heard of.** Signed in, a saved mech
pattern is written to IndexedDB and mirrored nowhere: `patternStore` writes
straight through to `db.mechPatterns`, and the only thing that ever inserts into
the Convex `mechPatterns` table is the one-time `entities.claimLocal`. The same
is true of the client's encounter NPCs, whose Convex table of the same name is
written only by `mediator.ts` and is a different set of rows entirely. And local
Change Log entries never leave the device, while the Convex `changeLog` carries
only server-originated entries from `ownership.ts`, `proposals.ts` and
`botClient.ts`. Three stores, one shape of bug: a signed-in player's work is
partly on a device and partly on a server, with nothing reconciling them.

**Deleting a Game exposed the same gap in the schema.** Until #871 a crawler
could not exist outside a Game — `crawlers.gameId` was non-nullable and there
was no `ownerId` — so deleting a campaign had to destroy the crew's home. The
cheap fix was to copy the crawler into IndexedDB and leave the server out of it.
That fix was rejected and the schema moved instead, because a record with no
server row to reflect is invisible on the player's other devices, invisible to
sync, and lost when browser storage clears. #871 is the worked example of the
rule this ADR now states in general.

**"Local-first" was doing work as an identity, not as an engineering choice.**
The offline story here is what any competent Progressive Web App does: cache
what you have so the app opens without a network. It never needed a bespoke
architecture, and having one meant every feature had to be designed twice — once
for an account and once without — with the second design silently accumulating
the records above.

## Decision

Three decisions. They are stated separately because they are separately
falsifiable, but they are one change: each is unenforceable without the others.

### 1. Persistence requires an account

An anonymous visitor may **build**, and what they build is **in-memory only**.
They can open the app, work through a wizard, roll, read, and see a finished
sheet. Nothing they do is written to durable storage of any kind — not Convex,
and not IndexedDB.

**Saving is the moment an account is required**, and it is the *only* moment.
This is deliberately not a paywall shape or a signup wall: the ask arrives when
the user has something worth keeping and can see what keeping it means, rather
than in front of a product they have not tried.

Reading is unaffected. A public sheet (ADR-032) and the whole of `srd` remain
open to anyone with no account at all.

**Discord remains the only door.** ADR-030 §D3 chose it deliberately — the
audience already lives there, the project ships a Discord bot, and one identity
is what makes that bot usable — and gating persistence does not change any of
that reasoning. The consequence must be stated rather than discovered: **a person
with no Discord account cannot save anything, ever.** That is accepted, and it is
accepted *because* of the escape hatch below. Without the hatch this decision
would be indefensible.

**Export to file is the escape hatch, and it is now load-bearing.** An anonymous
user can download their in-memory work as a JSON bundle and import it after
signing in. This is not a new mechanism — `ExportAllButton`, `buildExportBundle`
and `mergeImport` already exist and already do it — but its *status* changes.
Export stops being a backup convenience and becomes **the guarantee that hitting
the account gate is never a data-loss event**. A file is not a source of truth
and never syncs, so it is fully compatible with decision 2; what it is, is a way
out.

Treat any incompleteness in the export bundle as a defect against this ADR, not
as a missing nice-to-have. See *The Change Log is not in the bundle* below.

### 2. Every record is DB-backed; the local store is a cache

**Convex is the source of truth for every persisted record, without exception.**
IndexedDB holds a reflection of it, and holds nothing else. There is no record,
of any kind, that exists only on a device.

The practical test, and the one to apply when reviewing any future change: *if
this row is not in Convex, is it lost when the user opens the app on their
phone?* If the answer is yes and that is acceptable, it is not data — it is a
device preference (see *What is not data* below). If the answer is yes and it is
not acceptable, the schema is wrong and the schema moves.

This closes the three gaps named in Context. `mechPatterns`, `encounterNpcs` and
the Change Log all become mirrored like pilots, mechs, crawlers and soft links
already are.

**`encounterNpcs` is one table with two containers, not two concepts.** An NPC
lives either in a Game — the Mediator's prepared opposition, `gameId` set — or on
somebody's shelf, their own tray to prep in before a Game exists. That is the
ownership table from ADR-030 §2 applied unchanged, and it is the *same move*
#871 made for the crawler: `encounterNpcs.gameId` is `v.id('games')` with no
`ownerId` today, which is precisely the shape `crawlers` had before it. Give it a
nullable `gameId`, an `ownerId`, a `by_owner` index and an `appId` to address
mirrored writes, and the collision resolves into the model everything else
already uses.

Rejected: renaming the local one to a "scratch tray". It would stop the collision
without removing the second concept, leaving a contributor two NPC ideas to keep
straight forever in exchange for a smaller diff now.

`mechPatterns` needs less: it already carries `ownerId` and a nullable `gameId`.
What it lacks is an `appId` — which is why `claimLocal` has to match patterns by
reading an id out of the opaque body — and a mirror.

### 3. Both apps are ordinary, installable PWAs — and install is what buys offline

`itun` and `srd` are both **full PWAs**: installable, with a web app manifest,
icons, and a service worker. Both already are; this decision is mostly about
closing gaps and about what offline *means*.

**Offline is table stakes, not a feature.** There is to be no local capability
in either app that you would not find in any competent PWA. This is the same
rule as decision 2 seen from the other side: the reason the local store may only
be a cache is that caching is all a PWA's local storage is for.

**Install is the trigger for full offline availability, and visiting is not.**

- A user in a browser tab gets the ordinary thing: the app shell, and whatever
  they have actually visited, cached at runtime. **An online visitor does not
  pre-download the site.** `srd` deliberately does not precache its 1,039 HTML
  pages today, and that stays true for browser visitors — a multi-megabyte
  install is not a courtesy to somebody who came to read one page.
- An **installed** app is expected to work offline in full. Installation is a
  user saying "I want this on my device", and it is the honest point at which to
  spend their bandwidth and storage.

**"No distinct difference" does not mean one shared implementation.** The two
apps keep the update strategy each one's failure history justifies. `itun` stays
on `registerType: 'prompt'` — `autoUpdate` there activated a new worker under a
live page, ran `cleanupOutdatedCaches()`, and deleted the precache that page was
still resolving chunks against, which is why share links needed four or five
refreshes. Forcing a single strategy across both apps in the name of uniformity
would re-open that outage or change `srd` for no reason. Uniformity is in the
*posture* — installable, cache-only, no bespoke local behaviour — not in the
config.

### What is not data

Device preferences are exempt from decision 2, and the exemption is narrow. A
preference qualifies only when losing it costs the user nothing but a moment's
re-adjustment: which container is active, dashboard display preferences, the
"you have unexported changes" nudge, the one-time claim marker, ephemeral mount
state. These may stay in `localStorage`.

**A preference that is expensive to lose is data.** If the list ever grows to
include something a user would be annoyed to re-create, that is the signal it
belongs in Convex, not a reason to widen the exemption.

## Consequences

- **Anonymous users lose durable local storage, and this is the real cost.**
  Somebody who does not want an account can no longer keep a roster on their own
  machine. That is a genuine loss of a genuine capability and should be stated
  plainly rather than presented as a cleanup. It is accepted because the
  alternative — two sources of truth forever — has already produced silent data
  divergence in three stores, and because in-memory building keeps the app
  usable without an account for everything except keeping the result.

- **Existing local data is never destroyed.** Every current Solo user's
  IndexedDB stays readable, and signing in **prompts them to claim it** into the
  account. `ClaimLocalData` and `entities.claimLocal` already implement exactly
  this, already offered rather than automatic, and already idempotent. No new
  migration mechanism is invented; the phase is about coverage and about what
  happens to somebody who declines.

- **A build with no `VITE_CONVEX_URL` is no longer a working app**, and this is
  the largest hidden consequence. CI, every Playwright e2e run, and a fresh
  checkout are all permanently Solo today, and 15 of the 16 e2e specs build a
  pilot, a mech or a crawler and expect it to persist (`bundle-budget.e2e.ts` is
  the one that does not — it measures bundle size). Removing Solo without
  answering this breaks nearly the whole e2e suite at once. The in-memory anonymous mode from decision 1
  is what those tests exercise, plus a signed-in path against a test deployment
  for anything asserting durability. This is a phase of its own and it is
  sequenced early, because it gates the ability to verify any later phase.

- **Convex becomes a hard dependency of the ITUN product**, not a feature of it.
  A Convex outage stops new saves rather than degrading to local writes. That is
  the same trade ADR-030 already made for Games (Disconnected is read-only, not
  a write queue), now extended to everything; an outbox is still refused, for
  ADR-030's original reason — it reintroduces the conflict resolution that
  choosing a server of record exists to avoid.

- **Every feature is designed once.** The "what does this do in Solo?" question
  disappears from every future change, which is the compounding benefit and the
  main reason this is worth the cost above.

- **Export becomes a tested guarantee rather than a convenience**, because two
  separate decisions now rest on it: the anonymous escape hatch, and what happens
  when somebody declines the claim. A silently incomplete bundle is a data-loss
  bug from the day this ships. It needs a gate asserting it covers every kind,
  and that gate has to be extended whenever a kind is added.

- **The Change Log is not in the bundle, and that needs a ruling.**
  `buildExportBundle` covers pilots, mechs, crawlers, soft links, patterns and
  encounter NPCs — **not `changeLog`**. That was harmless while export was a
  backup; it is not harmless now that export is the way out. The provenance log
  is arguably not the user's *build* and losing it may be acceptable, but that is
  a decision to make out loud rather than a gap to leave. Named as the one open
  question in the plan.

- **Declining the claim is a terminal choice, by design.** A user who declines is
  pushed to export and then not asked again. This is the least-nagging option and
  it has a real edge: somebody who declines, does not export, and later clears
  their browser storage has genuinely lost that roster. The mitigation is that
  the export must be *taken* rather than merely offered — see the plan's P5 gate,
  which does not let the app stop asking until a bundle has actually been
  produced or the user has explicitly refused that too.

- **Storage and bandwidth on install become a real budget.** Deciding that an
  installed app works fully offline means someone must own what "fully" costs —
  for `srd` that is on the order of a thousand pages or the JSON endpoints
  behind them. The plan carries a measured budget and a gate; an unmeasured
  "download everything on install" would be a worse experience than the 404 it
  replaces.

- **`srd` gains no accounts.** It has no user data and this ADR gives it none.
  Decision 1 does not apply to it; decisions 2 and 3 do, and for `srd` decision
  2 is trivially satisfied because it stores nothing.

## Sequencing against the Cloudflare cutover

ADR-033 is at P7: `intheunionnow.com` is live on Cloudflare, `salvageunion.io`
is still blocked on a Netlify support ticket, and P8 has not started.

**No phase of this ADR touches `srd`'s service worker until ADR-033's P7 is
complete.** Changing caching behaviour on a site whose host is mid-move would
make any resulting failure ambiguous between two causes, and service-worker
faults are exactly the class where that ambiguity is most expensive — a bad
worker persists on the client after the deploy that caused it is gone.

ITUN work may begin immediately: it is already live on Cloudflare, so its host
is settled.

## Alternatives considered

**Keep Solo forever and mirror it too.** Rejected: mirroring a source of truth
is not mirroring, it is synchronization, and it lands squarely back in the
conflict-resolution problem ADR-030 chose a server of record to avoid.

**Keep Solo but freeze it — read-only for anonymous users, no new writes.**
Rejected as the worst of both: it retains all the two-sources-of-truth machinery
and the second design of every feature, while still taking the capability away.
Claim-on-sign-in achieves the same migration without keeping the architecture.

**Local-only with an explicit opt-in "sync" toggle.** Rejected. This is the
current state with a switch on it, and the switch does not change that a device
can hold records the server lacks. It also makes every bug report begin with
"which mode were you in".

**A write outbox for offline writes.** Rejected, consistent with ADR-030 §1's
existing reasoning. Deferring writes means merging them later, and the merge is
the part that rots.
