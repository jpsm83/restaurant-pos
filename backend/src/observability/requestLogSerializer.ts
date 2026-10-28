import type { FastifyRequest } from "fastify";

/**
 * Request log shape: method, path, host and address only.
 *
 * Query strings are dropped so a credential carried on a URL can never reach
 * the log, and bodies/headers are never part of the default serializer.
 */
export function requestLogSerializer(request: FastifyRequest) {
  return {
    method: request.method,
    url: request.url.split("?")[0],
    hostname: request.hostname,
    remoteAddress: request.ip,
  };
}
