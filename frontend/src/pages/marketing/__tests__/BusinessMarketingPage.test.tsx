import { screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { renderWithI18n } from "@/test/i18nTestUtils";
import BusinessMarketingPage from "../BusinessMarketingPage";

describe("BusinessMarketingPage", () => {
  it("renders business auth CTAs", async () => {
    await renderWithI18n(
      <MemoryRouter initialEntries={["/business"]}>
        <Routes>
          <Route path="/business" element={<BusinessMarketingPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login?audience=business",
    );
    expect(screen.getByRole("link", { name: "Sign up" })).toHaveAttribute(
      "href",
      "/business/register",
    );
  });
});
