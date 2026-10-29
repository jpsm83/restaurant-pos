/**
 * Google sign-in configuration shared by the app provider and the auth forms.
 * Without a client id the provider is not mounted and the button is hidden.
 */

interface GoogleCredentialResponse {
  credential?: string;
  select_by?: string;
  clientId?: string;
  client_id?: string;
}

interface GoogleIdConfiguration {
  client_id?: string;
  callback?: (response: GoogleCredentialResponse) => void;
  [key: string]: unknown;
}

interface GoogleIdApi {
  initialize: (config: GoogleIdConfiguration) => void;
  [key: string]: unknown;
}

interface GoogleAccountsApi {
  id?: GoogleIdApi;
}

declare global {
  interface Window {
    google?: { accounts?: GoogleAccountsApi };
  }
}

export function getGoogleClientId(): string | null {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  return typeof clientId === "string" && clientId.trim()
    ? clientId.trim()
    : null;
}

let patchedIdApi: GoogleIdApi | null = null;

/**
 * Make `google.accounts.id.initialize` idempotent for one client id.
 *
 * `@react-oauth/google` calls initialize on every mount (including React
 * StrictMode's deliberate double mount), while Google Identity Services only
 * supports one initialization and logs a warning for each repeat. Keep the
 * first initialization and forward the latest callback so remounts keep the
 * current handler without re-initializing the provider.
 */
export function installGoogleInitializeGuard(): void {
  const idApi = window.google?.accounts?.id;
  if (!idApi || idApi === patchedIdApi) return;

  const originalInitialize = idApi.initialize.bind(idApi);
  let activeClientId: string | null = null;
  let activeCallback: GoogleIdConfiguration["callback"];

  idApi.initialize = (config) => {
    activeCallback = config.callback ?? activeCallback;

    const clientId = config.client_id ?? null;
    if (clientId === activeClientId) return;
    activeClientId = clientId;

    originalInitialize({
      ...config,
      callback: (response) => activeCallback?.(response),
    });
  };

  patchedIdApi = idApi;
}

/** Restore a fresh guard between tests that build their own GSI fake. */
export function resetGoogleInitializeGuardForTests(): void {
  patchedIdApi = null;
}
