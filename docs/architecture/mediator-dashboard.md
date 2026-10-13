# Mediator Dashboard

M1 is the Mediator's surface (`apps/itun/src/components/mediator/`); M2 is the Game page's sections (`apps/itun/src/components/games/`). Governing ADRs: 030 §3–§6, 038 and 021 in [ARCHITECTURE.md](../ARCHITECTURE.md).

- **§1 Reuse** — The server predates this surface; M1 and M2 recompose it and reuse `crewLines()` and `SavedIndicator`, never forking the Crew tab's vocabulary.
- **§2 Decisions**
  - **Q2 Route** — `/mediator/$gameId`; ‹ returns to `/games/$gameId`. The player Dashboard is untouched.
  - **Q3 Gate** — Connected Mediator: the surface; other members: one line and a link; Disconnected or Outdated: last data, controls disabled, not hidden.
    Signed out gets `DashboardGate`'s answer; writes are blocked, never queued.
  - **Q4 Canvas** — 1280×800 `DashboardCanvas` with `minScale` 0.8 and a `reflow` node; below it the same panels stack in one scrolling column.
  - **Q5 The table** — One card per claimed pilot in stable order (joinedAt, callsign), content `crewLines()`; the red ring always comes with ▲ and a word.
    Tapping a card targets that pilot in the propose dock; seven or more seats scroll sideways.
  - **Q6 Crawler minor** — The primary crawler's name, SP, TL and intact bays; ⤢ opens its live sheet; an `EmptyState` when there is none.
  - **Q7 Downtime** — Ten rules steps, not the board's five; Begin and End are buttons; upkeep is 5 Scrap of the crawler's TL; End before the last step confirms.
  - **Q8 Proposals** — The dock (Target, Field, To, optional reason ≤140 chars, preview) shows under every tab; the Proposals tab pages 20 at a time.
    Fields: pilot HP/AP, mech SP/Heat. Rows give state in words (Superseded struck through) and cover every Mediator's proposals.
  - **Q9 Opposition** — Hidden from players: each NPC a head-extent `ReferenceEntityCard` with an HP gauge (a compact `VitalGauge`) and Morale; Morale is stored on the NPC, never logged.
    An NPC at 0 shows as down and is never auto-removed; Remove confirms.
  - **Q10 M2 sections** — Mediator: crawler band, open M1, Downtime controls, Proposals sent. Organizer: invites, Asking to join, Hand over. Everyone: crew, Downtime track.
  - **Q11 Crew & seats** — Crawler card, then one row per member's pilot (what they have; M1 shows where they are); open seats are unclaimed pilots; no presence column.
  - **Q12 Invites** — Seat stamp, approval, expiry (1/7/14/30 days, default 7), uses, Copy, Revoke; approval unchecked by default; Asking to join: Let in or Decline.
  - **Q13 The Game** — Who mediates, with Hand over (Appoint when nobody does), who organises, and Delete; Archive is the owner's call.
  - **Q14 Tabs** — Opposition, Proposals, Tell the table, Tables (rolls private), SRD, Log.
- **§4 Server additions** — `changeLog.reason`, Mediator-only `proposals.sent` (indexed) and `mediator.updateNpc` (clamped, parsed).
- **§5 Tests** — Propose → apply → Applied (`apps/itun/e2e/mediator-propose.e2e.ts`); approval link → Let in → Game page (`apps/itun/e2e/invite-approval.e2e.ts`); server in `apps/itun/test/convex/__tests__/mediatorDashboard.test.ts`.
- **§6 M1 layout** — Rail; The table, Crawler minor, Downtime minor; tabs left, propose dock right. Ground ink-deep, instruments band-cream, display paper.
  Controls are 48 design units tall, so at least 38px at the 0.8 floor.
- **§7 Accessibility** — Base UI tabs; a seat card is a button whose label reads its whole line (▲ `aria-hidden`); polite live regions only; `ConfirmDialog` focuses Cancel.
- **§8 Guardrails** — No new `.su-dash-*` class, existing `theme.css` tokens only.
