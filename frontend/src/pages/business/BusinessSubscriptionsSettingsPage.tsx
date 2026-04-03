import { useTranslation } from "react-i18next";
import { useWatch } from "react-hook-form";
import { subscriptionEnums } from "@packages/enums.ts";
import { BusinessProfileSettingsFormShell } from "../../components/BusinessProfileSettingsFormShell";
import type { BusinessProfileSettingsReady } from "../../hooks/useBusinessProfileSettingsController";

/** Subscription plan selection for the business tenant. */
export default function BusinessSubscriptionsSettingsPage() {
  const { t: tNav } = useTranslation("nav");

  return (
    <BusinessProfileSettingsFormShell
      pageTitle={tNav("settings.subscriptions")}
      cardDescription="Choose the subscription tier for this business."
    >
      {(ctx) => <SubscriptionSection ctx={ctx} />}
    </BusinessProfileSettingsFormShell>
  );
}

function SubscriptionSection({ ctx }: { ctx: BusinessProfileSettingsReady }) {
  const { control, setValue } = ctx;
  const selectedSubscription = useWatch({ control, name: "subscription" });

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-700">
        Subscription
      </h2>
      <div role="radiogroup" aria-label="Subscription plan" className="grid gap-3 sm:grid-cols-3">
        {subscriptionEnums.map((plan) => {
          const isSelected = selectedSubscription === plan;
          return (
            <button
              key={plan}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={`Select ${plan} plan`}
              className={`rounded-lg border p-4 text-left transition ${
                isSelected
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-300 bg-white text-neutral-900 hover:border-neutral-500"
              }`}
              onClick={() => setValue("subscription", plan, { shouldDirty: true })}
            >
              <p className="font-semibold">{plan}</p>
              <p
                className={`mt-1 text-xs ${
                  isSelected ? "text-neutral-200" : "text-neutral-500"
                }`}
              >
                Selected plan for this business.
              </p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
