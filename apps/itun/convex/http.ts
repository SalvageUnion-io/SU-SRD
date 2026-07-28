import { httpRouter } from 'convex/server'

import { auth } from './auth'

/**
 * HTTP routes for the deployment. `auth.addHttpRoutes` mounts the OAuth
 * callback endpoints that Discord redirects back to — without this, sign-in
 * starts but can never complete.
 */
const http = httpRouter()

auth.addHttpRoutes(http)

export default http
