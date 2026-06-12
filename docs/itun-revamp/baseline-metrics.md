# ITUN Revamp — Release Baseline Metrics

> **Status:** Template. Maintainer populates the **Baseline at release** column
> when the deploy-swap (#218) is performed, and commits the result as the
> closure of #219. Until then, every cell reads `_TBD at release_`.

Tracks the PRD's success and outcome metrics at the moment of the M3 → Release
swap, so post-release drift can be measured against a fixed reference.

- Source: the PRD's Success Metrics (§2.3) and Outcome Metrics (§6.1).
- Scope of "release": the first commit on `main` after the
  `yitun-revamp → main` integration merge ships at the canonical ITUN URL.
- Cadence after baseline: maintainer self-reports on community / sustainability
  rows ad-hoc; CI-gated rows (a11y, snapshot round-trip) are continuously
  enforced and do not need re-measurement.

## PRD §2.3 — Success Metrics

| Metric                                   | Measurement                                                             | Desired Outcome                                                         | Baseline at release                                                 |
| :--------------------------------------- | :---------------------------------------------------------------------- | :---------------------------------------------------------------------- | :------------------------------------------------------------------ |
| Time-to-first-build for a new visitor    | Manual timing: load page → first saved pilot/mech/crawler               | ≤ 10 minutes, no account, no install                                    | _TBD at release_ (filled by #216 timing study; cite commit/PR)      |
| Builds shareable via single-URL snapshot | Functional check on publish + open-snapshot round-trip                  | 100% of build types (pilot-only, mech-only, crawler-only, wired)        | _TBD at release_ (cite the CI run that exercises all four modes)    |
| Print-quality sheet output               | Visual review of A4 + US Letter PDF for each build type                 | Professional fidelity at both page sizes                                | _TBD at release_ (cite the M2 print-review checkpoint commit)       |
| Sheet-view accessibility                 | Automated `a11y-scan` CI run                                            | Zero WCAG 2.1 AAA violations on the sheet view; zero AA elsewhere       | _TBD at release_ (cite the `a11y-scan` workflow run URL)            |
| Mobile sheet legibility at the table     | Manual test on iPhone / Android viewport                                | Critical info readable without zoom; touch targets ≥ 44 px              | _TBD at release_ (cite the device + viewport tested)                |
| Community uptake                         | Self-reported: SU Discord / forum mentions, GitHub stars, anecdotal use | ≥ a handful of SU players outside the maintainer reach a finished build | _TBD at release_ (starts at 0; baseline is the timestamp)           |
| Maintainer ship cadence                  | Internal: ratio of merged PRs to in-progress branches                   | The maintainer stops dreading the codebase                              | _TBD at release_ (cite open-branch count + merged-PR count at swap) |

## PRD §6.1 — Outcome Metrics

| Outcome                                            | Metric                                                                         | Method                                             | Desired Outcome                                                             | Baseline at release                                    |
| :------------------------------------------------- | :----------------------------------------------------------------------------- | :------------------------------------------------- | :-------------------------------------------------------------------------- | :----------------------------------------------------- |
| Visitor builds a character without friction        | Time from first page-load to first saved pilot                                 | Maintainer timing study + post-release self-report | ≤ 10 min (REQ-NF-17)                                                        | _TBD at release_ (mirror #216 result)                  |
| Builds are shareable across all composition levels | Snapshot publish + open round-trip per build type                              | Functional test in CI                              | All four (pilot-only, mech-only, crawler-only, wired) ✓                     | _TBD at release_ (CI run URL)                          |
| Sheet is accessible                                | WCAG 2.1 AAA on sheet view; AA elsewhere                                       | `a11y-scan` CI run                                 | Zero violations at stated levels (REQ-NF-10, REQ-NF-11)                     | _TBD at release_ (a11y-scan run URL + counts)          |
| Print output is professional                       | A4 + US Letter PDF visual review                                               | Maintainer print-preview review per sheet/print PR | Passes maintainer review                                                    | _TBD at release_ (link the most recent passing review) |
| Sheet is mobile-usable at the table                | Manual test at 320 px and on real device                                       | Pre-release manual QA                              | Critical info readable without zoom; targets ≥ 44 px (REQ-NF-12, REQ-NF-15) | _TBD at release_ (device + viewport notes)             |
| App works offline                                  | Manual test: load, go offline, build                                           | Pre-release manual QA                              | All non-publish flows succeed offline (REQ-NF-07)                           | _TBD at release_ (pass/fail + notes)                   |
| Community adoption                                 | Anecdotal: SU Discord / forum mentions, GitHub stars, opened-snapshot URL hits | Self-reported, no telemetry                        | ≥ a handful of SU players outside the maintainer reach a finished build     | _TBD at release_ (mark the starting timestamp)         |
| Maintainer sustainability                          | Cadence of merged PRs vs in-progress branches                                  | Self-observation                                   | Maintainer continues to ship without dread                                  | _TBD at release_ (snapshot of `gh pr list` at swap)    |

## Post-release tracking path

Once baselined, the maintainer tracks drift via:

- **a11y / snapshot round-trip:** CI status on `main` (no manual cadence;
  regressions break a green build).
- **Community uptake:** ad-hoc — review SU Discord mentions, GitHub stars,
  and any opened-snapshot URL anecdata once per quarter.
- **Maintainer sustainability:** ad-hoc — `gh pr list --state all --limit 50`
  glance once per quarter; compare to baseline.
- **Print + mobile + offline:** re-verified only when a PR touches sheet,
  print stylesheet, service worker, or viewport-affecting layout. No
  scheduled cadence.

There is no telemetry, no metrics pipeline, no scheduled report. This doc is
the entire measurement surface.

## How to close #219

1. Perform the deploy swap (#218) and confirm the new ITUN serves at the
   canonical URL.
2. Run the #216 timing study; record the result here under the "Time-to-
   first-build" rows.
3. Capture the `a11y-scan` workflow run URL and snapshot round-trip CI URL
   from the swap commit; paste under the relevant rows.
4. Snapshot `gh pr list --state all` counts at swap time; paste under the
   sustainability + uptake rows.
5. Commit this file with a `docs(itun-revamp): baseline metrics at M3 release`
   message; reference the release commit SHA in the commit body. Close #219.
