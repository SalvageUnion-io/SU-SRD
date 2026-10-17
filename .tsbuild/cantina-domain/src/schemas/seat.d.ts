import { z } from 'salvageunion-reference/zod';
/**
 * A pilot's seat at a Game: the Dashboard's play state, shared with the crew
 * and saved on the Game
 * ([ADR-038](../../../../docs/adr/038-dashboard-game-surface.md) §2).
 *
 * One seat per pilot, not per member: a member covering for an absent player
 * runs two. A seat points at its pilot and boarded mech by app id, the way
 * soft-link ends do, and is never a field on either record. That keeps mount
 * state out of sheets and public sheets.
 *
 * This is the source of truth for `seats` in `apps/web/convex/schema.ts`: its
 * range, mount and resolve validators are built from the schemas below
 * (`zodToConvex`), and the row is checked against `Seat` when it compiles.
 *
 * "In Downtime" is deliberately absent: it is the Game's `downtime` row, not
 * per-seat state. The deck action being resolved is on it, as an optional
 * field, so a reload mid-roll keeps the roll and the crew watches it live.
 */
/** Self-declared engagement range band. */
export declare const RANGE_BANDS: readonly ['Close', 'Medium', 'Long', 'Far'];
declare const RangeBandSchema: z.ZodEnum<{
    Close: "Close";
    Far: "Far";
    Long: "Long";
    Medium: "Medium";
}>;
export type RangeBand = z.infer<typeof RangeBandSchema>;
/** On foot, or boarded in one mech (by app id). */
declare const SeatMountSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    kind: z.ZodLiteral<"foot">;
}, z.core.$strip>, z.ZodObject<{
    kind: z.ZodLiteral<"boarded">;
    mechId: z.ZodString;
}, z.core.$strip>], "kind">;
export type SeatMount = z.infer<typeof SeatMountSchema>;
/** The Core Mechanic's five bands, as `salvageunion-reference/rules` names them. */
export declare const CORE_ROLL_BAND_NAMES: readonly ['nailed', 'success', 'tough', 'failure', 'cascade'];
/**
 * The deck action in progress: which one, and how far the player has got.
 *
 * `ref` is the deck's key for the action and `name` what the crew reads
 * ("Rook is resolving Crush"). Activating, rolling and applying are separate
 * flags because the flow is not a line: a player may roll before activating,
 * and Push replaces the roll. The rest of a resolve (a Hot X, the EP-or-AP
 * choice) stays on the screen that is showing it.
 */
declare const SeatResolvingSchema: z.ZodObject<{
    ref: z.ZodString;
    name: z.ZodString;
    activated: z.ZodBoolean;
    roll: z.ZodOptional<z.ZodObject<{
        roll: z.ZodNumber;
        band: z.ZodEnum<{
            cascade: "cascade";
            failure: "failure";
            nailed: "nailed";
            success: "success";
            tough: "tough";
        }>;
    }, z.core.$strip>>;
    applied: z.ZodBoolean;
}, z.core.$strip>;
export type SeatResolving = z.infer<typeof SeatResolvingSchema>;
export declare const SeatSchema: z.ZodObject<{
    gameId: z.ZodString;
    pilotId: z.ZodString;
    mount: z.ZodDiscriminatedUnion<[z.ZodObject<{
        kind: z.ZodLiteral<"foot">;
    }, z.core.$strip>, z.ZodObject<{
        kind: z.ZodLiteral<"boarded">;
        mechId: z.ZodString;
    }, z.core.$strip>], "kind">;
    range: z.ZodEnum<{
        Close: "Close";
        Far: "Far";
        Long: "Long";
        Medium: "Medium";
    }>;
    activeEffects: z.ZodArray<z.ZodString>;
    resolving: z.ZodOptional<z.ZodObject<{
        ref: z.ZodString;
        name: z.ZodString;
        activated: z.ZodBoolean;
        roll: z.ZodOptional<z.ZodObject<{
            roll: z.ZodNumber;
            band: z.ZodEnum<{
                cascade: "cascade";
                failure: "failure";
                nailed: "nailed";
                success: "success";
                tough: "tough";
            }>;
        }, z.core.$strip>>;
        applied: z.ZodBoolean;
    }, z.core.$strip>>;
    ejected: z.ZodOptional<z.ZodBoolean>;
    updatedAt: z.ZodNumber;
}, z.core.$strip>;
export type Seat = z.infer<typeof SeatSchema>;
export {};
