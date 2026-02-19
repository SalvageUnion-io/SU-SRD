# Phase 4 — Crawler + Campaign Management + CRUD

## Scope

Crawler creation wizard, crawler detail view with bay management, campaign creation and management, and pilot-to-crawler assignment.

**What ships:**

- Crawler creation wizard ("Create a Crawler" — 4 interactive steps including NPC naming)
- Crawler detail view (all 10 mandatory bays, NPCs, structure points, tech level)
- Campaign creation and basic management
- Campaign-crawler association
- Pilot-to-crawler assignment (a pilot can only belong to one crawler at a time)
- Crawler editing after creation (NPC names, weapon system, crawler name, notes)
- Dashboard crawler and campaign sections

**What does NOT ship:**

- User invites, role management, archiving (Phase 5)
- Live editing, change tracking, real-time, downtime (Phase 6)

---

## User Stories

### Crawler

- **US-C1**: As a player, I can create a crawler using the "Create a Crawler" wizard, including naming all 10 bay NPCs.
- **US-C2**: As a player, I can view the crawler detail showing all 10 mandatory bays with NPC info, structure points, tech level, and assigned pilots.
- **US-C3**: As a player, I can edit my crawler's NPC names/details, weapon system, crawler name, and notes after creation.
- **US-C4**: As a player, I can assign one of my pilots to a crawler. Assigning a pilot to a new crawler automatically de-assigns it from any previous crawler.

### Crawler Storage & Scrap Inventory

- **US-C9**: As a player, I can manage items in the crawler's storage. Crawler storage is **functionally infinite** — there is no hard capacity limit.
- **US-C10**: As a player, items in crawler storage are visible to all assigned pilots.
- **US-C11**: As a player, I can view the crawler's **scrap inventory** broken down by tech level (TL1 through TL6). This is the communal budget that all assigned pilots draw from when upgrading their mechs.
- **US-C12**: As a player, I can **translate scrap** between tech levels on the crawler. Conversion rate: N units of TL1 scrap = 1 unit of TL N scrap (e.g., 3 TL1 = 1 TL3, 2 TL1 = 1 TL2). Translation works in both directions.
- **US-C13**: Scrap from salvaging (during downtime) is deposited into the crawler's scrap inventory at the appropriate tech level.

### Campaigns

- **US-C5**: As a user, I can create a campaign — I am automatically assigned as its Mediator.
- **US-C6**: As a Mediator, I can associate a crawler with the campaign.
- **US-C7**: As a campaign member, I can view the campaign's crawler and assigned pilots.
- **US-C8**: As a player, I can assign my pilot to the campaign's crawler.

---

## Crawler Creation Workflow (Guide: `crawler-creation`)

4 interactive steps (skipping 1 `paperOnly` step). All wizard steps render inside DisplayCard containers.

| Step | Name                                | Type         | Details                                                                             |
| ---- | ----------------------------------- | ------------ | ----------------------------------------------------------------------------------- |
| 1    | Choose a Crawler Type               | `select-one` | Schema: `crawlers`. All crawlers available.                                         |
| 2    | Choose a Weapons System             | `select-one` | TL1 weapon systems. Schema: `systems`. Filters: `techLevel=1`, `hasDamage=true`.    |
| 3    | Name the Crawler's NPCs             | `freeform`   | For each of the 10 mandatory bays, name the NPC (+ keepsake/motto choices per NPC). |
| 4    | Give your Crawler a Name and Number | `roll-table` | Roll table: "Crawler Name".                                                         |

**On completion**: Creates `crawlers` row + `entity_refs` for all 10 mandatory bays + weapon system + `player_choices` for NPC names/details + crawler name.

---

## 10 Mandatory Crawler Bays

From game data (`crawler-bays` schema):

1. **Command Bay** — Navigation and direction
2. **Mech Bay** — Mech storage and repairs
3. **Storage Bay** — Item storage and organization
4. **Armament Bay** — Weapons system (player chooses weapon at creation)
5. **Crafting Bay** — Build and modify mechs
6. **Trading Bay** — Trade with outsiders
7. **Med Bay** — Heal pilots, treat injuries
8. **Pilot Bay** — Pilot quarters and rest
9. **Armoury Bay** — Pilot equipment distribution
10. **Cantina Bay** — Rumors and information

Each bay has:

- An NPC with position, name, keepsake, motto, HP (4)
- Content describing the bay's function
- A `damagedEffect` describing what happens when the bay is damaged
- Some bays have additional choices (e.g., Armament Bay weapon selection)

