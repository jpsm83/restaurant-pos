/**
 * Shared assertions for the RFC 9457 problem-details responses the API emits at
 * the HTTP seam.
 */

/** Whether a response is an `application/problem+json` document. */
export const isProblemDetails = (response: {
  headers: Record<string, unknown>;
}): boolean =>
  String(response.headers["content-type"]).includes("application/problem+json");

/** The `errors[].path` values of a problem-details response. */
export const errorPaths = (response: { body: string }): string[] =>
  (JSON.parse(response.body).errors ?? []).map((e: { path: string }) => e.path);

/** The `errors[].message` values of a problem-details response. */
export const errorMessages = (response: { body: string }): string[] =>
  (JSON.parse(response.body).errors ?? []).map(
    (e: { message: string }) => e.message,
  );

/** The `detail` field of a problem-details response. */
export const detail = (response: { body: string }): string =>
  JSON.parse(response.body).detail;
