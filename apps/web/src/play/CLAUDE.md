# play — The Cantina

Map: [play.md](../../../../docs/architecture/play.md). Play only plays: edits
are the Build sheet's, but for `CrawlerEconomyControl.tsx`; conditions stay
player-driven (`cycleItemCondition`).

- `usePlaySituation` and the side hooks run once per screen (one form is
  mounted), so the roll dispatch runs once.
- Seat and Downtime writes go through `useGuardedWrite`, which refuses
  offline; a Downtime step is claimed before it applies. The Mediator's
  target has no pilot (`MediatorTarget`, `pilotId: null`).
- Files: Units `PlayUnits*`; Actions `PlayActions*`, `useActionsDeck`,
  `lib/rules/actionPatches.ts`; Downtime `*Downtime*`; side `PlaySideColumn`;
  Mediator `mediator/`; Game page `games/`.
- Shot: `:play`, `:mediate`, signed in.
