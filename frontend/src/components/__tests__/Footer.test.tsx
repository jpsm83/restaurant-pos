import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithI18n } from "@/test/i18nTestUtils";
import Footer from "../Footer";

describe("Footer", () => {
  it("renders contentinfo landmark with sr-only footer label", async () => {
    await renderWithI18n(<Footer />);
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    expect(screen.getByText("Footer")).toBeInTheDocument();
  });
});
