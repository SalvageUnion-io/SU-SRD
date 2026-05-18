# Phase 5 — Ship

- **Run ID:** `2026-05-18-itun-revamp-wave-6`
- **Base:** `yitun-revamp` @ `537425b2`
- **Issues closed:** #199, #200, #201, #205
- **Cycles:** 3, all clean
- **Tests added:** ~50 (20 click-to-edit + 9 print smoke + 25 share-URL)
- **PR strategy:** one
- **Status after this PR:** M2 has 3 stories left (#206 mobile, #207 browser matrix, #208 sheet smoke tests)

## Notes for PR

- Click-to-edit: HP/AP/TP/SP/EP/Heat editable on MechSheet via InlineEditField + EditableStatRow; SoftWarningBanner surfaces inline
- Print: @media print + @page CSS for A4 default + US Letter via browser dialog; manual review checklist in cycle-2.md
- Share-URL: PublishButton in sheet header → POST snapshot → ShareURLDialog with copy-to-clipboard; /s/$id route fetches via retrieveSnapshot + renders SnapshotView (read-only via existing PilotSheet/MechSheet/CrawlerSheet components)
- MechSchema extended with optional `currentHP/AP/TP/SP/EP/Heat` for live-play tracking — additive, no migration
