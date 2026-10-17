/**
 * inkBox — where a piece of line art sits on its canvas, for `tools/art-crop.ts`.
 * Pure, so the measurement is testable without fetching licensed artwork.
 */
/** The ink's box as fractions of the canvas, then its own aspect ratio in pixels. */
export type Box = readonly [x: number, y: number, w: number, h: number, aspect: number];
/**
 * The ink's bounding box in RGBA pixels (`width` × `height`, four bytes each)
 * as [x, y, w, h] fractions of the canvas and its pixel aspect ratio, or null
 * when every pixel is transparent or paper.
 */
export declare function inkBox(px: Uint8Array, width: number, height: number): Box | null;
