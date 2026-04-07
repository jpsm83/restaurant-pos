import { screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { renderWithI18n } from "@/test/i18nTestUtils";
import NotFoundPage from "../NotFoundPage";

describe("NotFoundPage", () => {
  it("renders go back action", async () => {
    await renderWithI18n(
      <MemoryRouter initialEntries={["/not-found"]}>
        <Routes>
          <Route path="/not-found" element={<NotFoundPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole("button", { name: "Go back" })).toBeInTheDocument();
  });
});
