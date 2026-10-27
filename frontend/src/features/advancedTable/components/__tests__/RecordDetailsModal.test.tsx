import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithI18n } from "@/test/i18nTestUtils";
import { RecordDetailsModal } from "../RecordDetailsModal";

describe("RecordDetailsModal", () => {
  it("renders when open and triggers close/next/previous callbacks", async () => {
    const onClose = vi.fn();
    const onNext = vi.fn();
    const onPrevious = vi.fn();

    await renderWithI18n(
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

  it("localizes record navigation labels in Spanish", async () => {
    await renderWithI18n(
      <RecordDetailsModal open title="Detalles" onClose={vi.fn()}>
        <div>Contenido</div>
      </RecordDetailsModal>,
      { language: "es" },
    );

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Registro anterior" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Siguiente registro" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Cerrar modal de detalles" }),
    ).toBeInTheDocument();
  });
});
