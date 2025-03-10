'use client'

// this provider will wrap all the aplication given children access to the session
// this is a custom provider that wraps the next-auth/react SessionProvider
import { SessionProvider } from 'next-auth/react'
import { useState, useEffect } from "react";

export default function AuthProviders({ children }: { children: React.ReactNode }) {
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  if (!hasMounted) return null;

  return (
    <SessionProvider>
      {children}
    </SessionProvider>
  )
}