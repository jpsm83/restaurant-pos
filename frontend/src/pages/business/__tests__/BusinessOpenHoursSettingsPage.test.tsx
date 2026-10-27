import type { ReactNode } from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { renderWithI18n } from "@/test/i18nTestUtils";
import BusinessOpenHoursSettingsPage from "../BusinessOpenHoursSettingsPage";

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

describe("BusinessOpenHoursSettingsPage", () => {
  it("renders open-hours settings section", async () => {
    await renderWithI18n(
      <MemoryRouter initialEntries={["/business/1/settings/open-hours"]}>
        <Routes>
          <Route
            path="/business/:businessId/settings/open-hours"
            element={<BusinessOpenHoursSettingsPage />}
          />
        </Routes>
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("heading", { level: 2, name: "Business opening hours" }),
    ).toBeInTheDocument();
  });

  it("renders the section, empty state, and weekday options in Spanish", async () => {
    const user = userEvent.setup();
    await renderWithI18n(
      <MemoryRouter initialEntries={["/business/1/settings/open-hours"]}>
        <Routes>
          <Route
            path="/business/:businessId/settings/open-hours"
            element={<BusinessOpenHoursSettingsPage />}
          />
        </Routes>
      </MemoryRouter>,
      { language: "es" },
    );

    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Horario de apertura del negocio",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Aún no hay horarios de apertura configurados."),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Añadir día de apertura" }),
    );
    expect(
      screen.getByRole("option", { name: "Lunes" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Eliminar" }),
    ).toBeInTheDocument();
  });
});
