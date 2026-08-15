/** Diagnostic probe — NOT for merge. Isolates having a NAMED export alongside
 * the default, which is the shape every snapshot function has.
 * @public Netlify Functions handler: invoked by the platform, never imported.
 */
export function makeSomeHandler(x: string): string {
  return x
}

/** @public */
export default async function (req: Request): Promise<Response> {
  return new Response(`named+default ok: ${makeSomeHandler(req.method)}`)
}
