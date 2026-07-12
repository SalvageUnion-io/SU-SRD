# ADR-016: The Rotary Dial Selector and the Instrument / Reference Split

## Status

Proposed (materialized from the [Dashboard design doc](../architecture/dashboard.md);
"Proposed" until realized). Sub-decision of
[ADR-015](ADR-015-dashboard-distinct-play-surface.md).

## Context

The Dashboard must let a player select which entity/view is active without leaving
the one-screen frame, and must keep the reference document (the SRD display)
legible against dense HUD chrome.

## Decision

Entity/view selection is a **rotary Dial** (a 260px right-edge sidebar): the
**Active Dial Item overhangs to ~1/3 of the row and dominates the main display**,
while the display holds all interactivity and the dial holds readable stats only.
The Dashboard is thereby split into **bespoke instruments** (rail, bays, dial) and
**the reference document** (the display).

## Rationale

A detented dial gives a game-console "select your loadout" feel, keeps one selector
for all entities/views, and the overhang/viewfinder framing makes "what you
selected" and "what's showing" one continuous read. The instrument/document split
is what lets us reuse the faithful display
([ADR-017](ADR-017-dashboard-reuse-faithful-srd-display.md)) without the reference
document fighting the HUD chrome.

## Alternatives rejected

Left tabs, right drawers, a center tab bar, and bottom selector blocks were all
built and rejected across design iterations as either reflowing the fixed frame or
burying entities. Free-scroll (non-detented) was rejected as imprecise for a
keyboard/drag HUD.
