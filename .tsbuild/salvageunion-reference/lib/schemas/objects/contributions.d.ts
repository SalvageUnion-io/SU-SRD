/**
 * Contributions (ADR-029): the NUMERIC half of the converged "what does this
 * record change" model — a flat mechanical change to a named stat on a named
 * target. The trait/damage/range half lives in `effects.ts`.
 */
import { z } from '../../zod';
/**
 * The stats a contribution may raise or lower (ADR-029).
 *
 * A superset of the four mech core maxima: an ability can change a
 * PILOT stat (Bionic Legs "+2 Max HP", Beefcake "+4 Inventory Capacity") or a
 * slot COUNT (Modular Face Implant "your Pilot gains a Module Slot"), neither of
 * which the mech-only shape could express.
 */
export declare const ContributionStatSchema: z.ZodEnum<{
    cargoCapacity: "cargoCapacity";
    energyPoints: "energyPoints";
    heatCapacity: "heatCapacity";
    inventorySlots: "inventorySlots";
    maxAp: "maxAp";
    maxHp: "maxHp";
    moduleSlots: "moduleSlots";
    structurePoints: "structurePoints";
    systemSlots: "systemSlots";
}>;
/**
 * Whose stat a contribution changes.
 *
 * `self` is the host the contribution is declared on (a system contributing to
 * its own mech). The others exist because Beefcake is a PILOT ability that
 * raises the piloted MECH's Max SP and Cargo while also raising the pilot's own
 * Max HP and Inventory — one record, two targets, which no single-target shape
 * could express.
 */
export declare const ContributionTargetSchema: z.ZodEnum<{
    crawler: "crawler";
    pilot: "pilot";
    pilotedMech: "pilotedMech";
    self: "self";
}>;
/**
 * How much a contribution is worth.
 *
 * A plain integer covers most records. `perTechLevel` exists for Beefcake —
 * "increases its Max Structure Points by 3+X (where X is the Mech's Tech
 * Level)" — where the amount is `flat + perTechLevel × techLevel`. Rendering the
 * amount needs the target's tech level, so a consumer that cannot supply one
 * resolves `perTechLevel` to 0 rather than guessing.
 */
export declare const ContributionAmountSchema: z.ZodUnion<readonly [z.ZodNumber, z.ZodObject<{
    flat: z.ZodOptional<z.ZodNumber>;
    perTechLevel: z.ZodNumber;
}, z.core.$strict>, z.ZodObject<{
    fromStat: z.ZodEnum<{
        cargoCapacity: "cargoCapacity";
        energyPoints: "energyPoints";
        heatCapacity: "heatCapacity";
        inventorySlots: "inventorySlots";
        maxAp: "maxAp";
        maxHp: "maxHp";
        moduleSlots: "moduleSlots";
        structurePoints: "structurePoints";
        systemSlots: "systemSlots";
    }>;
}, z.core.$strict>]>;
/**
 * A single mechanical contribution a piece of content makes to a stat
 * (ADR-029).
 *
 * This is the numeric half of the converged model. The trait/damage/range half
 * already exists as `ChoiceEffectSchema` and is applied by `resolveChoiceView`;
 * the two are declared side by side rather than merged into one union, because
 * they are resolved at different layers — stats at derivation time, effects at
 * dataview time.
 *
 * **Never infer a contribution from prose.** Populate it only where the rules
 * text states a flat mechanical change; anything conditional, prose-only, or
 * duration-bound stays undeclared and is answered to the parity audit with an
 * explicit exemption instead.
 */
export declare const ContributionSchema: z.ZodObject<{
    stat: z.ZodEnum<{
        cargoCapacity: "cargoCapacity";
        energyPoints: "energyPoints";
        heatCapacity: "heatCapacity";
        inventorySlots: "inventorySlots";
        maxAp: "maxAp";
        maxHp: "maxHp";
        moduleSlots: "moduleSlots";
        structurePoints: "structurePoints";
        systemSlots: "systemSlots";
    }>;
    amount: z.ZodUnion<readonly [z.ZodNumber, z.ZodObject<{
        flat: z.ZodOptional<z.ZodNumber>;
        perTechLevel: z.ZodNumber;
    }, z.core.$strict>, z.ZodObject<{
        fromStat: z.ZodEnum<{
            cargoCapacity: "cargoCapacity";
            energyPoints: "energyPoints";
            heatCapacity: "heatCapacity";
            inventorySlots: "inventorySlots";
            maxAp: "maxAp";
            maxHp: "maxHp";
            moduleSlots: "moduleSlots";
            structurePoints: "structurePoints";
            systemSlots: "systemSlots";
        }>;
    }, z.core.$strict>]>;
    target: z.ZodOptional<z.ZodEnum<{
        crawler: "crawler";
        pilot: "pilot";
        pilotedMech: "pilotedMech";
        self: "self";
    }>>;
    stacks: z.ZodOptional<z.ZodBoolean>;
    voidWhen: z.ZodOptional<z.ZodEnum<{
        damaged: "damaged";
        destroyed: "destroyed";
    }>>;
    duration: z.ZodOptional<z.ZodEnum<{
        activated: "activated";
        permanent: "permanent";
    }>>;
    note: z.ZodOptional<z.ZodString>;
}, z.core.$strict>;
