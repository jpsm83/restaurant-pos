import { describe, expect, it } from "vitest";

import { userRolesEnums } from "restaurant-pos-packages/enums";
import {
  ACCESS_CAPABILITY_CATALOGUE,
  ACCESS_LAYER_DEFAULT_CAPABILITIES,
  ACCESS_LAYERS,
  BUSINESS_ACCESS_LAYERS,
  JOB_ROLE_DEFAULT_LAYERS,
  accessLayerRank,
  compareAccessLayers,
  getDefaultAccessLayerForJobRole,
  getDefaultCapabilities,
  resolveDefaultAccessLayerForRoles,
  type AccessLayer,
} from "restaurant-pos-packages/access";

const SERVICE_FLOOR_KEYS = [
  "openPrepScreens",
  "openDeliveryScreen",
  "openCustomerPickupBoard",
  "printPermission",
] as const;

const OPS_KEYS = [
  "markClearManualUnavailability",
  "viewInventory",
  "viewDailySalesReport",
  "viewWeeklyAndMonthlyBusinessReports",
] as const;

const EXPECTED_CAPABILITIES = [
  { key: "openPrepScreens", label: "Open prep screens" },
  { key: "openDeliveryScreen", label: "Open delivery screen" },
  { key: "openCustomerPickupBoard", label: "Open customer pickup board" },
  { key: "printPermission", label: "Print permission" },
  {
    key: "markClearManualUnavailability",
    label: "Mark / clear manual unavailability",
  },
  { key: "viewInventory", label: "View inventory" },
  { key: "viewDailySalesReport", label: "View daily sales report" },
  {
    key: "viewWeeklyAndMonthlyBusinessReports",
    label: "View weekly and monthly business reports",
  },
] as const;

describe("access layer ordering", () => {
  it("defines the five layers with customer outside the membership ordering", () => {
    expect(ACCESS_LAYERS).toEqual([
      "customer",
      "employee",
      "supervisor",
      "manager",
      "admin",
    ]);
    expect(BUSINESS_ACCESS_LAYERS).toEqual([
      "employee",
      "supervisor",
      "manager",
      "admin",
    ]);
    expect(BUSINESS_ACCESS_LAYERS).not.toContain("customer");
  });

  it("orders membership layers employee < supervisor < manager < admin", () => {
    const ordered = [...BUSINESS_ACCESS_LAYERS];

    for (let lower = 0; lower < ordered.length; lower += 1) {
      for (let higher = lower + 1; higher < ordered.length; higher += 1) {
        expect(compareAccessLayers(ordered[lower], ordered[higher])).toBeLessThan(0);
        expect(compareAccessLayers(ordered[higher], ordered[lower])).toBeGreaterThan(0);
      }
    }

    for (const layer of ordered) {
      expect(compareAccessLayers(layer, layer)).toBe(0);
    }
  });

  it("ranks customer below every membership layer", () => {
    expect(accessLayerRank("customer")).toBeLessThan(accessLayerRank("employee"));

    for (const layer of BUSINESS_ACCESS_LAYERS) {
      expect(compareAccessLayers("customer", layer)).toBeLessThan(0);
    }
  });

  it("throws for an unknown layer, including inherited object names", () => {
    expect(() => accessLayerRank("owner" as AccessLayer)).toThrow(
      /unknown access layer/i,
    );
    expect(() => accessLayerRank("toString")).toThrow(/unknown access layer/i);
  });
});

describe("job-role default layer map", () => {
  it("maps every canonical job role and no extra keys", () => {
    const mappedRoles = Object.keys(JOB_ROLE_DEFAULT_LAYERS);

    expect(new Set(mappedRoles).size).toBe(mappedRoles.length);
    expect([...mappedRoles].sort()).toEqual([...userRolesEnums].sort());
  });

  it("maps Owner and Admin to admin", () => {
    expect(JOB_ROLE_DEFAULT_LAYERS.Owner).toBe("admin");
    expect(JOB_ROLE_DEFAULT_LAYERS.Admin).toBe("admin");
  });

  it("maps General Manager, Manager, Assistant Manager, and MoD to manager", () => {
    for (const role of ["General Manager", "Manager", "Assistant Manager", "MoD"]) {
      expect(getDefaultAccessLayerForJobRole(role), role).toBe("manager");
    }
  });

  it("maps Supervisor to supervisor", () => {
    expect(JOB_ROLE_DEFAULT_LAYERS.Supervisor).toBe("supervisor");
  });

  it("maps every other canonical job role to employee", () => {
    const nonEmployeeRoles = new Set([
      "Owner",
      "Admin",
      "General Manager",
      "Manager",
      "Assistant Manager",
      "MoD",
      "Supervisor",
    ]);

    for (const role of userRolesEnums) {
      if (nonEmployeeRoles.has(role)) continue;
      expect(getDefaultAccessLayerForJobRole(role), role).toBe("employee");
    }
  });

  it("keeps the map runtime-immutable", () => {
    expect(Object.isFrozen(JOB_ROLE_DEFAULT_LAYERS)).toBe(true);
  });
});

