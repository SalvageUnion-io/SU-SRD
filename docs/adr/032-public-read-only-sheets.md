# ADR-032: Public, Read-Only Sheets

A **public, read-only rendering of the live sheet**: a stable URL that needs no
account, is always current, and needs no publishing step. It is the one
account-free share and the one exception to [ADR-030](030-accounts-games-server-of-record.md) §5.
Every shared kind (pilot, mech, crawler, NPC, pattern) sets it from one "Who
can see it" control: Only me, My Game's crew, Anyone with the link.

1. **Opt-in, per entity, stored server-side.** A nullable `publicRead` column
   beside `gameId` and `ownerId`; absent or `false` means members only.
2. **The owner decides; the table runner decides for a Game's crawler.**
   Turning it **on** is owner-only (`assertMayPublish`, no Mediator override);
   a crawler in a Game is the table runner's, on a shelf its owner's. Turning
   it **off is always permitted**, even with a null `ownerId`
   (`ownership.release` and the leave-Game sweep null it), so a published sheet
   can never be stuck public. A published mech carries the abilities of an
   **unclaimed** pilot flying it, never a claimed crewmate's.
3. **Addressed by `appId`, at `/p/:kind/:appId`**, not the row id: the owner
   and the bot already hold the app id.
4. **One unauthenticated Convex query, returning one entity**, or `null` (not a
   refusal) when it is not public, so a withdrawn sheet looks like none.
   `publicSheet.get` also returns direct assignments: a published one with its
   body, any other by kind alone ("Not shared").
5. **Rendered by existing machinery:** the live `<Sheet readOnly>` over
   `readOnlySheetStore.model.ts`, whose every write throws.
6. **Turning it off revokes it everywhere, immediately**: one derived URL per
   entity, no outstanding links.
7. **Saved mech patterns** add a **Game scope**: Only me, Anyone with the link
   (`publicRead`), or My Game's crew (`gameId` as a read scope, never a
   container). `shelf.setPatternVisibility` is the maker's alone and parses the
   body before widening. `/p/pattern/:appId` is served by `publicSheet.pattern`;
   the page wears the user-made treatment (ruleset §3.9). Deleting the Game
   drops a crew-scoped pattern to Only me. Built NPCs: `/p/npc/:appId`, maker credited.

## Consequences

- Opt-in because it widens who can read a sheet (a pilot's free-text fields
  included); the toggle says so.
- **The URL is not a secret**: `publicRead` is the control, and it can be withdrawn.
- A public sheet is crawlable and names its canonical URL; a missing or private
  one answers `x-robots-tag: noindex` (`worker/cantina.ts`); the sitemap never
  lists `/p/`.
- Links unfurl: for a bot's request the Worker swaps the shell's
  `cantina:meta` block for `publicSheet.preview` and renders its `OgCard`
  (`apps/web/src/worker/linkPreview.ts`); a private sheet unfurls as the Private card.
