/**
 * Tests for `SiteAudienceContext.tsx` — pathname → audience rules under `MemoryRouter`.
 */
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { SiteAudienceProvider, useSiteAudience } from "./SiteAudienceContext";

function AudienceLabel() {
  const a = useSiteAudience();
  return <span data-testid="audience">{a}</span>;
}

describe("SiteAudienceProvider (Phase 1.1)", () => {
  it("returns business on /business", () => {
    render(
      <MemoryRouter initialEntries={["/business"]}>
        <SiteAudienceProvider>
          <AudienceLabel />
        </SiteAudienceProvider>
      </MemoryRouter>,
    );
    expect(screen.getByTestId("audience")).toHaveTextContent("business");
  });

  it("returns business on /business/register", () => {
    render(
      <MemoryRouter initialEntries={["/business/register"]}>
        <SiteAudienceProvider>
          <AudienceLabel />
        </SiteAudienceProvider>
      </MemoryRouter>,
    );
    expect(screen.getByTestId("audience")).toHaveTextContent("business");
  });

  it("returns customer on /", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <SiteAudienceProvider>
          <AudienceLabel />
        </SiteAudienceProvider>
      </MemoryRouter>,
    );
    expect(screen.getByTestId("audience")).toHaveTextContent("customer");
  });

  it("returns customer on /login", () => {
    render(
      <MemoryRouter initialEntries={["/login"]}>
        <SiteAudienceProvider>
          <AudienceLabel />
        </SiteAudienceProvider>
      </MemoryRouter>,
    );
    expect(screen.getByTestId("audience")).toHaveTextContent("customer");
  });

  it("returns customer on /signup", () => {
    render(
      <MemoryRouter initialEntries={["/signup"]}>
        <SiteAudienceProvider>
          <AudienceLabel />
        </SiteAudienceProvider>
      </MemoryRouter>,
    );
    expect(screen.getByTestId("audience")).toHaveTextContent("customer");
  });
});
