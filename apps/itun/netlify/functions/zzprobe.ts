/** Diagnostic probe — NOT for merge.
 * @public Netlify Functions handler: invoked by the platform, never imported.
 */
export default async function (): Promise<Response> {
  return new Response('hello from a v2 function')
}
