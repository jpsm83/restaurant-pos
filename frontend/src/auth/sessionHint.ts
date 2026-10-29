/**
 * Local, non-secret hint that this browser previously held a signed-in session.
 *
 * The refresh token itself stays in an HttpOnly cookie. This hint only decides
 * whether calling `POST /auth/refresh` can possibly succeed, so an anonymous
 * visitor does not make a call that can only answer `401`.
 */
const SESSION_HINT_KEY = "auth_had_session";

export function hasPriorSession(): boolean {
  try {
    return localStorage.getItem(SESSION_HINT_KEY) === "1";
  } catch {
    return false;
  }
}

export function markPriorSession(): void {
  try {
    localStorage.setItem(SESSION_HINT_KEY, "1");
  } catch {
    // Storage can be unavailable (private mode/quota); the session still works.
  }
}

export function clearPriorSession(): void {
  try {
    localStorage.removeItem(SESSION_HINT_KEY);
  } catch {
    // No-op: the hint is already gone when storage is unavailable.
  }
}
