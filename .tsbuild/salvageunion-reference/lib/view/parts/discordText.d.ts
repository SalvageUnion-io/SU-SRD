/** Small text helpers for the Discord card (`discordCard.ts`). */
/** "Chassis Repair (Fabrication Arm)" inside Fabrication Arm → "Chassis Repair". */
export declare function stripOwnerSuffix(name: string, ownName: string): string;
/** The first number of a range key: "11-19" → 11. */
export declare function rangeStart(key: string): number;
