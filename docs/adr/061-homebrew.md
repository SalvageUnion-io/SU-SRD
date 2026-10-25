# ADR-061: Homebrew on the SRD

Decided and built for 4.1.0. Amends [ADR-032](032-public-read-only-sheets.md)
(a pattern shared by link may also be listed) and narrows the "net-new homebrew
authoring is out of scope" line of [ADR-021](021-cantina-surface-taxonomy.md)
and [ADR-030](030-accounts-games-server-of-record.md): showing what players
already make is in scope; new authoring surfaces still are not.

1. **What is homebrew.** A saved mech pattern its maker shares with "Anyone
   with the link" (ADR-032) and then, a second opt-in offered only while it
   is, "Share with the SRD" (`mechPatterns.homebrew`,
   `homebrew.setShared`). Withdrawing the link clears both, and sharing the
   link again does not restore the second. Patterns only for now; NPCs and
   custom crawler bays (#403) are not part of this.
2. **Where it shows.** On the SRD, never mixed into the book's data: a
   Homebrew category at `/homebrew/` (on the home Contents) lists every one,
   and a chassis page's "Show Homebrew" switch lists that chassis's under the
   book's patterns. The switch is the reader's, held in their browser
   (`su:show-homebrew`), and off until they turn it on. Every row wears the
   HOMEBREW stamp and opens the pattern's own page in the app.
3. **How the SRD reads it.** The SRD is static and its CSP allows only its own
   origin, so the Worker serves `GET /homebrew/patterns.json` (one chassis
   with `?chassis=`) from `homebrew.patterns` over Convex's HTTP API, cached
   for a minute. `homebrew.patterns` is unauthenticated and serves only
   patterns whose maker opted in, which the link already serves.
4. **Report and takedown.** On a homebrew pattern's page a signed-in reader
   reports it with a reason, once each (`homebrewReports`). A site admin
   (`model/admin.ts`, by Discord id in `ADMIN_DISCORD_IDS`) reads the queue at
   `/build/admin/homebrew` and hides a pattern from the SRD
   (`homebrewModeration`, keyed by the pattern's row), which re-sharing does
   not undo. Admin is a site role, unrelated to a Game's Organizer.

5. **Built-in homebrew.** Community designs Leyline Press published (Mech
   Monday) can ship in the reference data as patterns tagged `homebrew`,
   crediting their `author` and the `origin` post. They list with the
   players' (behind "Show Homebrew" and at `/homebrew/`, first), never in the
   book's patterns (`getBookPatterns`), and their own SRD page wears the
   HOMEBREW stamp beside a `MECH MONDAY | <author>` chip linking the post.

## Consequences

- New per-person storage: a report's reason and its reporter. Account
  deletion removes a player's reports; deleting a pattern removes its reports
  and takedown; the account export includes a player's reports.
- `homebrew.patterns` reads at most 500 patterns, newest share first;
  pagination comes when homebrew outgrows that.
- Patterns already shared by link before 4.1 stay off the SRD until their
  makers opt in.
