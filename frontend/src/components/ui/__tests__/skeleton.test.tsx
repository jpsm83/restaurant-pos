import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Skeleton } from "../skeleton";

describe("Skeleton", () => {
  it("renders placeholder with data-slot", () => {
    const { container } = render(<Skeleton className="h-4 w-20" />);
    expect(container.querySelector('[data-slot="skeleton"]')).toBeTruthy();
  });
});
