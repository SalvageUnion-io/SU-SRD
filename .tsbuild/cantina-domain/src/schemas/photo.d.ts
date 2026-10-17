import { z } from 'salvageunion-reference/zod';
/**
 * A player entity's own picture — the `photo` field every entity a player
 * builds carries (pilot, mech, mech pattern, crawler, built NPC).
 *
 * A photo REPLACES the entity's default art where it has one (a mech's
 * chassis, a pattern's chassis, a built NPC's template) and makes room for a
 * picture where it has none. Removing it removes the field; the server then
 * deletes the file once no entity still points at it (`convex/photos.ts`).
 *
 * Two kinds, because two things put a picture on an entity:
 *
 *   - `upload` — the player's own image, in Convex file storage. `url` is the
 *     storage URL the server handed back when the upload was claimed; it stays
 *     valid until the file is deleted, so every reader (the sheet, a crewmate's
 *     view, the public sheet) renders it without a query. The server checks it
 *     against `storageId` on every write, so a body cannot point an `<img>`
 *     anywhere else.
 *   - `asset` — licensed artwork on the CDN, by object key. The Starter Set
 *     crew carry their portraits this way, and a copy keeps it.
 *
 * Optional on every schema that takes it (`photoFields`): absent reads as no
 * photo.
 */
export declare const PhotoSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    kind: z.ZodLiteral<"upload">;
    storageId: z.ZodString;
    url: z.ZodString;
}, z.core.$strict>, z.ZodObject<{
    kind: z.ZodLiteral<"asset">;
    path: z.ZodString;
}, z.core.$strict>], "kind">;
export type Photo = z.infer<typeof PhotoSchema>;
/** The `photo` field, spread into each schema that carries one. */
export declare const photoFields: {
    photo: z.ZodOptional<z.ZodDiscriminatedUnion<[z.ZodObject<{
        kind: z.ZodLiteral<"upload">;
        storageId: z.ZodString;
        url: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodLiteral<"asset">;
        path: z.ZodString;
    }, z.core.$strict>], "kind">>;
};
/** Where a photo is served from. */
export declare function photoUrl(photo: Photo): string;
/** The storage id a body's photo holds, if it is an upload — what the server counts references by. */
export declare function uploadedPhotoId(body: unknown): string | undefined;
