import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import connectDb from "@/lib/db/connectDb";
import Business from "@/lib/db/models/business";
import MonthlyBusinessReport from "@/lib/db/models/monthlyBusinessReport";
import { options } from "@/app/api/auth/[...nextauth]/options";

const MonthlyReportPage = async () => {
  const session = await getServerSession(options);

  if (!session) {
    redirect("/api/auth/signin?callbackUrl=/auth/post-login");
  }

  if (session.user?.type !== "business") {
    redirect("/auth/post-login");
  }

  const businessId = session.user.id;

  await connectDb();

  const [business, latestReport] = await Promise.all([
    Business.findById(businessId).select("tradeName metrics").lean(),
    MonthlyBusinessReport.findOne({ businessId })
      .sort({ monthReference: -1 })
      .lean(),
  ]);

  if (!business || !latestReport) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-semibold">Monthly KPIs</h1>
        <p>No monthly report data available yet.</p>
      </div>
    );
  }

  const metrics = (business as { metrics?: any }).metrics;
  const financialSummary = (latestReport as { financialSummary?: any }).financialSummary;
  const costBreakdown = (latestReport as { costBreakdown?: any }).costBreakdown;
  const supplierWasteAnalysis = (latestReport as { supplierWasteAnalysis?: any }).supplierWasteAnalysis;

  const monthRef = (latestReport as { monthReference?: Date }).monthReference
    ? new Date((latestReport as { monthReference: Date }).monthReference)
    : null;

  const monthLabel = monthRef
    ? monthRef.toLocaleDateString(undefined, { year: "numeric", month: "long" })
    : "Latest month";

  return (
    <div className="p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Monthly KPIs</h1>
        <p className="text-sm text-gray-600">
          {business.tradeName} — {monthLabel}
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border p-4">
          <h2 className="text-sm font-medium text-gray-600">Profit margin %</h2>
          <p className="mt-2 text-2xl font-semibold">
            {financialSummary?.financialPercentages?.profitMarginPercentage?.toFixed?.(
              1,
            ) ?? "0.0"}
            %
          </p>
        </div>

        <div className="rounded-lg border p-4">
          <h2 className="text-sm font-medium text-gray-600">
            Food cost % (of operating cost)
          </h2>
          <p className="mt-2 text-2xl font-semibold">
            {((costBreakdown?.costPercentages?.foodCostRatio ?? 0) * 100).toFixed(1)}%
          </p>
          {metrics?.foodCostPercentage != null && (
            <p className="mt-1 text-xs text-gray-600">
              Target: {metrics.foodCostPercentage.toFixed(1)}%
            </p>
          )}
        </div>

        <div className="rounded-lg border p-4">
          <h2 className="text-sm font-medium text-gray-600">
            Labor cost % (of operating cost)
          </h2>
          <p className="mt-2 text-2xl font-semibold">
            {((costBreakdown?.costPercentages?.laborCostRatio ?? 0) * 100).toFixed(1)}%
          </p>
          {metrics?.laborCostPercentage != null && (
            <p className="mt-1 text-xs text-gray-600">
              Target: {metrics.laborCostPercentage.toFixed(1)}%
            </p>
          )}
        </div>

        <div className="rounded-lg border p-4">
          <h2 className="text-sm font-medium text-gray-600">
            Fixed cost % (of operating cost)
          </h2>
          <p className="mt-2 text-2xl font-semibold">
            {((costBreakdown?.costPercentages?.fixedCostRatio ?? 0) * 100).toFixed(1)}%
          </p>
          {metrics?.fixedCostPercentage != null && (
            <p className="mt-1 text-xs text-gray-600">
              Target: {metrics.fixedCostPercentage.toFixed(1)}%
            </p>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Waste by budget impact</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {[
            {
              label: "Very low impact",
              key: "veryLowImpactWastePercentage" as const,
              targetKey: "veryLowBudgetImpact" as const,
            },
            {
              label: "Low impact",
              key: "lowImpactWastePercentage" as const,
              targetKey: "lowBudgetImpact" as const,
            },
            {
              label: "Medium impact",
              key: "mediumImpactWastePercentage" as const,
              targetKey: "mediumBudgetImpact" as const,
            },
            {
              label: "High impact",
              key: "highImpactWastePercentage" as const,
              targetKey: "hightBudgetImpact" as const,
            },
            {
              label: "Very high impact",
              key: "veryHighImpactWastePercentage" as const,
              targetKey: "veryHightBudgetImpact" as const,
            },
          ].map(({ label, key, targetKey }) => {
            const actual = supplierWasteAnalysis?.[key] ?? 0;
            const target =
              metrics?.supplierGoodWastePercentage?.[targetKey] ?? null;
            return (
              <div key={key} className="rounded-lg border p-4">
                <h3 className="text-sm font-medium text-gray-600">{label}</h3>
                <p className="mt-2 text-2xl font-semibold">
                  {actual.toFixed(1)}%
                </p>
                {target != null && (
                  <p className="mt-1 text-xs text-gray-600">
                    Target: {Number(target).toFixed(1)}%
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default MonthlyReportPage;

