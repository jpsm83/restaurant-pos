/**
 * route — NextAuth API route handler (catch-all)
 *
 * Exposes NextAuth at /api/auth/* (signin, signout, callback, session, etc.)
 * by delegating GET and POST to the same NextAuth handler configured in options.
 * Necessary so the app has a single auth API endpoint that NextAuth and the
 * client SDK (e.g. signIn(), getSession()) can call.
 */

import NextAuth from "next-auth"
import { options } from "./options"

const handler = NextAuth(options);

/** NextAuth uses GET (e.g. session, providers) and POST (e.g. signin, signout). */
export { handler as GET, handler as POST }