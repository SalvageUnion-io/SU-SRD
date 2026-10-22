# ADR-053: Feature Flags

Decided and built for 4.1.0. A large surface that is not finished can merge
dark, so one branch never waits on its slowest workstream.

1. **One module.** `apps/web/src/lib/flags.ts` holds every flag in `FLAGS`, a
   name and one line on what it hides. A surface asks `flagOn('<name>')`: a
   route, a nav entry, a button, a section. Nothing else decides.
2. **Off in production, on everywhere else.** A flag reads the origin the build
   is served from (`SITE_URL`): production's origin turns every flag off; a
   Worker Preview's or the dev server's turns every flag on. A build with the
   test sign-in seam never deploys, so it turns them on too, and the e2e suites
   cover a flagged surface before it ships.
3. **Build-time and all-or-nothing.** No per-account, per-Game, per-request or
   remote toggle, and no flag on for one person in production. A flag is a
   constant the bundler folds, so a dark surface's code ships but never runs.
4. **The backend is not flagged.** Convex functions deploy with the code. A
   flagged surface's functions must be safe to run live: they check access as
   any function does, and they never migrate or delete data a released surface
   reads. A schema change behind a flag is additive only.
5. **Short-lived.** The PR that finishes a surface deletes its entry and every
   `flagOn` that read it. A release ships with `FLAGS` empty, or names in its
   notes each surface it ships dark.
6. **Not a kill switch.** A flag cannot turn a shipped surface off in
   production; a revert and a deploy do that (ADR-041).
