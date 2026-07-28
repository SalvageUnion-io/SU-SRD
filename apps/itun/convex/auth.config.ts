/**
 * Auth provider config consumed by Convex when validating identity tokens.
 * CONVEX_SITE_URL is injected by Convex itself — do not set it by hand.
 */
export default {
  providers: [
    {
      domain: process.env.CONVEX_SITE_URL,
      applicationID: 'convex',
    },
  ],
}
