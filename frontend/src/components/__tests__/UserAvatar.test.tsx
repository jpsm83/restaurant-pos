import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { UserAvatar } from "@/components/UserAvatar";
import { renderWithI18n } from "@/test/i18nTestUtils";

describe("UserAvatar", () => {
  it("renders the stored picture without leaking the app referrer to the image host", async () => {
    await renderWithI18n(
      <UserAvatar
        imageUrl="https://lh3.googleusercontent.com/a/avatar.png"
        fallback="pat.lee@example.com"
        alt="Profile picture"
      />,
    );

    const image = screen.getByRole("img", { name: "Profile picture" });
    expect(image.tagName).toBe("IMG");
    expect(image).toHaveAttribute(
      "src",
      "https://lh3.googleusercontent.com/a/avatar.png",
    );
    expect(image).toHaveAttribute("referrerpolicy", "no-referrer");
  });

  it("falls back to initials when the remote picture fails", async () => {
    await renderWithI18n(
      <UserAvatar
        imageUrl="https://lh3.googleusercontent.com/a/expired.png"
        fallback="Pat Lee"
        alt="Profile picture"
      />,
    );

    fireEvent.error(screen.getByRole("img", { name: "Profile picture" }));

    const fallback = screen.getByRole("img", { name: "Profile picture" });
    expect(fallback.tagName).not.toBe("IMG");
    expect(fallback).toHaveTextContent("PL");
  });

  it("renders initials when no picture is stored", async () => {
    await renderWithI18n(
      <UserAvatar fallback="owner@example.com" alt="Profile picture" />,
    );

    expect(
      screen.getByRole("img", { name: "Profile picture" }),
    ).toHaveTextContent("OW");
  });
});
