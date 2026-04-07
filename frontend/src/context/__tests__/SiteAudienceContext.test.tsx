/**
 * Tests for `SiteAudienceContext.tsx` — pathname → audience rules under `MemoryRouter`.
 */
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import {
  SiteAudienceProvider,
  useOptionalSiteAudience,
  useSiteAudience,
} from "../SiteAudienceContext";

function AudienceLabel() {
  const a = useSiteAudience();
  return <span data-testid="audience">{a}</span>;
}

function OptionalAudienceLabel() {
  const a = useOptionalSiteAudience();
  return <span data-testid="optional-audience">{a === null ? "null" : a}</span>;
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

  it("useOptionalSiteAudience returns null outside provider", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <OptionalAudienceLabel />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("optional-audience")).toHaveTextContent("null");
  });

  it("useOptionalSiteAudience returns audience inside provider", () => {
    render(
      <MemoryRouter initialEntries={["/business"]}>
        <SiteAudienceProvider>
          <OptionalAudienceLabel />
        </SiteAudienceProvider>
      </MemoryRouter>,
    );
    expect(screen.getByTestId("optional-audience")).toHaveTextContent("business");
  });

  it("throws when useSiteAudience is used outside SiteAudienceProvider", () => {
    function Bad() {
      useSiteAudience();
      return null;
    }
    expect(() =>
      render(
        <MemoryRouter>
          <Bad />
        </MemoryRouter>,
      ),
    ).toThrow("useSiteAudience must be used within SiteAudienceProvider");
  });
});
