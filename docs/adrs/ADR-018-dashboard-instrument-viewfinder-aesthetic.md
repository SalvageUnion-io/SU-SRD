# ADR-018: Instrument / Viewfinder Aesthetic — Flat & Inset, Only the Display Reads Forward

## Status

Proposed (materialized from the [Dashboard design doc](../architecture/dashboard.md);
"Proposed" until realized). Sub-decision of
[ADR-015](ADR-015-dashboard-distinct-play-surface.md).

## Context

A dense play HUD risks visual noise and illegibility. The Dashboard needs a visual
language that keeps the reference document the clear focus and stays
color-blind-safe.

## Decision

The Dashboard is **flat and inset, not 3D**. Instrument surfaces (rail excepted)
read _recessed_ (mild inset shadow, soft entity-tinted borders); buttons are flat
recessed keys; **the main display is the single element that reads "forward"**
(solid hard 2.5px border, no inset). Hue encodes ontology, never identity; state is
a treatment overlay (hatch/strike/redline), never a second hue.

## Rationale

The recessed instruments + one forward document create the "workshop manual under
glass" read and make the display the unambiguous focus. The color laws keep a dense
HUD legible and color-blind-safe (WCAG AA).

## Alternatives rejected

Skeuomorphic 3D dials and a CRT-bend were considered and rejected as "too cute".
Per-source color chips that let hue mean identity were rejected in favor of
hue = ontology + non-color state cues.
