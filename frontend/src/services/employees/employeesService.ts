/**
 * Venue membership and access service.
 *
 * ## Flow
 * - `fetchBusinessAccessSnapshot` — `GET /api/v1/business/:businessId/access`
 *   resolves the signed-in User's effective layer at the venue.
 * - `fetchVenueMemberships` — `GET /api/v1/employees/business/:businessId`
 *   returns the manager-visible membership list with linked User identity.
 * - `fetchEmployeeMembership` — `GET /api/v1/employees/:employeeId` returns
 *   the manager record or the caller's non-sensitive self-view.
 * - `hireEmployee` — `POST /api/v1/employees` links an existing User by sign-in
 *   email; the hire is deliberately limited to roles, status, and join date.
 *
 * Hooks expose stable `queryKeys` entries for the access snapshot, the venue
 * list, and one membership. A successful hire invalidates the venue list.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BUSINESS_ACCESS_LAYERS,
  compareAccessLayers,
  type AccessCapabilityKey,
  type AccessLayer,
} from "restaurant-pos-packages/access";
import type { IEmployee } from "restaurant-pos-packages/interfaces/IEmployee";
import type { CreateEmployeeBody } from "restaurant-pos-packages/schemas/employee";
import { http } from "../http";
import { multipartFormDataConfig } from "../multipartRequest";
import { queryKeys } from "../queryKeys";
import {
  toServiceRequestError,
  type ServiceFailure,
} from "../serviceErrors";

export type BusinessAccessSource = "ownership" | "membership" | "none";

/** The signed-in User's effective access at one venue. */
export interface BusinessAccessSnapshot {
  businessId: string;
  effectiveLayer: AccessLayer;
  source: BusinessAccessSource;
  jobRoles: string[];
  capabilities: AccessCapabilityKey[];
  canEnterBusiness: boolean;
}

/**
 * One membership row as JSON returns it. Dates arrive as ISO strings; the
 * manager list adds the linked User's display name and email.
 */
export interface EmployeeMembershipRecord
  extends Omit<
    IEmployee,
    "_id" | "businessId" | "userId" | "joinDate" | "terminatedDate"
  > {
  _id: string;
  businessId: string;
  userId: string;
  joinDate: string;
  terminatedDate?: string;
  displayName?: string;
  email?: string;
}

export type VenueMembership = EmployeeMembershipRecord & {
  displayName: string;
  email: string;
};

/** The only fields the minimal hire collects, derived from the shared DTO. */
export type HireEmployeeInput = Pick<
  CreateEmployeeBody,
  "businessId" | "userEmail" | "allEmployeeRoles" | "employmentStatus"
> & {
  joinDate: string;
};

export type HireFailureReason =
  | "accountNotFound"
  | "alreadyMember"
  | "forbidden"
  | "validation"
  | "other";

/** True when the access snapshot reaches the manager layer or above. */
export function canManageVenue(
  access: BusinessAccessSnapshot | null | undefined,
): boolean {
  const layer = access?.effectiveLayer;
  if (!layer || !(BUSINESS_ACCESS_LAYERS as readonly string[]).includes(layer)) {
    return false;
  }
  return compareAccessLayers(layer, "manager") >= 0;
}

/** Classify the known hire outcomes for localized page copy. */
export function hireFailureReason(
  failure: Pick<ServiceFailure, "code" | "status" | "serverMessage">,
): HireFailureReason {
  if (failure.code === "employeesCreate.notFound") return "accountNotFound";
  if (failure.code === "employeesCreate.conflict") return "alreadyMember";
  if (failure.code === "employeesCreate.forbidden") return "forbidden";
  if (failure.code === "employeesCreate.validation") return "validation";
  return "other";
}

export async function fetchBusinessAccessSnapshot(
  businessId: string,
  signal?: AbortSignal,
): Promise<BusinessAccessSnapshot> {
  try {
    const { data } = await http.get<BusinessAccessSnapshot>(
      `/api/v1/business/${businessId}/access`,
      { signal },
    );
    return data;
  } catch (error) {
    throw toServiceRequestError(error, "businessAccess");
  }
}

export async function fetchVenueMemberships(
  businessId: string,
  signal?: AbortSignal,
): Promise<VenueMembership[]> {
  try {
    const { data } = await http.get<VenueMembership[]>(
      `/api/v1/employees/business/${businessId}`,
      { signal },
    );
    return Array.isArray(data) ? data : [];
  } catch (error) {
    throw toServiceRequestError(error, "employeesFetch");
  }
}

export async function fetchEmployeeMembership(
  employeeId: string,
  signal?: AbortSignal,
): Promise<EmployeeMembershipRecord> {
  try {
    const { data } = await http.get<EmployeeMembershipRecord>(
      `/api/v1/employees/${employeeId}`,
      { signal },
    );
    return data;
  } catch (error) {
    throw toServiceRequestError(error, "employeesRead");
  }
}

export async function hireEmployee(
  input: HireEmployeeInput,
): Promise<{ message?: string }> {
  const body = new FormData();
  body.append("businessId", input.businessId);
  body.append("userEmail", input.userEmail);
  body.append("allEmployeeRoles", JSON.stringify(input.allEmployeeRoles));
  body.append("employmentStatus", input.employmentStatus);
  body.append("joinDate", input.joinDate);

  try {
    const { data } = await http.post<{ message?: string }>(
      "/api/v1/employees",
      body,
      multipartFormDataConfig,
    );
    return data;
  } catch (error) {
    throw toServiceRequestError(error, "employeesCreate");
  }
}

export function useBusinessAccessSnapshotQuery(
  businessId: string | undefined,
  options: { enabled?: boolean } = {},
) {
  const enabled = (options.enabled ?? true) && Boolean(businessId);

  return useQuery({
    queryKey: businessId
      ? queryKeys.business.access(businessId)
      : queryKeys.business.accessPending(),
    queryFn: ({ signal }) =>
      fetchBusinessAccessSnapshot(businessId as string, signal),
    enabled,
  });
}

export function useVenueMembershipsQuery(
  businessId: string | undefined,
  options: { enabled?: boolean } = {},
) {
  const enabled = (options.enabled ?? true) && Boolean(businessId);

  return useQuery({
    queryKey: businessId
      ? queryKeys.employees.byBusiness(businessId)
      : queryKeys.employees.byBusinessPending(),
    queryFn: ({ signal }) => fetchVenueMemberships(businessId as string, signal),
    enabled,
  });
}

export function useEmployeeMembershipQuery(
  employeeId: string | undefined,
  options: { enabled?: boolean } = {},
) {
  const enabled = (options.enabled ?? true) && Boolean(employeeId);

  return useQuery({
    queryKey: employeeId
      ? queryKeys.employees.detail(employeeId)
      : queryKeys.employees.detailPending(),
    queryFn: ({ signal }) =>
      fetchEmployeeMembership(employeeId as string, signal),
    enabled,
  });
}

export function useHireEmployeeMutation(businessId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: Omit<HireEmployeeInput, "businessId">) =>
      hireEmployee({ ...input, businessId }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.employees.byBusiness(businessId),
      }),
  });
}
