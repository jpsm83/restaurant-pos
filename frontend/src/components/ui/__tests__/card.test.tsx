import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../card";

describe("Card", () => {
  it("renders card structure", () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Title</CardTitle>
          <CardDescription>Desc</CardDescription>
        </CardHeader>
        <CardContent>Body</CardContent>
      </Card>,
    );
    expect(screen.getByRole("heading", { level: 3, name: "Title" })).toBeInTheDocument();
    expect(screen.getByText("Desc")).toBeInTheDocument();
    expect(screen.getByText("Body")).toBeInTheDocument();
  });

  it("uses semantic surface tokens", () => {
    render(
      <Card>
        <CardDescription>Desc</CardDescription>
      </Card>,
    );
    const card = screen.getByText("Desc").parentElement;
    expect(card).toHaveClass("bg-card", "text-card-foreground", "border-border");
    expect(screen.getByText("Desc")).toHaveClass("text-muted-foreground");
  });
});
