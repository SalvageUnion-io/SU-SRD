# ADR-053: Usage Signals and Feedback

Decided and built for 4.1.0.

### 1. Aggregate counts, never a log of people

The site counts what is used and stores nothing new about who used it.

- **Totals** (accounts, sheets by kind, patterns, Games, Games with two or more
  members, Discord servers) are tallied once a day, a page at a time, into a
  `metricsSnapshots` row (`convex/metrics.ts`). Convex has no count, and a
  live count over growing tables would not stay inside a query's limits.
- **Weekly signals** are counters bumped by the write that is the signal:
  `usageCounts` holds one row per key per week (Monday 00:00 UTC). A Downtime
  begun (`downtime:game`, `downtime:solo`) and a bot command answered
  (`bot:<command>`) are the keys today.
- **Bot reach** is `botGuilds`: one row per Discord server the bot has answered
  in, with when it first and last did. A server's id, never a member's.
- The bot reports a command over its existing door (`/bot/usage`), after
  answering, off the response path. An outage loses a count, never a reply.

### 2. One read, two readers

`metrics.report` (internal) and `metrics.forAdmin` share one read: the newest
snapshot and eight weeks of tallies. The admin page (`/build/admin/metrics`)
calls `forAdmin`; the Monday report runs `report` with the deployment key.

### 3. Admins are a deployment setting

An admin is an account whose Discord id is listed in the deployment's
`ADMIN_DISCORD_IDS` (`convex/model/admin.ts`). No column and no mutation grants
it. Everybody else gets null from admin reads and a refusal from admin writes.

### 4. Feedback becomes a public GitHub issue

"Suggest or report" (the app's account menu, signed in) and `/su feedback`
(anybody on Discord) file a labelled issue on the public SU-SRD repository:
`feedback`, plus `bug` or `enhancement`. The issue carries the note and where
it was sent from, never a name; mentions and issue links in the note are
neutralised. The form says it goes public before anybody types.

- A note is written to `feedback` first and filed by an action with
  `GITHUB_FEEDBACK_TOKEN`, so a GitHub outage or a missing token loses nothing:
  the hourly sweep files what waits. Unfiled after a week, it is dropped.
- Once filed the text is cleared; the row stays a day so the limit (five a day
  per account or Discord id) can count it, then goes. Deleting an account
  deletes its notes.

### 5. A hand-written roadmap

`/roadmap` is a static page with Now, Next and Later, edited in the repository
with each release. No dates.
