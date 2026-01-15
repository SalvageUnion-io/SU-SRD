# Action Differences Analysis

This document describes how actions with numbered variants differ from their unnumbered counterparts. Actions that are supersets (can be merged) are not included here.

## Actions That Differ (Need Contextual Names)

### .50 Cal Machine Gun

- **Damage**: Same values but different key order (cosmetic difference)
- **Traits**: Numbered version adds `multi-attack` trait with amount 2
- **Content**: Only in unnumbered version (descriptive text)

### Beta Fission Gun

- **Traits**:
  - Unnumbered: `energy`, `burn (2)`, `explosive (2)`, `heavy`
  - Numbered: `burn (2)`, `energy`, `explosive (1)`, `multi-attack`
  - Differences: explosive amount changed from 2 to 1, added multi-attack, removed heavy
- **Range**: Unnumbered: `Medium`, Numbered: `Long`
- **Damage**: Unnumbered: `7 SP`, Numbered: `9 SP`
- **Content**: Only in unnumbered version (descriptive text)

### Custom Sniper Rifle

- **Traits**:
  - Unnumbered: `pilot equipment`
  - Numbered: `ballistic`
- **Content**: Completely different descriptions
  - Unnumbered: Describes acquiring and training with the rifle
  - Numbered: Describes attack mechanics with tech level scaling
- **Damage**: Only in numbered version: `2 SP`
- **Range**: Only in numbered version: `Long`

### Green Laser Rifle

- **Damage**: Same values but different key order (cosmetic difference)
- **Content**: Only in unnumbered version (descriptive text about weapon variety)

### Improvised Firearm

- **Damage**: Same values but different key order (cosmetic difference)
- **Content**: Only in unnumbered version (descriptive text about improvised weapons)

### Improvised Melee Weapon

- **Traits**:
  - Unnumbered: `melee`, `silent`
  - Numbered: `melee` only (missing `silent`)
- **Damage**: Same values but different key order (cosmetic difference)
- **Content**: Only in unnumbered version (descriptive text about improvised melee weapons)

### Laser Guidance

- **Traits**:
  - Unnumbered: `targeter`
  - Numbered: `targeter`, `guided` (adds guided trait)
- **Content**: Different descriptions
  - Unnumbered: Describes activation and target selection
  - Numbered: Describes automatic hit mechanics

### Monomolecular Sword

- **Traits**:
  - Unnumbered: `deadly`, `melee`, `silent`
  - Numbered: `melee`, `deadly`, `multi-attack (2)` (removed silent, added multi-attack)
- **Damage**: Unnumbered: `4 SP`, Numbered: `6 SP`
- **Content**: Only in unnumbered version (descriptive text about the blade)

### Multi-Targeter

- **Content**: Different descriptions
  - Unnumbered: Describes attacking with multiple weapons systems
  - Numbered: Describes making attacks with any number of weapons
- **Activation Cost**: Only in numbered version: `X` (variable cost)

### Pinpoint Targeter

- **Content**: Completely different descriptions
  - Unnumbered: Describes development by Sakura Futures and disabling targets
  - Numbered: Describes attack mechanics and system/app selection

### Pistol

- **Damage**: Same values but different key order (cosmetic difference)
- **Content**: Only in unnumbered version (descriptive text about weapon variety)

### Red Laser

- **Range**: Unnumbered: `Close`, Numbered: `Medium`
- **Damage**: Unnumbered: `3 SP`, Numbered: `4 SP`
- **Traits**:
  - Unnumbered: `energy`, `hot (1)`
  - Numbered: `energy`, `hot (1)`, `multi-attack (2)` (adds multi-attack)
- **Content**: Only in unnumbered version (descriptive text)

### Rifle

- **Damage**: Same values but different key order (cosmetic difference)
- **Content**: Only in unnumbered version (descriptive text about weapon variety)

### Rocket Launcher

- **Traits**:
  - Unnumbered: `explosive (1)`, `heavy`, `missile`, `uses (3)`
  - Numbered: `missile`, `explosive (1)`, `multi-attack (2)`, `uses (3)` (removed heavy, added multi-attack)
- **Damage**: Unnumbered: `5 SP`, Numbered: `6 SP`
- **Content**: Only in unnumbered version (descriptive text)

### Sniper Rifle

- **Damage**: Same values but different key order (cosmetic difference)
- **Content**: Only in unnumbered version (descriptive text about scoped rifles)

## Common Patterns

1. **Content Differences**: Many numbered versions lack the descriptive `content` field that exists in unnumbered versions. This suggests numbered versions are more mechanical/stat-focused.

2. **Trait Differences**:
   - Numbered versions often add `multi-attack` trait
   - Some numbered versions remove traits (like `silent`, `heavy`)
   - Trait amounts sometimes differ (e.g., `explosive (2)` vs `explosive (1)`)

3. **Damage/Range Differences**:
   - Some numbered versions have different damage values
   - Some numbered versions have different range values

4. **Key Order Differences**: Some differences are just JSON key ordering (e.g., `{"damageType":"SP","amount":2}` vs `{"amount":2,"damageType":"SP"}`). These are cosmetic and should be treated as identical.

## Actions with Multiple Numbered Variants

These actions have multiple numbered variants, making comparison more complex:

- **Armour Plating**: 2 numbered variants
- **Chassis Repair**: 7 numbered variants
- **Coolant Flush**: 2 numbered variants
- **Patch**: 10 numbered variants
- **Repair**: 2 numbered variants
- **System Repair**: 8 numbered variants
- **Titanic Actions**: 6 numbered variants

These likely need contextual names based on the entity that uses them.
