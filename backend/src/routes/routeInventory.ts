/**
 * Record the routes registered on a Fastify instance.
 *
 * The route-table inventory test reads this list and compares it with the
 * public allowlist. Keeping the collector beside the v1 registration makes the
 * registered surface observable without parsing `printRoutes` output.
 */

import type { FastifyInstance } from "fastify";

export interface RegisteredRoute {
  method: string;
  /** Route pattern including the plugin prefix. */
  url: string;
}

const routesByApp = new WeakMap<FastifyInstance, RegisteredRoute[]>();

/** Attach the collector; call before registering any route. */
export function registerRouteInventory(app: FastifyInstance): void {
  const routes: RegisteredRoute[] = [];
  routesByApp.set(app, routes);

  app.addHook("onRoute", (route) => {
    const methods = Array.isArray(route.method)
      ? route.method
      : [route.method];
    for (const method of methods) {
      routes.push({ method, url: route.url });
    }
  });
}

/** Routes registered on this instance, in registration order. */
export function getRouteInventory(
  app: FastifyInstance,
): readonly RegisteredRoute[] {
  return routesByApp.get(app) ?? [];
}
