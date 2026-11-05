/**
 * Google sign-in configuration shared by the app provider and the auth forms.
 * Without a client id the provider is not mounted and the button is hidden.
 */

export interface GoogleCredentialResponse {
  credential?: string;
}

export interface GoogleIdConfiguration {
  client_id?: string;
  callback?: (response: GoogleCredentialResponse) => void;
  /** Google Identity Services accepts additional provider options. */
  [option: string]: unknown;
}

interface GoogleIdApi {
  initialize: (config: GoogleIdConfiguration) => void;
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

/**
 * Make `google.accounts.id.initialize` idempotent for identical configuration.
 *
 * `@react-oauth/google` calls initialize on every mount (including React
 * StrictMode's deliberate double mount), while Google Identity Services only
 * supports one initialization and logs a warning for each repeat. Keep the
 * first initialization and forward the latest callback so remounts keep the
 * current handler; a genuinely different configuration still initializes.
 *
 * Each guard owns its own state, so the app and a test can install independent
 * guards against their own Google Identity Services fake.
 */
export function createGoogleInitializeGuard(): { install: () => void } {
  let patchedIdApi: GoogleIdApi | null = null;
  let patchedInitialize: GoogleIdApi["initialize"] | null = null;
  let activeConfigKey: string | null = null;
  let activeCallback: GoogleIdConfiguration["callback"];

  return {
    install() {
      const idApi = window.google?.accounts?.id;
      if (!idApi) return;
      // Google re-registers `initialize` when its script executes again (React
      // StrictMode mounts the provider's script-loading effect twice), so the
      // method identity—not just the API object—tells us whether the guard is
      // still installed.
      if (idApi === patchedIdApi && idApi.initialize === patchedInitialize) {
        return;
      }

      const originalInitialize = idApi.initialize.bind(idApi);

      idApi.initialize = (config) => {
        activeCallback = config.callback ?? activeCallback;

        const rest = { ...config };
        delete rest.callback;
        const configKey = JSON.stringify(rest);
        if (configKey === activeConfigKey) return;
        activeConfigKey = configKey;

        originalInitialize({
          ...config,
          callback: (response) => activeCallback?.(response),
        });
      };

      patchedIdApi = idApi;
      patchedInitialize = idApi.initialize;
    },
  };
}

const googleInitializeGuard = createGoogleInitializeGuard();

/** Install the app-wide Google initialize guard. */
export function installGoogleInitializeGuard(): void {
  googleInitializeGuard.install();
}
