/**
 * An entity as DISCORD MARKDOWN — the one renderer for both places an entity
 * reaches Discord: the bot's `/su lookup` card, and the Component Embed the
 * SRD puts in each page's head, which Discord draws when someone pastes a
 * salvageunion.io link. One renderer, so a pasted link and a lookup can never
 * disagree (`docs/ARCHITECTURE.md#discord-bot`).
 *
 * Pure, and fed by the model (`toEntityModel`): no fact is computed here. A
 * colour stays a tone KEY, as everywhere in the view model; each consumer maps
 * it to the `0xRRGGBB` Discord wants.
 *
 * Discord paints one colour per message (the accent stripe) and none inside
 * text, so the book's devices become type and punctuation:
 *
 * - a parent → a `-#` caps kicker (`PATTERN OF MULE`), never the entity's kind;
 * - the head → `## Name` as a link to its page, an ability's tier numeral first;
 * - the chips under it, one head group in E17's order: the action type as the
 *   book prints it, the facts label first and spelled out
 *   (`**Structure Points** 12`, three to a line), the traits as linked tags with their
 *   parameter, then the cost last (`` `1 AP` ``, the book's pointy box);
 *   a class's ability limit, then the classes it advances into as links;
 * - a table → `ROLL THE DIE:` over one banded row per line;
 * - children → a counted stamp over linked names (E6: a link, never a card).
 */
import type { EntityModel, EntityRef } from './types';
/** One block of a Discord container, in render order. */
export type DiscordBlock = {
    kind: 'text';
    content: string;
} | {
    kind: 'separator';
} | {
    kind: 'section';
    /** 1–3 text blocks, Discord's own limit. */
    text: string[];
    thumbnail?: {
        url: string;
        description: string;
    };
};
/** A rendered card: the tone key for the accent, and its blocks. */
export type DiscordCard = {
    tone: string;
    blocks: DiscordBlock[];
};
/** A row of a table, ready to print: its range and its line. */
type DiscordTableRow = {
    key: string;
    line: string;
};
/** An action band inside a card, and the table it rolls on, if any. */
type DiscordAction = {
    name: string;
    text: string;
    tableName?: string;
};
/** A group of nested entities: its stamp, and the names as links. */
type DiscordChildGroup = {
    label: string;
    count: number;
    line: string;
    items: EntityRef[];
};
/** Everything a card can show, rendered; consumers choose and order. */
export type DiscordCardParts = {
    tone: string;
    url?: string;
    /** The identity band: kicker, title, value cells, traits. */
    head: string[];
    thumbnail?: {
        url: string;
        description: string;
    };
    /** Paragraphs and lists, each its own string. */
    prose: string[];
    actions: DiscordAction[];
    table?: {
        name: string;
        rows: DiscordTableRow[];
        note?: string;
    };
    children: DiscordChildGroup[];
    /** Entries the head links: the classes a class advances into. */
    headLinks: EntityRef[];
    /** The foot citation, as a `-#` line. */
    cite: string;
};
/**
 * Body text with its `[[Trait]]` and `[[[Trait] (2)]]` references as links. The
 * grammar is `replaceTraitReferences`'s; an unknown name stays plain text.
 */
export declare function linkTraitReferences(text: string): string;
/** A range as the book sets it: "11-19" → "11–19". */
export declare function rangeLabel(key: string): string;
/** `Workshop Manual · p.100 · Also in … (PC) · p.12`: the book, then its reprints. */
export declare function discordCiteLine(model: EntityModel): string;
/**
 * Render every part of a model. `entity` is the record the model came from:
 * a chassis's prose names itself through a `[(CHASSIS)]` placeholder.
 */
export declare function discordCardParts(model: EntityModel): DiscordCardParts;
/** Which parts to draw, and the test a rendered card must pass. */
export type DiscordCardOptions = {
    /** Mark this row of the table as the one rolled (`11-19`). */
    markedRow?: string;
    /** A line printed under the marked row ("ROLLED 14 · Alex"). */
    markedNote?: string;
    /** Fits the budget? Parts are shed from the end until it does. */
    fits?: (card: DiscordCard) => boolean;
};
/**
 * Assemble a card from its parts and shed it to fit: children first, then
 * actions from the end, then the table, then prose from the end. A shed card
 * says so and links the page, so nothing is lost, only moved. Whole parts go,
 * never half a sentence; the head and the cite always stay.
 *
 * A table goes WHOLE: a long one is read on its page ("See the whole table"),
 * never cut to its top rows. The one exception is a table with a rolled row
 * (`markedRow`), which keeps that row and sheds the others from the end.
 */
export declare function discordCard(parts: DiscordCardParts, options?: DiscordCardOptions): DiscordCard;
export {};
