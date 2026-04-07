import { screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { renderWithI18n } from "@/test/i18nTestUtils";
import EmployeeDashboardPage from "../EmployeeDashboardPage";

describe("EmployeeDashboardPage", () => {
  it("renders dashboard heading", async () => {
    await renderWithI18n(
      <MemoryRouter initialEntries={["/u1/employee/dashboard"]}>
        <Routes>
          <Route path="/:userId/employee/dashboard" element={<EmployeeDashboardPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });
});
