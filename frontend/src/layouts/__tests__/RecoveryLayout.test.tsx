import { screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { renderWithI18n } from "@/test/i18nTestUtils";
import RecoveryLayout from "../RecoveryLayout";

describe("RecoveryLayout", () => {
  it("renders route outlet content", async () => {
    await renderWithI18n(
      <MemoryRouter initialEntries={["/recovery"]}>
        <Routes>
          <Route path="/recovery" element={<RecoveryLayout />}>
            <Route index element={<div>Recovery Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Recovery Content")).toBeInTheDocument();
  });
});
