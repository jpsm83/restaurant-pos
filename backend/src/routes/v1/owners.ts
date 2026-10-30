/**
 * Owners Routes — the signed-in User's Owner portfolio.
 *
 * The read is self-only: the route resolves the caller's Owner and never takes
 * an Owner id from the client. Every Company and Business in the response is
 * reached through that Owner, so one Owner can never read another's portfolio.
 */
import type { FastifyPluginAsync } from "fastify";

import { createAuthHook } from "../../auth/middleware.ts";
import { readOwnerPortfolio } from "../../owners/ownerPortfolio.ts";

export const ownersRoutes: FastifyPluginAsync = async (app) => {
  // GET /owners/portfolio - the caller's Owner, Companies and Businesses
  app.get(
    "/portfolio",
    { preValidation: [createAuthHook(app)] },
    async (req, reply) => {
      const portfolio = await readOwnerPortfolio(req.authSession!.id);
      return reply.code(200).send(portfolio);
    },
  );
};
