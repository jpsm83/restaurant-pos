import { describe, it, expect } from "vitest";

import {
  resolveTimezoneFromAddress,
} from "../../../packages/utils/timezoneFromAddress.ts";
import { isSupportedTimezone } from "../../../packages/schemas/index.ts";

describe("resolveTimezoneFromAddress", () => {
  it("uses the state to disambiguate a multi-zone country", () => {
    expect(
      resolveTimezoneFromAddress({ country: "United States", state: "California" }),
    ).toBe("America/Los_Angeles");
    expect(
      resolveTimezoneFromAddress({ country: "United States", state: "New York" }),
    ).toBe("America/New_York");
    expect(
      resolveTimezoneFromAddress({ country: "United States", state: "Texas" }),
    ).toBe("America/Chicago");
    expect(
      resolveTimezoneFromAddress({ country: "United States", state: "Hawaii" }),
    ).toBe("Pacific/Honolulu");
  });

  it("accepts state and country codes", () => {
    expect(
      resolveTimezoneFromAddress({ country: "US", state: "CA" }),
    ).toBe("America/Los_Angeles");
    expect(
      resolveTimezoneFromAddress({ country: "us", state: "ny" }),
    ).toBe("America/New_York");
    expect(
      resolveTimezoneFromAddress({ country: "CO", state: "Bogotá D.C." }),
    ).toBe("America/Bogota");
  });

  it("resolves state names for the other curated countries", () => {
    expect(
      resolveTimezoneFromAddress({ country: "Canada", state: "Ontario" }),
    ).toBe("America/Toronto");
    expect(
      resolveTimezoneFromAddress({ country: "Australia", state: "New South Wales" }),
    ).toBe("Australia/Sydney");
    expect(
      resolveTimezoneFromAddress({ country: "Australia", state: "WA" }),
    ).toBe("Australia/Perth");
    expect(
      resolveTimezoneFromAddress({ country: "Brazil", state: "Amazonas" }),
    ).toBe("America/Manaus");
    expect(
      resolveTimezoneFromAddress({ country: "Brasil", state: "São Paulo" }),
    ).toBe("America/Sao_Paulo");
    expect(
      resolveTimezoneFromAddress({ country: "Mexico", state: "Jalisco" }),
    ).toBe("America/Mexico_City");
    expect(
      resolveTimezoneFromAddress({ country: "Mexico", state: "Baja California" }),
    ).toBe("America/Tijuana");
    expect(
      resolveTimezoneFromAddress({ country: "Spain", state: "Canarias" }),
    ).toBe("Atlantic/Canary");
    expect(
      resolveTimezoneFromAddress({ country: "Portugal", state: "Azores" }),
    ).toBe("Atlantic/Azores");
  });

  it("falls back to the country primary zone when the state is unknown", () => {
    expect(
      resolveTimezoneFromAddress({ country: "United States", state: "Atlantis" }),
    ).toBe("America/New_York");
    expect(
      resolveTimezoneFromAddress({ country: "Brazil" }),
    ).toBe("America/Sao_Paulo");
  });

  it("resolves single-zone countries from name or code", () => {
    expect(
      resolveTimezoneFromAddress({ country: "Colombia", state: "Antioquia" }),
    ).toBe("America/Bogota");
    expect(
      resolveTimezoneFromAddress({ country: "Japan", state: "Tokyo" }),
    ).toBe("Asia/Tokyo");
  });

  it("accepts common country aliases", () => {
    expect(
      resolveTimezoneFromAddress({ country: "USA", state: "FL" }),
    ).toBe("America/New_York");
    expect(
      resolveTimezoneFromAddress({ country: "uk", state: "England" }),
    ).toBe("Europe/London");
    expect(
      resolveTimezoneFromAddress({ country: "Holland" }),
    ).toBe("Europe/Amsterdam");
  });

  it("returns undefined when the country cannot be resolved", () => {
    expect(resolveTimezoneFromAddress({ country: "Atlantis" })).toBeUndefined();
    expect(resolveTimezoneFromAddress({ country: "" })).toBeUndefined();
    expect(resolveTimezoneFromAddress({})).toBeUndefined();
    expect(resolveTimezoneFromAddress(null)).toBeUndefined();
    expect(
      resolveTimezoneFromAddress({ country: 123 as unknown as string }),
    ).toBeUndefined();
  });

  it("normalizes mixed case and punctuation in country names", () => {
    expect(
      resolveTimezoneFromAddress({ country: "  united states  ", state: "AL" }),
    ).toBe("America/Chicago");
    expect(
      resolveTimezoneFromAddress({ country: "Côte d'Ivoire" }),
    ).toBe("Africa/Abidjan");
  });
});

describe("timezone data integrity", () => {
  it("only emits zones the shared schema accepts", async () => {
    const { COUNTRY_PRIMARY_TIMEZONE, STATE_TIMEZONES } = await import(
      "../../../packages/utils/timezoneData.ts"
    );

    for (const zone of Object.values(COUNTRY_PRIMARY_TIMEZONE)) {
      expect(isSupportedTimezone(zone), zone).toBe(true);
    }
    for (const states of Object.values(STATE_TIMEZONES)) {
      for (const zone of Object.values(states)) {
        expect(isSupportedTimezone(zone), zone).toBe(true);
      }
    }
  });
});
