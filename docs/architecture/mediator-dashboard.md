# Mediator Dashboard

Superseded by [play.md](play.md) §10 (ADR-051): the Mediator's surface (M1) is Play's Mediator screen, and `/mediator/$gameId` redirects to `/play/game/$gameId`. The decisions Play kept, and the Game page's sections (M2, `apps/web/src/components/games/`), stand below.

Governing ADRs: 030 §3–§6, 038 and 021 in [ARCHITECTURE.md](../ARCHITECTURE.md).

- **§1 Reuse** — The server predates this surface; Play and M2 recompose it and reuse `crewLines()`, never forking the crew's vocabulary.
- **§2 Decisions**
  - **Q2–Q4 Route, gate, canvas** — Retired: play.md §1, §2 and §11 (`PlayMediatorGate`, the Cockpit frame).
  - **Q5 The table** — One seat per claimed pilot in stable order (joinedAt, callsign), content `crewLines()`; the red ring always comes with ▲ and a word.
    Tapping a seat targets that pilot in the propose dock.
  - **Q6–Q7 Crawler and Downtime** — Retired: play.md §10 (the crawler live in the table's column, `PlayMediatorDowntime`). Upkeep is 5 Scrap of the crawler's TL; End before the last step confirms.
  - **Q8 Proposals** — The dock (Target, Field, To, optional reason ≤140 chars, preview); All proposals pages 20 at a time.
    Fields: pilot HP/AP, mech SP/Heat. Rows give state in words (Superseded struck through) and cover every Mediator's proposals.
  - **Q9 Opposition** — Hidden from players: each NPC its reference card with HP or SP and Morale; Morale is stored on the NPC, never logged.
    An NPC at 0 shows as down and is never auto-removed; Remove confirms.
  - **Q10 M2 sections** — Mediator: crawler band, Mediate (Play), Proposals sent. Organizer: Invite link, Hand over. Everyone: crew, and Play for their pilot.
  - **Q11 Crew & seats** — Crawler card, then one row per member's pilot (what they have; Play shows where they are); open seats are unclaimed pilots; no presence column.
  - **Q12 Invites** — One invite URL per Game (ADR-030): the Organizer's Copy invite link and Reset link; opening it joins as a player.
  - **Q13 The Game** — Who mediates, with Hand over (Appoint when nobody does), who organises, and Delete; Archive is the owner's call.
  - **Q14 Tell the table** — One word to every player at once (`proposals.broadcast`), from the Mediator's Play bar.
- **§4 Server additions** — `changeLog.reason`, Mediator-only `proposals.sent` (indexed) and `mediator.updateNpc` (clamped, parsed).
- **§5 Tests** — Propose → apply → Applied from Play (`apps/web/e2e/play-mediator.e2e.ts`); server in `apps/web/test/convex/__tests__/mediatorDashboard.test.ts`.
