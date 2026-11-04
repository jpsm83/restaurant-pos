/**
 * Contact-verification request hook — external cache behaviour.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useRequestBusinessContactVerificationMutation } from "../businessProfileApi";

const { mockPost } = vi.hoisted(() => ({ mockPost: vi.fn() }));

vi.mock("../../http", () => ({
  http: {
    get: vi.fn(),
    post: (...args: unknown[]) => mockPost(...args),
    patch: vi.fn(),
  },
}));

describe("useRequestBusinessContactVerificationMutation", () => {
  beforeEach(() => {
    mockPost.mockReset();
  });

  it("invalidates the Owner portfolio after a successful request", async () => {
    mockPost.mockResolvedValue({ data: { outcome: "sent" } });
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children);
    const { result } = renderHook(
      () => useRequestBusinessContactVerificationMutation(),
      { wrapper },
    );

    await act(async () => {
      await result.current.mutateAsync("b-1");
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["portfolio"] });
  });
});
