/**
 * Reprint provenance: where else a record appears besides its primary source.
 */
import { z } from '../../zod';
/**
 * Reprint of an entity in a secondary source book
 *
 * `booklet` is optional and used when a source is a multi-booklet product
 * (e.g. the Salvage Union Starter Set, which uses CR / PH / PC / RR / AP codes
 * for its Core Rulebook / Pilots Handbook / Parts Catalogue / Rules Reference / Asset Pack).
 * Single-volume sources omit it.
 */
export declare const AdditionalSourceSchema: z.ZodObject<{
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
    booklet: z.ZodOptional<z.ZodString>;
    page: z.ZodNumber;
}, z.core.$strict>;
