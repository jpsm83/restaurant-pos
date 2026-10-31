/**
 * Closed, shared access vocabulary.
 *
 * These are product data, not venue data: a product amendment changes this
 * module. It defines the five base access layers, the canonical job-role to
 * default-layer map, the thin platform capability catalogue, and each layer's
 * default capabilities. There is no persistence, HTTP, or UI here.
 */

/** All five layers. Customer sits outside the business-membership ordering. */
export const ACCESS_LAYERS = [
  "customer",
  "employee",
  "supervisor",
  "manager",
  "admin",
] as const;

export type AccessLayer = (typeof ACCESS_LAYERS)[number];

/** Business-membership ordering, lowest to highest. Customer is not a member. */
export const BUSINESS_ACCESS_LAYERS = [
  "employee",
  "supervisor",
  "manager",
  "admin",
] as const;

export type BusinessAccessLayer = (typeof BUSINESS_ACCESS_LAYERS)[number];

/**
 * Returns the ordering rank of a layer. Customer ranks below employee so every
 * User is always a customer first; business membership starts at employee.
 * Unknown values are programming errors and throw.
 */
export function accessLayerRank(layer: string): number {
  const rank = ACCESS_LAYERS.indexOf(layer as AccessLayer);
  if (rank === -1) {
    throw new Error(`Unknown access layer: ${String(layer)}`);
  }
  return rank;
}

/** Negative when `left` is lower than `right`, zero when equal, positive above. */
export function compareAccessLayers(left: AccessLayer, right: AccessLayer): number {
  return accessLayerRank(left) - accessLayerRank(right);
}

const JOB_ROLE_DEFAULTS = {
  Owner: "admin",
  Admin: "admin",
  "General Manager": "manager",
  Manager: "manager",
  "Assistant Manager": "manager",
  MoD: "manager",
  Supervisor: "supervisor",
  Operator: "employee",
  Employee: "employee",
  Cashier: "employee",
  "Floor Staff": "employee",
  Bartender: "employee",
  Barista: "employee",
  Waiter: "employee",
  "Head Chef": "employee",
  "Sous Chef": "employee",
  "Line Cooks": "employee",
  "Kitchen Porter": "employee",
  Cleaner: "employee",
  Security: "employee",
  Host: "employee",
  Runner: "employee",
  Entertainer: "employee",
  Other: "employee",
} as const satisfies Record<string, BusinessAccessLayer>;

export type CanonicalJobRole = keyof typeof JOB_ROLE_DEFAULTS;

/**
 * Canonical job-role → default-layer map. Every role in `userRolesEnums` has
 * exactly one entry. Changing a role's default is a product amendment.
 */
export const JOB_ROLE_DEFAULT_LAYERS: Readonly<
  Record<CanonicalJobRole, BusinessAccessLayer>
> = Object.freeze(JOB_ROLE_DEFAULTS);

/**
 * One job role's default layer. Empty or unknown legacy roles fall back to
 * employee, never to a higher layer.
 */
export function getDefaultAccessLayerForJobRole(jobRole: string): BusinessAccessLayer {
  if (!Object.hasOwn(JOB_ROLE_DEFAULT_LAYERS, jobRole)) return "employee";
  return JOB_ROLE_DEFAULT_LAYERS[jobRole as CanonicalJobRole];
}

/**
 * Highest default layer among a membership's job roles. An empty or fully
 * unknown legacy role set resolves defensively to employee.
 */
export function resolveDefaultAccessLayerForRoles(
  jobRoles: readonly string[] = [],
): BusinessAccessLayer {
  let highest: BusinessAccessLayer = "employee";
  for (const jobRole of jobRoles) {
    const layer = getDefaultAccessLayerForJobRole(jobRole);
    if (compareAccessLayers(layer, highest) > 0) highest = layer;
  }
  return highest;
}

export interface AccessCapabilityDefinition {
  /** Stable machine key. Never reworded with the label. */
  readonly key: AccessCapabilityKey;
  /** Canonical English label. */
  readonly label: string;
}

export type AccessCapabilityKey =
  | "openPrepScreens"
  | "openDeliveryScreen"
  | "openCustomerPickupBoard"
  | "printPermission"
  | "markClearManualUnavailability"
  | "viewInventory"
  | "viewDailySalesReport"
  | "viewWeeklyAndMonthlyBusinessReports";

const CAPABILITY_CATALOGUE = [
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
] as const satisfies readonly AccessCapabilityDefinition[];

/** The closed platform capability catalogue. Adding one is a product amendment. */
export const ACCESS_CAPABILITY_CATALOGUE: readonly AccessCapabilityDefinition[] =
  Object.freeze(CAPABILITY_CATALOGUE.map((capability) => Object.freeze(capability)));

const SERVICE_FLOOR_CAPABILITIES = [
  "openPrepScreens",
  "openDeliveryScreen",
  "openCustomerPickupBoard",
  "printPermission",
] as const satisfies readonly AccessCapabilityKey[];

const OPS_CAPABILITIES = [
  "markClearManualUnavailability",
  "viewInventory",
  "viewDailySalesReport",
  "viewWeeklyAndMonthlyBusinessReports",
] as const satisfies readonly AccessCapabilityKey[];

const MANAGEMENT_CAPABILITIES = Object.freeze([
  ...SERVICE_FLOOR_CAPABILITIES,
  ...OPS_CAPABILITIES,
]);

/**
 * Layer-default capabilities. Employee defaults are empty; supervisor holds the
 * full service/floor set; manager and admin hold service/floor plus ops.
 */
export const ACCESS_LAYER_DEFAULT_CAPABILITIES: Readonly<
  Record<AccessLayer, readonly AccessCapabilityKey[]>
> = Object.freeze({
  customer: Object.freeze([]),
  employee: Object.freeze([]),
  supervisor: Object.freeze([...SERVICE_FLOOR_CAPABILITIES]),
  manager: MANAGEMENT_CAPABILITIES,
  admin: MANAGEMENT_CAPABILITIES,
});

export function getDefaultCapabilities(layer: AccessLayer): readonly AccessCapabilityKey[] {
  return ACCESS_LAYER_DEFAULT_CAPABILITIES[layer];
}
