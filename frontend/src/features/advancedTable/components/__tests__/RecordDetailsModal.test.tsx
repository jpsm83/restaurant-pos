import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RecordDetailsModal } from "../RecordDetailsModal";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? _key,
  }),
}));

describe("RecordDetailsModal", () => {
  it("renders when open and triggers close/next/previous callbacks", async () => {
    const onClose = vi.fn();
    const onNext = vi.fn();
    const onPrevious = vi.fn();

    render(
      <RecordDetailsModal
        open
        title="Details"
        onClose={onClose}
        onNext={onNext}
        onPrevious={onPrevious}
        canGoNext
        canGoPrevious
      >
        <div>Body content</div>
      </RecordDetailsModal>,
    );

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Body content")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Previous record" }));
    fireEvent.click(screen.getByRole("button", { name: "Next record" }));
    fireEvent.click(screen.getByRole("button", { name: "Close details modal" }));

    expect(onPrevious).toHaveBeenCalledTimes(1);
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
