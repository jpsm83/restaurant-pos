/**
 * Owners Routes — the signed-in User's Owner portfolio.
 *
 * Every read and write is self-only: the route resolves the caller's Owner and
 * never takes an Owner id from the client. Every Company and Business is
 * reached through that Owner, so one Owner can never read or edit another's
 * portfolio.
 */
import type { FastifyPluginAsync } from "fastify";

import { createAuthHook } from "../../auth/middleware.ts";
import { conflict, forbidden, notFound } from "../../errors/appError.ts";
import {
  OwnerCompanyError,
  updateOwnerCompany,
} from "../../owners/updateOwnerCompany.ts";
import { readOwnerPortfolio } from "../../owners/ownerPortfolio.ts";
import {
  companyIdParamsSchema,
  updateCompanyBodySchema,
  type CompanyIdParams,
  type UpdateCompanyBody,
} from "restaurant-pos-packages/schemas/company";

function throwCompanyProblem(error: unknown): never {
  if (error instanceof OwnerCompanyError) {
    switch (error.code) {
      case "company-not-found":
        throw notFound(error.message);
      case "company-not-owned":
        throw forbidden(error.message);
      case "company-duplicate":
        throw conflict(error.message);
    }
  }
  throw error;
}

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

  // PATCH /owners/companies/:companyId - edit the caller's Company identity
  app.patch<{ Params: CompanyIdParams; Body: UpdateCompanyBody }>(
    "/companies/:companyId",
    {
      preValidation: [createAuthHook(app)],
      schema: {
        params: companyIdParamsSchema,
        body: updateCompanyBodySchema,
      },
    },
    async (req, reply) => {
      try {
        const company = await updateOwnerCompany({
          userId: req.authSession!.id,
          companyId: req.params.companyId,
          legalName: req.body.legalName,
          taxNumber: req.body.taxNumber,
        });
        return reply.code(200).send(company);
      } catch (error) {
        throwCompanyProblem(error);
      }
    },
  );
};
