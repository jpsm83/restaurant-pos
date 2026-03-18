import type { FastifyPluginAsync } from "fastify";
import { authRoutes } from "./auth.js";
import { businessRoutes } from "./business.js";
import { businessGoodsRoutes } from "./businessGoods.js";
import { ordersRoutes } from "./orders.js";
import { salesInstancesRoutes } from "./salesInstances.js";
import { salesPointsRoutes } from "./salesPoints.js";
import { suppliersRoutes } from "./suppliers.js";
import { supplierGoodsRoutes } from "./supplierGoods.js";
import { inventoriesRoutes } from "./inventories.js";
import { purchasesRoutes } from "./purchases.js";
import { employeesRoutes } from "./employees.js";
import { schedulesRoutes } from "./schedules.js";
import { usersRoutes } from "./users.js";
import { promotionsRoutes } from "./promotions.js";
import { dailySalesReportsRoutes } from "./dailySalesReports.js";
import { reservationsRoutes } from "./reservations.js";
import { ratingsRoutes } from "./ratings.js";
import { notificationsRoutes } from "./notifications.js";
import { printersRoutes } from "./printers.js";
import { weeklyBusinessReportRoutes } from "./weeklyBusinessReport.js";
import { monthlyBusinessReportRoutes } from "./monthlyBusinessReport.js";

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
  await app.register(printersRoutes, { prefix: "/printers" });
  await app.register(weeklyBusinessReportRoutes, { prefix: "/weeklyBusinessReport" });
  await app.register(monthlyBusinessReportRoutes, { prefix: "/monthlyBusinessReport" });
};

