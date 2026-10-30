# Room backups

Every room's storage is backed up nightly (ADR-064 decision 4), beyond the 30 days of point-in-time recovery Durable Objects keep.

1. **What runs.** `BACKUP_CRON` (04:43 UTC, `apps/web/src/worker/crons.ts`) dumps every account and Game room the shared database knows of into the private R2 bucket `su-archive`, binding `ARCHIVE` (`src/worker/shared/backups.ts`).
2. **Where.** `rooms/<YYYY-MM-DD>/account/<discord id>.json` and `rooms/<YYYY-MM-DD>/game/<game id>.json`, names URI-encoded; a room with no rows writes nothing. `rooms/<day>/manifest.json` counts what was written, what was empty and what failed.
3. **A failed night.** The run backs up every other room, then throws, so Workers Issues shows `room backup: N room(s) failed (…)`. The manifest names each room and its error.
4. **Run one now.** Signed in as an admin (`ADMIN_DISCORD_IDS`), in the browser console on salvageunion.io:
   `await (await fetch('/__rooms/admin/backup', { method: 'POST' })).json()` answers that run's manifest.
5. **Restore one room.** Same console:
   `await fetch('/__rooms/admin/restore', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ day: '2026-10-30', kind: 'game', name: '<game id>' }) })`.
   200 restored, 404 no backup that day, 400 a body it cannot read. It replaces the room's whole storage, every open socket hears the restored room, and its shared rows are written again.
6. **What a restore refuses.** A dump from another room schema (a migration since): restoring across one is a code change. The room is left as it was.
7. **Recent mistakes (under 30 days).** Durable Objects' own point-in-time recovery can roll a room back to a moment, not just a night; it is not wired to a route.
8. **Retention.** An R2 lifecycle rule on `su-archive` deletes `rooms/` objects after 90 days (an owner step: `bunx wrangler r2 bucket lifecycle add su-archive rooms-90d rooms/ --expire-days 90`).
