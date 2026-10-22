# ADR-056: The Homebrew Library

Decided and built for 4.1.0. Amends [ADR-032](032-public-read-only-sheets.md)
(a second account-free surface) and narrows the "net-new homebrew authoring is
out of scope" line of [ADR-021](021-cantina-surface-taxonomy.md) and
[ADR-030](030-accounts-games-server-of-record.md): sharing what players
already make is in scope; new authoring surfaces still are not.

1. **What is listed.** Saved mech patterns and built NPCs (ADR-044), the two
   kinds a player makes that could pass for the book (ruleset §3.9). Custom
   crawler bays (#403) are not part of this decision.
2. **Opt-in, on top of the link.** Only a thing its maker shares with
   "Anyone with the link" (ADR-032) can be listed, by its maker alone, from
   the same Share dialog ("List it in the Homebrew library",
   `library.setListed`). Listing parses the body, as publishing does.
3. **A listing is never more public than its source.** `libraryEntries`
   holds only kind, app id, maker and moderation state; every read goes back
   to the source row for its body and checks `publicRead`. Triggers on
   `mechPatterns` and `npcs` delete the listing when the link is withdrawn or
   the thing is deleted, however that happens.
4. **Public browsing.** `/build/library` lists what is listed, newest first,
   with no account (`library.list`, unauthenticated). Each entry opens the
   thing's public page; Make a copy writes a new thing with a new id to the
   reader's own Training Bay, linked to nothing.
5. **Report and takedown.** A signed-in reader reports a listing with a reason,
   once each (`libraryReports`). An admin (`model/admin.ts`, by Discord id in
   `ADMIN_DISCORD_IDS`) reads the queue on the library page and hides a
   listing; a hidden listing stays hidden if its maker withdraws and re-shares
   the link. Admin is a site role, unrelated to a Game's Organizer.

## Consequences

- New per-person storage: a report's reason and its reporter. Account
  deletion removes a player's reports and their listings; the account export
  includes their reports.
- `library.list` reads at most 240 listings; pagination comes when the library
  outgrows one page.
- The library page is indexable and in the app's sitemap; listings are not.
