/**
 * Zod enum schemas from enums.schema.json
 */
import { z } from '../zod';
/**
 * The source book or expansion for this content
 */
export declare const SourceSchema: z.ZodEnum<{
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
/**
 * Type of content block for rendering structured text
 */
export declare const ContentTypeSchema: z.ZodEnum<{
    choice: "choice";
    datavalues: "datavalues";
    flavor: "flavor";
    heading: "heading";
    hint: "hint";
    label: "label";
    "list-item": "list-item";
    paragraph: "paragraph";
}>;
/**
 * Individual range value
 */
export declare const RangeItemSchema: z.ZodEnum<{
    Close: "Close";
    Far: "Far";
    Long: "Long";
    Medium: "Medium";
}>;
/**
 * Range bands for abilities and weapons
 */
export declare const RangeSchema: z.ZodArray<z.ZodEnum<{
    Close: "Close";
    Far: "Far";
    Long: "Long";
    Medium: "Medium";
}>>;
/**
 * Type of action required to use an ability
 */
export declare const ActionTypeSchema: z.ZodEnum<{
    DownTime: "DownTime";
    Free: "Free";
    Long: "Long";
    Passive: "Passive";
    Reaction: "Reaction";
    Short: "Short";
    Turn: "Turn";
}>;
/**
 * Type of damage
 */
export declare const DamageTypeSchema: z.ZodEnum<{
    HP: "HP";
    SP: "SP";
}>;
/**
 * Ability tree name
 */
export declare const TreeSchema: z.ZodEnum<{
    "Advanced Engineer": "Advanced Engineer";
    "Advanced Hacking": "Advanced Hacking";
    "Advanced Hauler": "Advanced Hauler";
    "Advanced Scout": "Advanced Scout";
    "Advanced Soldier": "Advanced Soldier";
    Augmentation: "Augmentation";
    Cyborg: "Cyborg";
    Electronics: "Electronics";
    Fabricator: "Fabricator";
    Forging: "Forging";
    Generic: "Generic";
    "Gladiatorial Combat": "Gladiatorial Combat";
    Hacking: "Hacking";
    Leadership: "Leadership";
    "Legendary Cyborg": "Legendary Cyborg";
    "Legendary Engineer": "Legendary Engineer";
    "Legendary Fabricator": "Legendary Fabricator";
    "Legendary Hacker": "Legendary Hacker";
    "Legendary Hauler": "Legendary Hauler";
    "Legendary Ranger": "Legendary Ranger";
    "Legendary Scout": "Legendary Scout";
    "Legendary Smuggler": "Legendary Smuggler";
    "Legendary Soldier": "Legendary Soldier";
    "Legendary Union Rep": "Legendary Union Rep";
    "Mech-Tech": "Mech-Tech";
    "Mechanical Knowledge": "Mechanical Knowledge";
    Ranger: "Ranger";
    Recon: "Recon";
    Salvaging: "Salvaging";
    Sleuth: "Sleuth";
    Smuggler: "Smuggler";
    Sniper: "Sniper";
    Survivalist: "Survivalist";
    "Tactical Warfare": "Tactical Warfare";
    Trading: "Trading";
    "Union Rep": "Union Rep";
}>;
/**
 * Name of the schema
 */
export declare const SchemaNameSchema: z.ZodEnum<{
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
}>;
