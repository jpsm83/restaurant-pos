import type { ReactNode } from "react";
import { screen } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { renderWithI18n } from "@/test/i18nTestUtils";
import BusinessDeliverySettingsPage from "../BusinessDeliverySettingsPage";

vi.mock("@/components/BusinessProfileSettingsFormShell", () => ({
  BusinessProfileSettingsLoadingCard: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  BusinessProfileSettingsFormShell: ({
    children,
  }: {
    children: (ctx: Record<string, unknown>) => ReactNode;
  }) => {
    const { register, control, setValue } = useForm({
      defaultValues: {
        acceptsDelivery: false,
        deliveryRadius: null,
        minOrder: null,
        businessOpeningHours: [],
        deliveryOpeningWindows: [],
        reportingConfig: { weeklyReportStartDay: null },
        metrics: {
          foodCostPercentage: 0,
          beverageCostPercentage: 0,
          laborCostPercentage: 0,
          fixedCostPercentage: 0,
          supplierGoodWastePercentage: {
            veryLowBudgetImpact: 0,
            lowBudgetImpact: 0,
            mediumBudgetImpact: 0,
            hightBudgetImpact: 0,
            veryHightBudgetImpact: 0,
          },
        },
        subscription: "Free",
      },
    });
    return <main>{children({ register, control, setValue })}</main>;
  },
}));

describe("BusinessDeliverySettingsPage", () => {
  it("renders delivery settings section", async () => {
    await renderWithI18n(
      <MemoryRouter initialEntries={["/business/1/settings/delivery"]}>
        <Routes>
          <Route
            path="/business/:businessId/settings/delivery"
            element={<BusinessDeliverySettingsPage />}
          />
        </Routes>
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("heading", { level: 2, name: "Delivery options" }),
    ).toBeInTheDocument();
  });
});