describe("job-role set resolution", () => {
  it("resolves empty and unknown legacy role sets defensively to employee", () => {
    for (const legacyRole of [
      "",
      "Legacy Shift Lead",
      "constructor",
      "toString",
      "__proto__",
      "hasOwnProperty",
    ]) {
      expect(getDefaultAccessLayerForJobRole(legacyRole), legacyRole).toBe("employee");
    }

    expect(resolveDefaultAccessLayerForRoles()).toBe("employee");
    expect(resolveDefaultAccessLayerForRoles([])).toBe("employee");
    expect(resolveDefaultAccessLayerForRoles(["Legacy Role", "Unknown"])).toBe(
      "employee",
    );
  });

  it("resolves the highest default layer among several roles", () => {
    expect(resolveDefaultAccessLayerForRoles(["Waiter", "Manager"])).toBe("manager");
    expect(resolveDefaultAccessLayerForRoles(["Supervisor", "Owner"])).toBe("admin");
    expect(
      resolveDefaultAccessLayerForRoles(["Legacy Role", "Supervisor"]),
    ).toBe("supervisor");
  });
});

describe("capability catalogue", () => {
  it("exports exactly the eight stable capabilities with canonical labels", () => {
    expect(
      ACCESS_CAPABILITY_CATALOGUE.map(({ key, label }) => ({ key, label })),
    ).toEqual(EXPECTED_CAPABILITIES);
  });

  it("keeps every capability key unique", () => {
    const keys = ACCESS_CAPABILITY_CATALOGUE.map((capability) => capability.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("is runtime-immutable", () => {
    expect(Object.isFrozen(ACCESS_CAPABILITY_CATALOGUE)).toBe(true);
    for (const capability of ACCESS_CAPABILITY_CATALOGUE) {
      expect(Object.isFrozen(capability), capability.key).toBe(true);
    }
  });
});

describe("layer-default capabilities", () => {
  const catalogueKeys = new Set(
    ACCESS_CAPABILITY_CATALOGUE.map((capability) => capability.key),
  );

  it("defines defaults for exactly the five layers", () => {
    expect(Object.keys(ACCESS_LAYER_DEFAULT_CAPABILITIES).sort()).toEqual(
      [...ACCESS_LAYERS].sort(),
    );
  });

  it("gives customer and employee no catalogue capabilities", () => {
    expect(getDefaultCapabilities("customer")).toEqual([]);
    expect(getDefaultCapabilities("employee")).toEqual([]);
  });

  it("gives supervisor the full service/floor set", () => {
    expect(getDefaultCapabilities("supervisor")).toEqual([...SERVICE_FLOOR_KEYS]);
  });

  it("gives manager and admin the service/floor and ops sets", () => {
    for (const layer of ["manager", "admin"] as const) {
      expect(getDefaultCapabilities(layer)).toEqual([
        ...SERVICE_FLOOR_KEYS,
        ...OPS_KEYS,
      ]);
    }
  });

  it("only ever references catalogue keys, without duplicates", () => {
    for (const layer of ACCESS_LAYERS) {
      const capabilities = getDefaultCapabilities(layer);
      expect(new Set(capabilities).size, `${layer} has no duplicates`).toBe(
        capabilities.length,
      );
      for (const capability of capabilities) {
        expect(catalogueKeys.has(capability), `${layer}: ${capability}`).toBe(true);
      }
    }
  });

  it("keeps each default set and the map runtime-immutable", () => {
    expect(Object.isFrozen(ACCESS_LAYER_DEFAULT_CAPABILITIES)).toBe(true);
    for (const layer of ACCESS_LAYERS) {
      expect(
        Object.isFrozen(ACCESS_LAYER_DEFAULT_CAPABILITIES[layer]),
        layer,
      ).toBe(true);
    }
  });
});
