import { screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { renderWithI18n } from "@/test/i18nTestUtils";
import {
  SiteAudienceProvider,
  useSiteAudience,
} from "@/context/SiteAudienceContext";
import CustomerMarketingPage from "../CustomerMarketingPage";

function AudienceProbe() {
  return <output data-testid="audience">{useSiteAudience()}</output>;
}

describe("CustomerMarketingPage", () => {
  it("renders customer auth CTAs", async () => {
    await renderWithI18n(
      <MemoryRouter initialEntries={["/"]}>
        <SiteAudienceProvider>
          <AudienceProbe />
          <Routes>
            <Route path="/" element={<CustomerMarketingPage />} />
          </Routes>
        </SiteAudienceProvider>
      </MemoryRouter>,
    );
    expect(screen.getByTestId("audience")).toHaveTextContent("customer");
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
