import { screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { renderWithI18n } from "@/test/i18nTestUtils";
import EmployeeProfilePage from "../EmployeeProfilePage";

describe("EmployeeProfilePage", () => {
  it("renders profile heading", async () => {
    await renderWithI18n(
      <MemoryRouter initialEntries={["/u1/employee/profile"]}>
        <Routes>
          <Route path="/:userId/employee/profile" element={<EmployeeProfilePage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });
});
