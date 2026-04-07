import { screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { renderWithI18n } from "@/test/i18nTestUtils";
import CustomerDashboardPage from "../CustomerDashboardPage";

describe("CustomerDashboardPage", () => {
  it("renders dashboard heading", async () => {
    await renderWithI18n(
      <MemoryRouter initialEntries={["/u1/customer/dashboard"]}>
        <Routes>
          <Route path="/:userId/customer/dashboard" element={<CustomerDashboardPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });
});
