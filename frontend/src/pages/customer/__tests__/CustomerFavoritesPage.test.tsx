import { screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { renderWithI18n } from "@/test/i18nTestUtils";
import CustomerFavoritesPage from "../CustomerFavoritesPage";

describe("CustomerFavoritesPage", () => {
  it("renders favorites heading", async () => {
    await renderWithI18n(
      <MemoryRouter initialEntries={["/u1/customer/favorites"]}>
        <Routes>
          <Route path="/:userId/customer/favorites" element={<CustomerFavoritesPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });
});
