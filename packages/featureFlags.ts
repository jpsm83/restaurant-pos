/**
 * Closed, platform-defined stage-1 feature-flag catalogue and resolver.
 *
 * These are product data, not venue data: a product amendment changes this
 * module. Every flag is a kill-switch that defaults **on**. There is no database
 * collection, seed, migration, HTTP route, console, or audit trail here, and
 * there is no per-venue, per-Company, or per-user scope. The resolver takes the
 * per-Owner state from the caller so the module stays pure.
 */

export const FEATURE_FLAG_STATES = {
  ON: "on",
  OFF: "off",
} as const;

export type FeatureFlagState =
  (typeof FEATURE_FLAG_STATES)[keyof typeof FEATURE_FLAG_STATES];

export type FeatureFlagKey =
  | "corePosAndMenu"
  | "printersAndScreens"
  | "floorPlans"
  | "promotions"
  | "ratingsAndComments"
  | "giftCards"
  | "reservationsAndHost"
  | "suppliersPurchasesAndInventory"
  | "employeesSchedulesAndTimeControl"
  | "payrollExport"
  | "dailySalesReports"
  | "weeklyBusinessReports"
  | "monthlyPnlAndAdvancedMetrics";

export interface FeatureFlagDefinition {
  /** Stable machine key. Never reworded with the label. */
  readonly key: FeatureFlagKey;
  /** Canonical English label shown by a later console or support notice. */
  readonly label: string;
  readonly defaultState: FeatureFlagState;
}

const CATALOGUE = [
  {
    key: "corePosAndMenu",
    label: "Core POS and menu",
    defaultState: FEATURE_FLAG_STATES.ON,
  },
  {
    key: "printersAndScreens",
    label: "Printers and screens",
    defaultState: FEATURE_FLAG_STATES.ON,
  },
  {
    key: "floorPlans",
    label: "Floor plans",
    defaultState: FEATURE_FLAG_STATES.ON,
  },
  {
    key: "promotions",
    label: "Promotions",
    defaultState: FEATURE_FLAG_STATES.ON,
  },
  {
    key: "ratingsAndComments",
    label: "Ratings and comments",
    defaultState: FEATURE_FLAG_STATES.ON,
  },
  {
    key: "giftCards",
    label: "Gift cards",
    defaultState: FEATURE_FLAG_STATES.ON,
  },
  {
    key: "reservationsAndHost",
    label: "Reservations and Host",
    defaultState: FEATURE_FLAG_STATES.ON,
  },
  {
    key: "suppliersPurchasesAndInventory",
    label: "Suppliers, purchases, and inventory",
    defaultState: FEATURE_FLAG_STATES.ON,
  },
  {
    key: "employeesSchedulesAndTimeControl",
    label: "Employees, schedules, and time control",
    defaultState: FEATURE_FLAG_STATES.ON,
  },
  {
    key: "payrollExport",
    label: "Payroll export",
    defaultState: FEATURE_FLAG_STATES.ON,
  },
  {
    key: "dailySalesReports",
    label: "Daily sales reports",
    defaultState: FEATURE_FLAG_STATES.ON,
  },
  {
    key: "weeklyBusinessReports",
    label: "Weekly business reports",
    defaultState: FEATURE_FLAG_STATES.ON,
  },
  {
    key: "monthlyPnlAndAdvancedMetrics",
    label: "Full monthly P&L and advanced metrics",
    defaultState: FEATURE_FLAG_STATES.ON,
  },
] as const satisfies readonly FeatureFlagDefinition[];

/** The closed stage-1 list. Adding a flag is a reviewed catalogue amendment. */
export const FEATURE_FLAG_CATALOGUE: readonly FeatureFlagDefinition[] =
  Object.freeze(CATALOGUE.map((flag) => Object.freeze(flag)));

/**
 * Optional platform-wide and per-Owner states. A missing property means unset;
 * there is no explicit unset value.
 */
export interface FeatureFlagScopes {
  readonly platform?: FeatureFlagState;
  readonly owner?: FeatureFlagState;
}

const catalogueByKey = new Map<string, FeatureFlagDefinition>(
  FEATURE_FLAG_CATALOGUE.map((flag) => [flag.key, flag]),
);

function assertState(value: unknown, scope: string): asserts value is FeatureFlagState {
  if (value !== FEATURE_FLAG_STATES.ON && value !== FEATURE_FLAG_STATES.OFF) {
    throw new Error(`Invalid ${scope} feature flag state: ${String(value)}`);
  }
}

/**
 * Resolves one flag's effective state. Unset means on; a platform-wide `off`
 * beats any per-Owner value; otherwise a per-Owner `off` applies. Unknown flag
 * keys and states outside `on`/`off` are programming errors, so they throw.
 */
export function resolveFeatureFlag(
  key: string,
  scopes: FeatureFlagScopes = {},
): FeatureFlagState {
  const definition = catalogueByKey.get(key);
  if (!definition) {
    throw new Error(`Unknown feature flag: ${String(key)}`);
  }

  const { platform, owner } = scopes;

  if (platform !== undefined) assertState(platform, "platform-wide");
  if (owner !== undefined) assertState(owner, "per-Owner");

  if (platform === FEATURE_FLAG_STATES.OFF) return FEATURE_FLAG_STATES.OFF;
  if (owner === FEATURE_FLAG_STATES.OFF) return FEATURE_FLAG_STATES.OFF;
  return definition.defaultState;
}

/** Boolean convenience for a simple mutation guard. Delegates to the resolver. */
export function isFeatureFlagOn(
  key: string,
  scopes: FeatureFlagScopes = {},
): boolean {
  return resolveFeatureFlag(key, scopes) === FEATURE_FLAG_STATES.ON;
}