### Custom Bays

The DB supports user-defined bays via `entity_refs` with `parent_type='crawler'` and `schema_name='crawler-bays'` + custom `metadata`. Not surfaced in UI in this phase.

---

## Crawler Detail View

The crawler detail view uses a **DisplayCard** as its primary container, consistent with all other major views in the app.

```
+----------------------------------------------+
| HEADER (bg-su-blue or crawler color)          |
| [Crawler type]  [Crawler name]   SP: 20/20   |
|                 Union Crawler    TL: 1        |
+----------------------------------------------+
|                                              |
| SCRAP INVENTORY                              |
| TL1: 15  TL2: 4  TL3: 0  TL4: 0  ...       |
| [Translate Scrap] button                     |
|                                              |
| ASSIGNED PILOTS                              |
| +----------+ +----------+ +----------+      |
| | Pilot 1  | | Pilot 2  | | Pilot 3  |      |
| | callsign | | callsign | | callsign |      |
| +----------+ +----------+ +----------+      |
|                                              |
| WEAPON SYSTEM                                |
| +----------------------------------------+  |
| | [Weapon entity display]                |  |
| +----------------------------------------+  |
|                                              |
| BAYS                                         |
| +----+ +----+ +----+ +----+ +----+          |
| |Cmd | |Mech| |Stor| |Arm | |Crft|          |
| |NPC | |NPC | |NPC | |NPC | |NPC |          |
| +----+ +----+ +----+ +----+ +----+          |
| +----+ +----+ +----+ +----+ +----+          |
| |Trad| |Med | |Pilt| |Armo| |Cant|          |
| |NPC | |NPC | |NPC | |NPC | |NPC |          |
| +----+ +----+ +----+ +----+ +----+          |
|                                              |
| STORAGE                                      |
| [cargo items list — functionally infinite]   |
|                                              |
+----------------------------------------------+
| FOOTER (matching header color)                |
| Upkeep: 5 scrap | Upgrade Pool: 0            |
+----------------------------------------------+
```

---

## Campaign Management (Basic)

### Campaign Creation

- User creates a campaign with a name
- Creator is automatically assigned as Mediator
- Campaign can optionally be associated with a crawler at creation or later

### Campaign-Crawler Association

- A campaign has at most one crawler
- Mediator can associate/disassociate a crawler
- Players assign pilots to the campaign's crawler

### Pilot Assignment Rules

- A pilot can only belong to **one crawler at a time**
- Assigning a pilot to a new crawler sets old `crawler_id` to null
- Only pilots owned by the user can be assigned

---

## Acceptance Criteria

### AC-1: Crawler Creation

- [ ] Wizard runs 4 interactive steps
- [ ] Crawler type selection shows all available crawlers
- [ ] Weapon system selection filters to TL1 with damage
- [ ] NPC naming step provides inputs for all 10 bay NPCs
- [ ] Roll table step for crawler name/number
- [ ] All wizard steps render inside DisplayCard containers
- [ ] On completion, creates crawler + entity_refs + player_choices

### AC-2: Crawler Detail

- [ ] Crawler detail displays in a DisplayCard with all 10 bays
- [ ] Each bay shows NPC name, position, keepsake, motto
- [ ] Weapon system displayed
- [ ] Assigned pilots listed
- [ ] Structure points and tech level visible

### AC-3: Crawler Editing

- [ ] NPC names/details editable
- [ ] Weapon system editable
- [ ] Crawler name and notes editable

### AC-4: Campaign Creation

- [ ] User can create a campaign with a name
- [ ] Creator is auto-assigned as Mediator
- [ ] Campaign can be associated with a crawler

### AC-5: Pilot Assignment

- [ ] Player can assign a pilot to a campaign's crawler
- [ ] Assigning de-assigns from any previous crawler
- [ ] Assigned pilots visible on crawler detail

### AC-6: Scrap Inventory

- [ ] Crawler detail shows scrap inventory per tech level
- [ ] "Translate Scrap" allows converting between TL levels (N TL1 = 1 TL N)
- [ ] Scrap from salvaging deposited at appropriate TL
- [ ] Crawler storage section shows cargo items

### AC-7: Dashboard

- [ ] Crawler section shows user's crawlers
- [ ] Campaign section shows user's campaigns
- [ ] "Create a Crawler" and "Create a Campaign" buttons
