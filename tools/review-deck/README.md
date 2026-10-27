# Review deck

Builds the "SalvageUnion.io 4.0 review" artifact: every screen type of the site
and the app at desktop (1440) and phone (390), one viewport shot per slide,
Approve / Request changes with a comment per slide, verdicts kept in the
artifact's `verdicts` collection. Runs in the cloud environment.

## Files

- `bun run gallery:deck` (`apps/web/scripts/galleryDeck.ts`): the screenshot
  gallery's deck mode, the shoot. It signs in and seeds as the gallery does and
  opens views through the design walk. It shoots every index, every guide, the
  shortest, middle and longest show page of each other kind, the patterns, the
  data-less pages, the known outliers, every app screen (`designRoutes`) and the
  Starter Set's sheets. On each view it runs the canon's gates (`_chipStrips`,
  `_entityFrames`, `_nestingDepth`, `_siblingHeights`, `_pageRhythm`,
  `_tokenCutout`) as **rule violations**. It also looks for blind spots
  (overlaps, clipped text, a word broken over lines, broken art, sideways
  scroll) as **possible issues**. Each is outlined on the shot: magenta for a
  rule, blue for an issue.
- `stage.ts`: lays out the artifact folder. Stacks shots four to a plain JPEG
  (`shots/sheet-NNN.jpg`: a version holds at most 511 files, and plain image
  files load in a signed-out browser where base64 did not), writes
  `manifest.json` with the commit stamp, and marks a slide **changed** where a
  baseline has the same view at the same scroll and the pixels differ.
- `baseline.ts`: turns the deck as published back into a baseline folder, so
  "Changed since last feedback" works without the last shoot's files.
- `deck.html`: the page (`index.html` in the artifact). Filters for open,
  changed, rule violations and possible issues, a pill per rule with its count.
  A verdict counts only on the commit it was given on.

## Run it

```bash
bun run dev:backend &                                   # local Worker + seeded account + dev server
bun run gallery:deck .shots/runs/<name> [/chassis/,/classes/]   # ~1h for the whole site
# Baseline: read the live deck's manifest.json and shots/sheet-*.jpg with the
# Artifact tool (action read, paths, out_dir .shots/published), then:
bun tools/review-deck/baseline.ts .shots/published .shots/baseline
bun tools/review-deck/stage.ts .shots/runs/<name> .shots/stage/<name> <commit> .shots/baseline
```

Publish to the same artifact (`url`, `root` = the stage folder): about 100
sheets per call through `files`, then `index.html` and `manifest.json` last.
The page needs `capabilities: {db: {}, user: {}}` (kept on a redeploy).
`.shots/` is gitignored.
