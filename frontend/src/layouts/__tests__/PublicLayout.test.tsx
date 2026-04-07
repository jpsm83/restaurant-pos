import { screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { renderWithI18n } from "@/test/i18nTestUtils";
import PublicLayout from "../PublicLayout";

vi.mock("@/components/Footer", () => ({
  default: () => <footer>Mock Footer</footer>,
}));

describe("PublicLayout", () => {
  it("renders route outlet and footer", async () => {
    await renderWithI18n(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<PublicLayout />}>
            <Route index element={<div>Public Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Public Content")).toBeInTheDocument();
    expect(screen.getByText("Mock Footer")).toBeInTheDocument();
  });
});
