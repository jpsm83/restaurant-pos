/**
 * Seed plan catalogue for Project Imperium monetization.
 * Superadmin will own live edits later; this JSON is the build-time default.
 */

import catalogueJson from "../subscriptionCatalogue.json" with { type: "json" };

export type PlanId = "Free" | "Basic" | "Premium" | "Enterprise";

export type PlanEntitlements = {
  channels: {
    dineIn: boolean;
    selfOrdering: boolean;
    kiosk: boolean;
    delivery: boolean;
  };
  floorPlanLimit: number | null;
  promotions: boolean;
  ratings: boolean;
  giftCards: boolean;
  reservations: boolean;
  inventory: boolean;
  suppliersPurchases: boolean;
  schedulesHr: boolean;
  payrollExport: boolean;
  dailyReports: boolean;
  weeklyReports: boolean;
  monthlyPnlReports: boolean;
  customCommercialTerms?: boolean;
};

export type SubscriptionPlan = {
  id: PlanId;
  /** Monthly subscription in catalogue currency; null = custom (Enterprise). */
  monthlyPrice: number | null;
  /** Imperium base take-rate on all commissionable sales; null = custom. */
  baseCommissionPercent: number | null;
  /** Max venues under the Owner; null = unlimited. */
  venueLimit: number | null;
  entitlements: PlanEntitlements;
};

export type SubscriptionCatalogue = {
  version: number;
  catalogueCurrency: string;
  latePaymentGraceDays: number;
  cardRecovery: {
    /** Pass-through percent on card-tendered commissionable sales. */
    percent: number;
    /** Always 0 — Imperium does not mark up card recovery. */
    imperiumMarginPercent: number;
    benchmarkNote: string;
  };
  plans: SubscriptionPlan[];
};

export const subscriptionCatalogue = catalogueJson as SubscriptionCatalogue;

const planById = new Map(
  subscriptionCatalogue.plans.map((plan) => [plan.id, plan]),
);

export function getPlan(planId: string): SubscriptionPlan {
  const plan = planById.get(planId as PlanId);
  if (!plan) {
    throw new Error(`Unknown subscription plan: ${planId}`);
  }
  return plan;
}

export function getBaseCommissionPercent(planId: string): number {
  const rate = getPlan(planId).baseCommissionPercent;
  return rate ?? 0;
}

/** Safe lookup for report estimates when the plan id may be missing or unknown. */
export function resolveBaseCommissionPercent(planId?: string): number {
  if (!planId) return 0;
  try {
    return getBaseCommissionPercent(planId);
  } catch {
    return 0;
  }
}

export function getCardRecoveryPercent(): number {
  return subscriptionCatalogue.cardRecovery.percent;
}

export function computeWeeklyCommission(input: {
  planId: string;
  commissionableSales: number;
  cardCommissionableSales: number;
}): {
  baseCommission: number;
  cardRecovery: number;
  total: number;
} {
  const baseRate = getBaseCommissionPercent(input.planId);
  const cardRate = getCardRecoveryPercent();
  const baseCommission = input.commissionableSales * baseRate;
  const cardRecovery = input.cardCommissionableSales * cardRate;
  return {
    baseCommission,
    cardRecovery,
    total: baseCommission + cardRecovery,
  };
}
