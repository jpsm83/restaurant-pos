import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithI18n } from "@/test/i18nTestUtils";
import { TableConfigEditor } from "../TableConfigEditor";

describe("TableConfigEditor", () => {
  it("renders columns and triggers save/cancel handlers", async () => {
    const onSave = vi.fn();
    const onCancel = vi.fn();

    await renderWithI18n(
      <TableConfigEditor
        columns={[
          {
            columnKey: "id",
            columnName: "ID",
            order: 0,
            enable: true,
            visible: true,
          },
        ]}
        onSave={onSave}
        onCancel={onCancel}
      />,
    );

    expect(screen.getByText("id")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("renders the column configuration labels in Spanish", async () => {
    await renderWithI18n(
      <TableConfigEditor
        columns={[
          {
            columnKey: "id",
            columnName: "ID",
            order: 0,
            enable: true,
            visible: true,
          },
        ]}
      />,
      { language: "es" },
    );

    expect(screen.getByRole("columnheader", { name: "Orden" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeInTheDocument();
  });
});
