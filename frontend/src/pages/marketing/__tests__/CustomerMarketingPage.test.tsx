import { screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { renderWithI18n } from "@/test/i18nTestUtils";
import CustomerMarketingPage from "../CustomerMarketingPage";

describe("CustomerMarketingPage", () => {
  it("renders customer auth CTAs", async () => {
    await renderWithI18n(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<CustomerMarketingPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login?audience=customer",
    );
    expect(screen.getByRole("link", { name: "Sign up" })).toHaveAttribute(
      "href",
      "/signup?audience=customer",
    );
  });
});
