'use client'

/**
 * AuthProvider — Client-side session context for the app
 *
 * Wraps the NextAuth SessionProvider so children can use useSession(), signIn(),
 * signOut(), etc. Delays rendering until after mount to avoid hydration
 * mismatches (session is not available during SSR in the same way as on client).
 * Necessary so any component in the tree can access auth state without prop drilling.
 */

import { SessionProvider } from 'next-auth/react'
import { useState, useEffect } from "react";

/**
 * Renders children inside SessionProvider only after client mount, to prevent
 * server/client markup mismatch when session is read.
 */
export default function AuthProviders({ children }: { children: React.ReactNode }) {
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  /** Avoid rendering session-dependent UI until client has mounted. */
  if (!hasMounted) return null;

  return (
    <SessionProvider>
      {children}
    </SessionProvider>
  )
}