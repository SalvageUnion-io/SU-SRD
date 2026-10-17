/**
 * An entry's ONE Discord card: what the bot's `/su lookup` sends and what the
 * SRD's Component Embed draws when someone pastes the entry's link. Both call
 * `discordEntryCard`, so the two are the same blocks, shed to the same budget
 * (`docs/ARCHITECTURE.md#discord-bot`).
 *
 * The budget is the tighter of the two surfaces: Discord's 3,000 bytes for a
 * Component Embed's JSON, measured as the SRD serves it (`<` escaped). A card
 * that fits it is also well inside a bot message's 4,000 characters of text, so
 * the bot never sheds a part the pasted link keeps, or keeps one it sheds.
 *
 * A pattern's card (a chassis or Bio-Titan pattern) is the same card for its
 * own page and its own lookup: patterns are entries in their own right, which
 * a chassis's card only links by name.
 */
import type { RefMetaEntity, RefObjectAnyPattern } from '../schemas/index';
import type { DiscordCard } from './discordCard';
/** Discord's ceiling for a Component Embed's whole payload, in UTF-8 bytes. */
export declare const COMPONENT_EMBED_MAX_BYTES = 3000;
/** A card as a Component Embed's JSON: one Container, its accent the card's tone. */
export declare function componentEmbedJson(card: DiscordCard): string;
/**
 * A Component Embed's size as served: the SRD escapes each `<` in the JSON as
 * `<` before it goes in the page's `<script>`, which adds five bytes each.
 */
export declare function componentEmbedBytes(json: string): number;
/** Where an entry card's SRD links point; production's site unless given. */
type DiscordEntryCardOptions = {
    /** The SRD origin to link, without a trailing slash: a Worker Preview's, say. */
    srdOrigin?: string;
};
/**
 * An entry's (or one of its patterns') Discord card, shed to the shared budget.
 * With `srdOrigin`, its links point there, and the budget is measured on those
 * links, since a longer origin can shed a part production's keeps.
 */
export declare function discordEntryCard(entity: RefMetaEntity, pattern?: RefObjectAnyPattern, options?: DiscordEntryCardOptions): DiscordCard;
export {};
