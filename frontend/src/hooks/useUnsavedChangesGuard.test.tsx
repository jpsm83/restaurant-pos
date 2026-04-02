import { useState } from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Link, MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { renderWithI18n } from "@/test/i18nTestUtils";
import { useUnsavedChangesGuard } from "./useUnsavedChangesGuard";

function GuardHarness(props: { initialDirty?: boolean; enabled?: boolean }) {
  const { initialDirty = false, enabled = true } = props;
  const [dirty, setDirty] = useState(initialDirty);
  const guard = useUnsavedChangesGuard({
    isDirty: dirty,
    enabled,
  });
  const location = useLocation();

  return (
    <div>
      <p data-testid="pathname">{location.pathname}</p>
      <p data-testid="dialog-state">{guard.isDialogOpen ? "open" : "closed"}</p>
      <button type="button" onClick={() => setDirty(true)}>
        mark-dirty
      </button>
      <button type="button" onClick={() => setDirty(false)}>
        clear-dirty
      </button>
      <button type="button" onClick={guard.stayOnPage}>
        stay
      </button>
      <button type="button" onClick={guard.leavePage}>
        leave
      </button>
      <Link to="/next">go-next</Link>
    </div>
  );
}

describe("useUnsavedChangesGuard", () => {
  function renderWithMemoryRouter(initialPath = "/form", initialDirty = false) {
    return renderWithI18n(
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/form" element={<GuardHarness initialDirty={initialDirty} />} />
          <Route path="/next" element={<div>Next route</div>} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it("blocks route transition when dirty and opens dialog state", async () => {
    const user = userEvent.setup();

    await renderWithMemoryRouter("/form");

    await user.click(screen.getByRole("button", { name: "mark-dirty" }));
    await user.click(screen.getByRole("link", { name: "go-next" }));

    expect(screen.getByTestId("pathname")).toHaveTextContent("/form");
    expect(screen.getByTestId("dialog-state")).toHaveTextContent("open");
  });

  it("stays on current route when stay action is used", async () => {
    const user = userEvent.setup();

    await renderWithMemoryRouter("/form");

    await user.click(screen.getByRole("button", { name: "mark-dirty" }));
    await user.click(screen.getByRole("link", { name: "go-next" }));
    await user.click(screen.getByRole("button", { name: "stay" }));

    expect(screen.getByTestId("pathname")).toHaveTextContent("/form");
    expect(screen.getByTestId("dialog-state")).toHaveTextContent("closed");
  });

  it("proceeds to next route when leave action is used", async () => {
    const user = userEvent.setup();

    await renderWithMemoryRouter("/form");

    await user.click(screen.getByRole("button", { name: "mark-dirty" }));
    await user.click(screen.getByRole("link", { name: "go-next" }));
    await user.click(screen.getByRole("button", { name: "leave" }));

    expect(screen.getByText("Next route")).toBeInTheDocument();
  });

  it("registers beforeunload listener only while guard is active", async () => {
    const user = userEvent.setup();
    const addSpy = vi.spyOn(window, "addEventListener");
    const removeSpy = vi.spyOn(window, "removeEventListener");

    await renderWithMemoryRouter("/form", true);

    expect(
      addSpy.mock.calls.some((call) => call[0] === "beforeunload"),
    ).toBe(true);

    await user.click(screen.getByRole("button", { name: "clear-dirty" }));
    expect(
      removeSpy.mock.calls.some((call) => call[0] === "beforeunload"),
    ).toBe(true);

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });
});
