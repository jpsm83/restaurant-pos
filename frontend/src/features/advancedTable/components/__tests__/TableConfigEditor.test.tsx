import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TableConfigEditor } from "../TableConfigEditor";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? _key,
  }),
}));

describe("TableConfigEditor", () => {
  it("renders columns and triggers save/cancel handlers", () => {
    const onSave = vi.fn();
    const onCancel = vi.fn();

    render(
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
});
