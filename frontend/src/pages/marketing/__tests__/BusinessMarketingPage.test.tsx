import { screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { renderWithI18n } from "@/test/i18nTestUtils";
import { SiteAudienceProvider } from "@/context/SiteAudienceContext";
import BusinessMarketingPage from "../BusinessMarketingPage";

describe("BusinessMarketingPage", () => {
  it("renders business auth CTAs", async () => {
    await renderWithI18n(
      <MemoryRouter initialEntries={["/business"]}>
        <SiteAudienceProvider>
          <Routes>
            <Route path="/business" element={<BusinessMarketingPage />} />
          </Routes>
        </SiteAudienceProvider>
      </MemoryRouter>,
    );
    expect(screen.getByRole("main")).toHaveClass("marketing");
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login",
    );
    expect(screen.getByRole("link", { name: "Sign up" })).toHaveAttribute(
      "href",
      "/signup",
    );
  });
});
