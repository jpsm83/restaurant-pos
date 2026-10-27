import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SUPPORTED_LANGUAGES } from "@/i18n/config";
import { useLanguageOptions } from "../useLanguageOptions";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => `mock:${key}`,
  }),
}));

describe("useLanguageOptions", () => {
  it("returns one option per shared supported language", () => {
    const { result } = renderHook(() => useLanguageOptions());

    expect(result.current.map((o) => o.value)).toEqual([...SUPPORTED_LANGUAGES]);
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
