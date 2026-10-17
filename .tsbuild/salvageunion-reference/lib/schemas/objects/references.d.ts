/**
 * Cross-record references — the shapes one record uses to point at another:
 * an ability's grant, a faction formation member, and the schema-name
 * vocabulary that admits `actions` alongside the entity schemas.
 */
import { z } from '../../zod';
/**
 * Formation member schema
 * Supports chassis+pattern combos and standalone entities (vehicles, drones, squads, npcs)
 */
export declare const FormationMechSchema: z.ZodObject<{
    chassis: z.ZodString;
    pattern: z.ZodOptional<z.ZodString>;
    schema: z.ZodOptional<z.ZodEnum<{
        abilities: "abilities";
        "ability-tree-requirements": "ability-tree-requirements";
        "bio-titans": "bio-titans";
        chassis: "chassis";
        classes: "classes";
        "crawler-bays": "crawler-bays";
        "crawler-tech-levels": "crawler-tech-levels";
        crawlers: "crawlers";
        creatures: "creatures";
        distances: "distances";
        drones: "drones";
        equipment: "equipment";
        factions: "factions";
        guides: "guides";
        keywords: "keywords";
        meld: "meld";
        modules: "modules";
        npcs: "npcs";
        "roll-tables": "roll-tables";
        sources: "sources";
        squads: "squads";
        systems: "systems";
        "tech-levels": "tech-levels";
        traits: "traits";
        vehicles: "vehicles";
    }>>;
    source: z.ZodEnum<{
        "False Flag": "False Flag";
        "Mech Monday": "Mech Monday";
        Rainmaker: "Rainmaker";
        "Reclamation of the Wastes": "Reclamation of the Wastes";
        "Relics of a Time Gone By": "Relics of a Time Gone By";
        "Salvage Union Starter Set": "Salvage Union Starter Set";
        "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
        "Thatcher's Mech Base": "Thatcher's Mech Base";
        "The Hive": "The Hive";
        "We Were Here First!": "We Were Here First!";
    }>;
    page: z.ZodNumber;
    quantity: z.ZodOptional<z.ZodNumber>;
}, z.core.$strict>;
/**
 * Grant schema
 */
export declare const GrantSchema: z.ZodObject<{
    schema: z.ZodUnion<readonly [z.ZodEnum<{
        abilities: "abilities";
        "ability-tree-requirements": "ability-tree-requirements";
        "bio-titans": "bio-titans";
        chassis: "chassis";
        classes: "classes";
        "crawler-bays": "crawler-bays";
        "crawler-tech-levels": "crawler-tech-levels";
        crawlers: "crawlers";
        creatures: "creatures";
        distances: "distances";
        drones: "drones";
        equipment: "equipment";
        factions: "factions";
        guides: "guides";
        keywords: "keywords";
        meld: "meld";
        modules: "modules";
        npcs: "npcs";
        "roll-tables": "roll-tables";
        sources: "sources";
        squads: "squads";
        systems: "systems";
        "tech-levels": "tech-levels";
        traits: "traits";
        vehicles: "vehicles";
    }>, z.ZodLiteral<"choice">]>;
    name: z.ZodString;
}, z.core.$strict>;
/**
 * Schema name (includes 'actions' as special case)
 */
export declare const SchemaNameWithActionsSchema: z.ZodUnion<readonly [z.ZodEnum<{
    abilities: "abilities";
    "ability-tree-requirements": "ability-tree-requirements";
    "bio-titans": "bio-titans";
    chassis: "chassis";
    classes: "classes";
    "crawler-bays": "crawler-bays";
    "crawler-tech-levels": "crawler-tech-levels";
    crawlers: "crawlers";
    creatures: "creatures";
    distances: "distances";
    drones: "drones";
    equipment: "equipment";
    factions: "factions";
    guides: "guides";
    keywords: "keywords";
    meld: "meld";
    modules: "modules";
    npcs: "npcs";
    "roll-tables": "roll-tables";
    sources: "sources";
    squads: "squads";
    systems: "systems";
    "tech-levels": "tech-levels";
    traits: "traits";
    vehicles: "vehicles";
}>, z.ZodLiteral<"actions">]>;
