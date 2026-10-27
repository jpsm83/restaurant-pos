import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../sheet";

describe("Sheet", () => {
  it("renders sheet content when open", () => {
    render(
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
  });

  it("scrims with the overlay token", () => {
    render(
      <Sheet defaultOpen>
        <SheetContent aria-describedby={undefined}>
          <SheetHeader>
            <SheetTitle>Panel</SheetTitle>
          </SheetHeader>
        </SheetContent>
      </Sheet>,
    );
    expect(
      document.querySelector('[data-slot="sheet-overlay"]'),
    ).toHaveClass("bg-overlay");
  });
});
