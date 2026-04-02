import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithI18n } from "@/test/i18nTestUtils";
import { UnsavedChangesDialog } from "./UnsavedChangesDialog";

describe("UnsavedChangesDialog", () => {
  it("renders configurable copy and action labels", async () => {
    await renderWithI18n(
      <UnsavedChangesDialog
        open
        onStay={vi.fn()}
        onLeave={vi.fn()}
        title="Unsaved profile edits"
        description="Leave now and discard draft?"
        stayLabel="Keep editing"
        leaveLabel="Discard and leave"
      />,
    );

    expect(screen.getByRole("heading", { name: "Unsaved profile edits" })).toBeInTheDocument();
    expect(screen.getByText("Leave now and discard draft?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Keep editing" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Discard and leave" })).toBeInTheDocument();
  });

  it("triggers stay/leave callbacks from action buttons", async () => {
    const user = userEvent.setup();
    const onStay = vi.fn();
    const onLeave = vi.fn();
    await renderWithI18n(
      <UnsavedChangesDialog open onStay={onStay} onLeave={onLeave} />,
    );

    await user.click(screen.getByRole("button", { name: "Stay on page" }));
    await user.click(screen.getByRole("button", { name: "Leave without saving" }));

    expect(onStay).toHaveBeenCalledTimes(1);
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it("disables leave action while leaving is in progress", async () => {
    await renderWithI18n(
      <UnsavedChangesDialog open onStay={vi.fn()} onLeave={vi.fn()} isLeaving />,
    );

    expect(screen.getByRole("button", { name: "Leaving..." })).toBeDisabled();
  });
});
