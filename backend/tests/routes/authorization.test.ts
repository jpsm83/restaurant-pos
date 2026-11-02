/**
 * Authorization rails at the HTTP seam.
 *
 * The v1 root gate is deny-by-default. This suite enumerates the registered
 * Fastify route table, proves every route is either public-by-allowlist or
 * explicitly recorded as authenticated, checks that retired surfaces are gone,
 * and sweeps every authenticated route with an anonymous request. A new route
 * without a public reason or an entry in the authenticated inventory fails
 * here.
 */

import { describe, expect, it } from "vitest";
import { Types } from "mongoose";

import { injectWithRouteAuth } from "../helpers/auth.ts";
import { createTestBusiness } from "../helpers/fixtures.ts";
import { getRouteInventory } from "../../src/routes/routeInventory.ts";
import { getTestApp } from "../setup.ts";
import {
  PUBLIC_ROUTE_ALLOWLIST,
  authorizationRouteKey,
  isPublicRoute,
} from "../../src/auth/authorization.ts";

const VALID_ID = new Types.ObjectId().toString();

/**
 * Explicit authenticated-route inventory: the default decision reviewed for
 * every registered non-public route. Remove a row when its route retires; add
 * a row (or a public allowlist entry) when a route is added.
 */
const AUTHENTICATED_ROUTES: readonly string[] = [
  "DELETE /api/v1/businessGoods/:businessGoodId",
  "DELETE /api/v1/dailySalesReports/:dailySalesReportId",
  "DELETE /api/v1/employees/:employeeId",
  "DELETE /api/v1/notifications/inbox/:notificationId",
  "DELETE /api/v1/orders/:orderId",
  "DELETE /api/v1/printers/:printerId",
  "DELETE /api/v1/promotions/:promotionId",
  "DELETE /api/v1/purchases/:purchaseId",
  "DELETE /api/v1/reservations/:reservationId",
  "DELETE /api/v1/salesInstances/:salesInstanceId",
  "DELETE /api/v1/salesPoints/:salesPointId",
  "DELETE /api/v1/schedules/:scheduleId",
  "DELETE /api/v1/supplierGoods/:supplierGoodId",
  "DELETE /api/v1/suppliers/:supplierId",
  "GET /api/v1/auth/me",
  "GET /api/v1/auth/mode",
  "GET /api/v1/auth/venues",
  "GET /api/v1/business/:businessId/access",
  "GET /api/v1/businessGoods",
  "GET /api/v1/businessGoods/:businessGoodId",
  "GET /api/v1/businessGoods/business/:businessId",
  "GET /api/v1/dailySalesReports",
  "GET /api/v1/dailySalesReports/:dailySalesReportId",
  "GET /api/v1/dailySalesReports/business/:businessId",
  "GET /api/v1/employees/:employeeId",
  "GET /api/v1/employees/business/:businessId",
  "GET /api/v1/employees/business/:businessId/management-contacts",
  "GET /api/v1/inventories",
  "GET /api/v1/inventories/:inventoryId",
  "GET /api/v1/inventories/:inventoryId/supplierGood/:supplierGoodId",
  "GET /api/v1/inventories/business/:businessId",
  "GET /api/v1/inventories/business/:businessId/lowStock",
  "GET /api/v1/inventories/business/:businessId/varianceReport",
  "GET /api/v1/monthlyBusinessReport",
  "GET /api/v1/monthlyBusinessReport/:monthlyReportId",
  "GET /api/v1/monthlyBusinessReport/business/:businessId",
  "GET /api/v1/monthlyBusinessReport/business/:businessId/calculateOnDemand",
  "GET /api/v1/notifications/inbox",
  "GET /api/v1/orders",
  "GET /api/v1/orders/:orderId",
  "GET /api/v1/orders/salesInstance/:salesInstanceId",
  "GET /api/v1/orders/user/:userId",
  "GET /api/v1/owners/portfolio",
  "GET /api/v1/printers",
  "GET /api/v1/printers/:printerId",
  "GET /api/v1/printers/business/:businessId",
  "GET /api/v1/promotions",
  "GET /api/v1/promotions/:promotionId",
  "GET /api/v1/promotions/business/:businessId",
  "GET /api/v1/purchases",
  "GET /api/v1/purchases/:purchaseId",
  "GET /api/v1/purchases/supplier/:supplierId",
  "GET /api/v1/purchases/user/:userId",
  "GET /api/v1/ratings/:ratingId",
  "GET /api/v1/ratings/business/:businessId",
  "GET /api/v1/reservations",
  "GET /api/v1/reservations/:reservationId",
  "GET /api/v1/reservations/business/:businessId",
  "GET /api/v1/salesInstances",
  "GET /api/v1/salesInstances/:salesInstanceId",
  "GET /api/v1/salesInstances/business/:businessId",
  "GET /api/v1/salesInstances/user/:userId",
  "GET /api/v1/salesPoints",
  "GET /api/v1/salesPoints/:salesPointId",
  "GET /api/v1/schedules",
  "GET /api/v1/schedules/:scheduleId",
  "GET /api/v1/schedules/business/:businessId",
  "GET /api/v1/schedules/business/:businessId/daily",
  "GET /api/v1/schedules/user/:userId",
  "GET /api/v1/supplierGoods",
  "GET /api/v1/supplierGoods/:supplierGoodId",
  "GET /api/v1/supplierGoods/supplier/:supplierId",
  "GET /api/v1/suppliers",
  "GET /api/v1/suppliers/:supplierId",
  "GET /api/v1/suppliers/business/:businessId",
  "GET /api/v1/users/:userId",
  "GET /api/v1/weeklyBusinessReport",
  "GET /api/v1/weeklyBusinessReport/:weeklyReportId",
  "GET /api/v1/weeklyBusinessReport/business/:businessId",
  "PATCH /api/v1/business/:businessId",
  "PATCH /api/v1/businessGoods/:businessGoodId",
  "PATCH /api/v1/dailySalesReports/:dailySalesReportId/calculateBusinessReport",
  "PATCH /api/v1/dailySalesReports/:dailySalesReportId/calculateUsersReport",
  "PATCH /api/v1/dailySalesReports/:dailySalesReportId/close",
  "PATCH /api/v1/dailySalesReports/:dailySalesReportId/reconcile",
  "PATCH /api/v1/employees/:employeeId",
  "PATCH /api/v1/inventories/:inventoryId/close",
  "PATCH /api/v1/inventories/:inventoryId/supplierGood/:supplierGoodId/addCount",
  "PATCH /api/v1/inventories/:inventoryId/supplierGood/:supplierGoodId/updateCount",
  "PATCH /api/v1/monthlyBusinessReport/:monthlyReportId",
  "PATCH /api/v1/notifications/inbox/:notificationId/read",
  "PATCH /api/v1/notifications/inbox/read-all",
  "PATCH /api/v1/owners/companies/:companyId",
  "PATCH /api/v1/printers/:printerId",
  "PATCH /api/v1/printers/:printerId/addConfigurationSetup",
  "PATCH /api/v1/printers/:printerId/deleteConfigurationSetup/:configId",
  "PATCH /api/v1/printers/:printerId/editConfigurationSetup/:configId",
  "PATCH /api/v1/promotions/:promotionId",
  "PATCH /api/v1/purchases/:purchaseId",
  "PATCH /api/v1/purchases/:purchaseId/addSupplierGood",
  "PATCH /api/v1/purchases/:purchaseId/deleteSupplierGood",
  "PATCH /api/v1/purchases/:purchaseId/editSupplierGood",
  "PATCH /api/v1/reservations/:reservationId",
  "PATCH /api/v1/salesInstances/:salesInstanceId",
  "PATCH /api/v1/salesInstances/:salesInstanceId/transferSalesPoint",
  "PATCH /api/v1/salesPoints/:salesPointId",
  "PATCH /api/v1/schedules/:scheduleId",
  "PATCH /api/v1/schedules/:scheduleId/addEmployee",
  "PATCH /api/v1/schedules/:scheduleId/deleteEmployee",
  "PATCH /api/v1/schedules/:scheduleId/updateEmployee",
  "PATCH /api/v1/supplierGoods/:supplierGoodId",
  "PATCH /api/v1/suppliers/:supplierId",
  "PATCH /api/v1/users/:userId",
  "POST /api/v1/auth/live-ticket",
  "POST /api/v1/auth/request-email-change",
  "POST /api/v1/auth/resend-email-confirmation",
  "POST /api/v1/auth/set-mode",
  "POST /api/v1/business",
  "POST /api/v1/business/:businessId/request-email-verification",
  "POST /api/v1/businessGoods",
  "POST /api/v1/employees",
  "POST /api/v1/orders",
  "POST /api/v1/printers",
  "POST /api/v1/promotions",
  "POST /api/v1/purchases",
  "POST /api/v1/ratings",
  "POST /api/v1/reservations",
  "POST /api/v1/salesInstances",
  "POST /api/v1/salesInstances/delivery",
  "POST /api/v1/salesInstances/selfOrderingLocation/:selfOrderingLocationId",
  "POST /api/v1/salesInstances/selfOrderingLocation/:selfOrderingLocationId/openTable",
  "POST /api/v1/salesPoints",
  "POST /api/v1/schedules",
  "POST /api/v1/supplierGoods",
  "POST /api/v1/suppliers",
] as const;

