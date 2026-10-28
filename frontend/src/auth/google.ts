/**
 * Google sign-in configuration shared by the app provider and the auth forms.
 * Without a client id the provider is not mounted and the button is hidden.
 */
export function getGoogleClientId(): string | null {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  return typeof clientId === "string" && clientId.trim()
    ? clientId.trim()
    : null;
}
