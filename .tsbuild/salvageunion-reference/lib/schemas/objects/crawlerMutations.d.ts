/**
 * Crawler-type mutations: the rule modifiers a Union Crawler's type applies
 * (e.g. the Battle crawler's extra weapon slot and SP bonus).
 */
import { z } from '../../zod';
/**
 * A mutation applied by a crawler type that modifies game rules
 */
export declare const CrawlerMutationSchema: z.ZodObject<{
    type: z.ZodEnum<{
        max_sp_bonus: "max_sp_bonus";
        weapon_slots: "weapon_slots";
    }>;
    value: z.ZodNumber;
}, z.core.$strict>;
