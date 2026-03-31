import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SUPPORTED_LANGUAGES, useLanguageOptions } from "./useLanguageOptions";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => `mock:${key}`,
  }),
}));

describe("useLanguageOptions", () => {
  it("returns 2 entries with expected value codes", () => {
    const { result } = renderHook(() => useLanguageOptions());

    expect(result.current).toHaveLength(2);
    expect(result.current.map((o) => o.value)).toEqual(
      SUPPORTED_LANGUAGES.map((l) => l.code),
    );
  });

  it("uses mocked useTranslation for labels", () => {
    const { result } = renderHook(() => useLanguageOptions());

    expect(result.current[0]).toEqual({
      value: "en",
      label: "mock:languages.en",
    });
    expect(result.current[1]).toEqual({
      value: "es",
      label: "mock:languages.es",
    });
  });
});
