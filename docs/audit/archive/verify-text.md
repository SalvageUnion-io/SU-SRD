# Text & Typo Verification

## Verdicts

### FIX

| Entity | File | Field | Current Text | Correct Text | Severity |
|--------|------|-------|-------------|-------------|----------|
| Squeeze it in | abilities.json | description | "Temporariliy" | "Temporarily" | typo |
| Gather Intelligence | abilities.json | description | "recieve" | "receive" | typo |
| Spotter | abilities.json | description | "Chooose" | "Choose" | typo |
| Knife Missle | equipment.json | name | "Knife Missle" | "Knife Missile" | typo |
| Custom Missle Launcher | equipment.json | name | "Custom Missle Launcher" | "Custom Missile Launcher" | typo |
| Knife Missle (guides ref) | guides.json | systems list | "Knife Missle", "Custom Missle Launcher" | "Knife Missile", "Custom Missile Launcher" | typo |
| Gladitorial Combat (abilities x3) | abilities.json | tree | "Gladitorial Combat" | "Gladiatorial Combat" | typo |
| Gladitorial Combat (classes x2) | classes.json | coreTrees | "Gladitorial Combat" | "Gladiatorial Combat" | typo |
| Gladitorial Combat (tree reqs) | ability-tree-requirements.json | requirement | "Gladitorial Combat" | "Gladiatorial Combat" | typo |
| Valiant Speech | abilities.json | description | "Inspire you allies" | "Inspire your allies" | typo |
| This one goes to 11... | abilities.json | description | "beyond it's initial capacity" | "beyond its initial capacity" | grammar |
| This one goes to 11... (action copy) | actions.json | content value | "beyond it's initial capacity" | "beyond its initial capacity" | grammar |
| Crush (Apophis action) | actions.json | content | "THe₂x" (U+2082 subscript 2) | "The 2x" | encoding |
| Mechapult (entry 13) | roll-tables.json | table value | "tHe₂×" | "the 2×" | encoding |
| Mechapult (entry 18) | roll-tables.json | table value | "tHe₂×" | "the 2×" | encoding |
| Little Sestra | chassis.json | content | Cyrillic "Н" (U+041D) in "НC-15" | Latin "H" in "HC-15" | encoding |
| Group Initiative (6-10) | roll-tables.json | table["6-10"] value | "One NPC chosen by the **players** acts first" | "One NPC chosen by the **Mediator** acts first" | gameplay-affecting |
| Trading Bay | crawler-bays.json | npc.content | "waste- landers" | "wastelanders" | typo |
| Battle Crawler | crawlers.json | content | Missing period at end (ends "...fighters") | Add "." | typo |
| Trade Caravan Crawler | crawlers.json | content | Missing period at end (ends "...goods") | Add "." | typo |
| Medium distance | distances.json | content[0] | Missing period at end ("...at this Range") | Add "." | typo |
| Medium distance | distances.json | content[1] | Leading space (" You are in Range...") | Remove leading space | typo |
| Spiked Carapace (Typhon) | actions.json | content | "unborrows" | "unburrows" | typo |

### SKIP

| Entity | File | Field | Current Text | Reason for Keeping |
|--------|------|-------|-------------|-------------------|
| Adv. Epoxy Applicator | equipment.json | name | "Adv. Epoxy Applicator" | Deliberate abbreviation used consistently across 43 occurrences in 6 files (equipment, actions, modules, systems, chassis, roll-tables). This is a project-wide convention, not a one-off typo. |
| Constricting Coils (Apophis) | actions.json | content | "Apophis" (PDF has typo "Aphosis") | JSON has the correct spelling; the PDF contains the typo. No change needed. |
| Mechapult (entry 9) | roll-tables.json | table value | "[[[Explosive] (X)]]" and "[[[Burn] (X)]]" | This uses a nested bracket pattern `[[[Trait] (X)]]` which appears to be an intentional formatting convention for traits with parameters inside link brackets. The outer `[[` is the link syntax, the inner `[Trait]` is the trait reference. Not a triple-bracket error. |

### VERIFY

| Entity | File | Field | Current Text | Proposed Text | Why Ambiguous |
|--------|------|-------|-------------|--------------|---------------|
| WingSuit | equipment.json | name | "WingSuit" | "Wingsuit" | Casing could be intentional branding (CamelCase product name) or a typo. PDF shows "Wingsuit". Appears in guides.json too. Recommend fixing to match PDF. |
| Scuffed Book | roll-tables.json | table entry | "Scuffed Book" | "Scruffed Book" | PDF reportedly says "Scruffed Book". Both are real words with different meanings ("scuffed" = scratched; "scruffed" = worn/shabby). Need PDF visual confirmation to determine which is correct. |
| Scrapper (Sakura Pattern) | chassis.json | content | Missing second sentence about riot control Mechs | Add full sentence from PDF | Paraphrased content -- may be intentional editorial condensation or accidental omission. Need PDF comparison. |
| Forge (Osiris Pattern) | chassis.json | content | Heavily abbreviated paraphrase | Full PDF text | Significant rewording from source. Could be intentional simplification or data entry error. Need PDF comparison. |
| Gopher (Legion Pattern) | chassis.json | content | Paraphrased/simplified | Full PDF text | Same as above -- condensed from original. |
| Gopher (Longsaddle Pattern) | chassis.json | content | Truncated, missing Crawler #192 detail | Full PDF text | Missing specific detail. Could be intentional or accidental truncation. |
| Gopher (Opus Pattern) | chassis.json | content | "original purpose of quickly moving" | "original designation of quickly ferrying" | Word substitution ("purpose"/"moving" vs "designation"/"ferrying"). Minor paraphrase that changes specificity. |
| Trooper (DronTek Pattern) | chassis.json | description | Paraphrased/reworded from PDF | Original PDF text | Rewording extent unclear without PDF side-by-side. |
