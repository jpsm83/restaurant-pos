import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { buttonVariants } from "ui/button-variants";
import { Button } from "ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "ui/card";
import { cn } from "ui/utils";

const require = createRequire(import.meta.url);

/**
 * Workspace-boundary smoke test: the design system resolves itself by package
 * name through the root npm workspace, not a relative path.
 */
describe("ui package resolution", () => {
  it("exposes the primitives and the cn helper by package name", () => {
    render(
      <>
        <Button type="button">Save</Button>
        <Card>
          <CardHeader>
            <CardTitle>Card</CardTitle>
          </CardHeader>
          <CardContent>Body</CardContent>
        </Card>
      </>,
    );

    expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute(
      "data-slot",
      "button",
    );
    expect(screen.getByText("Card")).toBeInTheDocument();

    expect(cn("p-2", "p-4")).toBe("p-4");
    expect(buttonVariants({ size: "lg" })).toContain("h-10");
  });

  it("exposes the design tokens by package name", () => {
    const tokens = readFileSync(require.resolve("ui/tailwind.css"), "utf8");
    expect(tokens).toContain("--background: oklch(1 0 0)");
    expect(tokens).toContain(".dark {");
  });
});

