import type { FastifyPluginAsync } from "fastify";
import { authRoutes } from "./auth.ts";
import { businessRoutes } from "./business.ts";
import { businessGoodsRoutes } from "./businessGoods.ts";
import { ordersRoutes } from "./orders.ts";
import { salesInstancesRoutes } from "./salesInstances.ts";
import { salesPointsRoutes } from "./salesPoints.ts";
import { suppliersRoutes } from "./suppliers.ts";
import { supplierGoodsRoutes } from "./supplierGoods.ts";
import { inventoriesRoutes } from "./inventories.ts";
import { purchasesRoutes } from "./purchases.ts";
import { employeesRoutes } from "./employees.ts";
import { schedulesRoutes } from "./schedules.ts";
import { usersRoutes } from "./users.ts";
import { promotionsRoutes } from "./promotions.ts";
import { dailySalesReportsRoutes } from "./dailySalesReports.ts";
import { reservationsRoutes } from "./reservations.ts";
import { ratingsRoutes } from "./ratings.ts";
import { notificationsRoutes } from "./notifications.ts";
import { notificationsLiveRoutes } from "./notificationsLive.ts";
import { printersRoutes } from "./printers.ts";
import { weeklyBusinessReportRoutes } from "./weeklyBusinessReport.ts";
import { monthlyBusinessReportRoutes } from "./monthlyBusinessReport.ts";

export const registerV1Routes: FastifyPluginAsync = async (app) => {
  // Auth routes (no authentication required for login/refresh/logout)
  await app.register(authRoutes, { prefix: "/auth" });

  await app.register(businessRoutes, { prefix: "/business" });
  await app.register(businessGoodsRoutes, { prefix: "/businessGoods" });
  await app.register(ordersRoutes, { prefix: "/orders" });
  await app.register(salesInstancesRoutes, { prefix: "/salesInstances" });
  await app.register(salesPointsRoutes, { prefix: "/salesPoints" });
  await app.register(suppliersRoutes, { prefix: "/suppliers" });
  await app.register(supplierGoodsRoutes, { prefix: "/supplierGoods" });
  await app.register(inventoriesRoutes, { prefix: "/inventories" });
  await app.register(purchasesRoutes, { prefix: "/purchases" });
  await app.register(employeesRoutes, { prefix: "/employees" });
  await app.register(schedulesRoutes, { prefix: "/schedules" });
  await app.register(usersRoutes, { prefix: "/users" });
  await app.register(promotionsRoutes, { prefix: "/promotions" });
  await app.register(dailySalesReportsRoutes, { prefix: "/dailySalesReports" });
  await app.register(reservationsRoutes, { prefix: "/reservations" });
  await app.register(ratingsRoutes, { prefix: "/ratings" });
  await app.register(notificationsRoutes, { prefix: "/notifications" });
  await app.register(notificationsLiveRoutes, { prefix: "/notifications" });
  await app.register(printersRoutes, { prefix: "/printers" });
  await app.register(weeklyBusinessReportRoutes, {
    prefix: "/weeklyBusinessReport",
  });
  await app.register(monthlyBusinessReportRoutes, {
    prefix: "/monthlyBusinessReport",
  });
};