/** Replace every route parameter with a syntactically valid id. */
function concreteUrl(pattern: string): string {
  return pattern.replace(/:[^/]+/g, VALID_ID);
}

describe("API authorization rails", () => {
  it("keeps one public entry per route with a documented reason", () => {
    const keys = PUBLIC_ROUTE_ALLOWLIST.map(
      (route) => `${route.method} ${route.url}`,
    );
    expect(new Set(keys).size).toBe(keys.length);
    for (const route of PUBLIC_ROUTE_ALLOWLIST) {
      expect(route.reason.trim().length, keys.join(", ")).toBeGreaterThan(10);
    }
  });

  it("registers every public allowlist entry", async () => {
    const app = await getTestApp();
    const registered = new Set(
      getRouteInventory(app).map((route) => authorizationRouteKey(route.method, route.url)),
    );

    for (const route of PUBLIC_ROUTE_ALLOWLIST) {
      expect(
        registered.has(`${route.method} ${route.url}`),
        `${route.method} ${route.url}`,
      ).toBe(true);
    }
  });

  it("gives every registered route a public reason or an auth decision", async () => {
    const app = await getTestApp();
    const authenticated = new Set(AUTHENTICATED_ROUTES);

    for (const route of getRouteInventory(app)) {
      const key = authorizationRouteKey(route.method, route.url);
      if (isPublicRoute(route.method, route.url)) continue;

      expect(
        authenticated.has(key),
        `${key} is neither public-by-allowlist nor recorded as authenticated`,
      ).toBe(true);
    }

    const registered = new Set(
      getRouteInventory(app).map((route) => authorizationRouteKey(route.method, route.url)),
    );
    for (const key of AUTHENTICATED_ROUTES) {
      expect(registered.has(key), `${key} is recorded but not registered`).toBe(
        true,
      );
    }
  });

  it("does not register or answer the retired legacy surfaces", async () => {
    const app = await getTestApp();
    const registered = new Set(
      getRouteInventory(app).map((route) => authorizationRouteKey(route.method, route.url)),
    );

    const retired = [
      `DELETE /api/v1/users/:userId`,
      `DELETE /api/v1/business/:businessId`,
      `POST /api/v1/inventories`,
      `DELETE /api/v1/inventories/:inventoryId`,
      `GET /api/v1/notifications`,
      `POST /api/v1/notifications`,
      `GET /api/v1/notifications/:notificationId`,
      `PATCH /api/v1/notifications/:notificationId`,
      `DELETE /api/v1/notifications/:notificationId`,
      `GET /api/v1/notifications/business/:businessId`,
    ];

    for (const key of retired) {
      expect(registered.has(key), `${key} is still registered`).toBe(false);

      const [method, pattern] = key.split(" ");
      const response = await app.inject({
        method: method as "GET" | "POST" | "PATCH" | "DELETE",
        url: concreteUrl(pattern),
      });
      expect(response.statusCode, key).toBe(404);

      // A signed-in User cannot reach the retired mutation either.
      const signedIn = await injectWithRouteAuth(app, {
        method: method as "GET" | "POST" | "PATCH" | "DELETE",
        url: concreteUrl(pattern),
      });
      expect(signedIn.statusCode, key).toBe(404);
    }
  });

  it("refuses anonymous access to every authenticated route", async () => {
    const app = await getTestApp();

    for (const key of AUTHENTICATED_ROUTES) {
      const [method, pattern] = key.split(" ");
      const response = await app.inject({
        method: method as "GET" | "POST" | "PATCH" | "DELETE",
        url: concreteUrl(pattern),
      });

      expect(response.statusCode, key).toBe(401);
      expect(String(response.headers["content-type"]), key).toContain(
        "application/problem+json",
      );
    }
  });

  it("keeps the intentionally public reads reachable without a session", async () => {
    const app = await getTestApp();
    const business = await createTestBusiness({
      tradeName: "Public Profile",
      legalName: "Public Profile LLC",
      email: `public-profile-${Date.now()}@business.com`,
      phoneNumber: "1234567890",
      taxNumber: `TAX-PUBLIC-${Date.now()}`,
      currencyTrade: "USD",
      address: {
        country: "USA",
        state: "CA",
        city: "Los Angeles",
        street: "Main St",
        buildingNumber: "123",
        postCode: "90001",
      },
    });

    const health = await app.inject({ method: "GET", url: "/health" });
    expect(health.statusCode).toBe(200);

    const config = await app.inject({
      method: "GET",
      url: "/api/v1/auth/config",
    });
    expect(config.statusCode).toBe(200);

    const discovery = await app.inject({
      method: "GET",
      url: "/api/v1/business",
    });
    expect(discovery.statusCode).toBe(200);
    expect(
      discovery
        .json<Array<{ _id: string }>>()
        .some((entry) => entry._id === business._id.toString()),
    ).toBe(true);

    const profile = await app.inject({
      method: "GET",
      url: `/api/v1/business/${business._id}`,
    });
    expect(profile.statusCode).toBe(200);
    expect(profile.json().tradeName).toBe("Public Profile");
  });
});
