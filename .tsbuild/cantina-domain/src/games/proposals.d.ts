/**
 * Proposals, as both ends of propose-and-confirm read them (ADR-030 §4,
 * docs/architecture/mediator-dashboard.md Q8).
 *
 * Shared by the server (`convex/proposals.ts` reads the reason cap) and the
 * Mediator's surfaces (the propose dock, the Proposals tab, the Game page's
 * "Proposals you sent"), so the field names, their labels and the state words
 * are one list. Pure: no React, no Convex.
 */
/** How many proposals one page of a sent list adds. */
export declare const PROPOSALS_PAGE = 20;
/** The longest reason a proposal may carry, after trimming. */
export declare const PROPOSAL_REASON_MAX = 140;
/**
 * The live-play fields a Mediator may propose a change to, per target kind.
 *
 * **These are Zod field names and the casing is load-bearing**: `currentHp`
 * names nothing on `PilotSchema`, and `proposals.apply` parses the merged body
 * and refuses a field the schema has no room for.
 */
export declare const PROPOSAL_FIELDS: {
    readonly pilot: readonly [{
        readonly field: 'currentHP';
        readonly label: 'HP';
    }, {
        readonly field: 'currentAP';
        readonly label: 'AP';
    }];
    readonly mech: readonly [{
        readonly field: 'currentSP';
        readonly label: 'SP';
    }, {
        readonly field: 'currentHeat';
        readonly label: 'Heat';
    }];
};
type ProposalTargetKind = keyof typeof PROPOSAL_FIELDS;
export type ProposalField = (typeof PROPOSAL_FIELDS)[ProposalTargetKind][number]['field'];
/** "HP" for `currentHP`; an unknown field reads as itself. */
export declare function fieldLabel(field: string): string;
/** A proposal's state, in words. `proposed` reads Pending. */
export declare const PROPOSAL_STATE_WORD: {
    readonly proposed: 'Pending';
    readonly applied: 'Applied';
    readonly declined: 'Declined';
    readonly superseded: 'Superseded';
};
/**
 * The reason as it is stored: trimmed, and absent when blank. Throws past the
 * cap rather than cutting, so nobody's words are silently shortened.
 */
export declare function normalizeReason(reason: string | undefined): string | undefined;
/** One field on one target: what it holds now, and its derived maximum. */
type TargetReading = {
    current: number | null;
    max: number | null;
};
/** Something a proposal can be aimed at: a claimed pilot or mech. */
export type ProposalTarget = {
    /** The Convex row id `proposals.propose` addresses it by. */
    id: string;
    kind: ProposalTargetKind;
    /** "Pickle", or a mech by its pilot: "Pickle's Spectrum". */
    label: string;
    /** The pilot this target belongs to, so a seat card can pick it. */
    pilotLinkId: string | null;
    readings: Partial<Record<ProposalField, TargetReading>>;
};
/** The slice of `crew.vitals` the targets are built from. */
export type TargetCrew = {
    pilots: ReadonlyArray<{
        _id: string;
        linkId: string | null;
        ownerId: string | null;
        name: string;
        mechId: string | null;
        currentHP: number | null;
        maxHP: number | null;
        currentAP: number | null;
        maxAP: number | null;
    }>;
    mechs: ReadonlyArray<{
        _id: string;
        linkId: string | null;
        ownerId: string | null;
        name: string;
        currentSP: number | null;
        maxSP: number | null;
        currentHeat: number | null;
        maxHeat: number | null;
    }>;
};
/**
 * Every pilot and mech somebody can answer for, pilots first.
 *
 * Unclaimed ones are left out: a proposal needs an owner to apply or decline
 * it, and the server refuses one with none. A mech is labelled by the pilot it
 * is assigned to, because that is who the Mediator is looking at.
 */
export declare function proposalTargets(crew: TargetCrew | null): ProposalTarget[];
/**
 * The value a proposal asks for, as a whole number from 0 to the field's
 * maximum (when it is known). Null for anything that is not a number.
 */
export declare function clampProposalValue(raw: string, max: number | null): number | null;
export {};
