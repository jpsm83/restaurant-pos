import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithI18n } from "@/test/i18nTestUtils";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../sheet";

describe("Sheet", () => {
  it("renders sheet content when open with a translated close label", async () => {
    await renderWithI18n(
      <Sheet defaultOpen>
        <SheetContent aria-describedby={undefined}>
          <SheetHeader>
            <SheetTitle>Panel</SheetTitle>
            <SheetDescription>Details</SheetDescription>
          </SheetHeader>
        </SheetContent>
      </Sheet>,
    );
    expect(screen.getByText("Panel")).toBeInTheDocument();
    expect(screen.getByText("Details")).toBeInTheDocument();
    expect(screen.getByText("Close")).toBeInTheDocument();
  });

  it("renders the close label in Spanish", async () => {
    await renderWithI18n(
      <Sheet defaultOpen>
        <SheetContent aria-describedby={undefined}>
          <SheetHeader>
            <SheetTitle>Panel</SheetTitle>
            <SheetDescription>Details</SheetDescription>
          </SheetHeader>
        </SheetContent>
      </Sheet>,
      { language: "es" },
    );

    expect(screen.getByText("Cerrar")).toBeInTheDocument();
  });
});
