/**
 * Effects (ADR-029): the TRAIT/DAMAGE/RANGE half of the converged "what does
 * this record change" model, applied at dataview time by `resolveChoiceView`.
 * The numeric half lives in `contributions.ts`.
 */
import { z } from '../../zod';
/**
 * Whose state an effect changes (ADR-029).
 *
 * `self` — the record declaring it — was the only target the model had, and THAT
 * was the blocker, not the declaration site. Bio-Wings says "YOUR MECH gains the
 * Fly Trait": declared as a self-effect it would say the Bio-Wings *system*
 * flies, which is wrong rather than merely incomplete.
 */
export declare const EffectTargetSchema: z.ZodEnum<{
    hostMech: "hostMech";
    self: "self";
}>;
/**
 * A single mechanical effect of a choice option, discriminated by `op` so each
 * operation only permits the fields it actually uses (no `removeTrait` with an
 * `amount`, no `addDamage` with an `amount`, etc.):
 *
 * - `addTrait`    — add a trait by name; optional `amount` is its magnitude
 *                   (e.g. Burn 1). Adding a trait that already exists upgrades it.
 * - `removeTrait` — strip a trait by name.
 * - `setRange`    — replace the Range datavalue.
 * - `addDamage`   — increase the Damage datavalue; optional `unit` (e.g. "SP").
 */
export declare const ChoiceEffectSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    op: z.ZodLiteral<"addTrait">;
    value: z.ZodString;
    amount: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
    target: z.ZodOptional<z.ZodEnum<{
        hostMech: "hostMech";
        self: "self";
    }>>;
}, z.core.$strict>, z.ZodObject<{
    op: z.ZodLiteral<"removeTrait">;
    value: z.ZodString;
    target: z.ZodOptional<z.ZodEnum<{
        hostMech: "hostMech";
        self: "self";
    }>>;
}, z.core.$strict>, z.ZodObject<{
    op: z.ZodLiteral<"setRange">;
    value: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
}, z.core.$strict>, z.ZodObject<{
    op: z.ZodLiteral<"addDamage">;
    value: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
    unit: z.ZodOptional<z.ZodString>;
}, z.core.$strict>], "op">;
