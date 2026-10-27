import { describe, expect, it } from "vitest";
import { createTestI18n } from "../i18nTestUtils";

describe("createTestI18n", () => {
  it("creates isolated English and Spanish instances", async () => {
    const en = await createTestI18n("en");
    const es = await createTestI18n("es");

    expect(en.language).toBe("en");
    expect(es.language).toBe("es");
    expect(en.t("loading.session")).toBe("Loading session…");
    expect(es.t("loading.session")).toBe("Cargando sesión…");
  });
});
