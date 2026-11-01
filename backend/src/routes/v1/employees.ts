/**
 * Employees Routes — employee CRUD, per-business listing and management
 * contacts.
 *
 * Every route is authenticated, and every route resolves the caller through
 * the shared business-layer guard before acting. The cross-tenant
 * all-employees list is gone; managers read the venue list, managers receive
 * the full membership record, and an ordinary member receives only their own
 * non-sensitive self-view.
 *
 * Multipart bodies (create and update) are buffered and validated by the shared
 * multipart helper against strict zod DTOs from
 * `packages/schemas/employee.ts`; the JSON-encoded `allEmployeeRoles` and
 * `salary` fields are parsed and validated there. The GET/PATCH/DELETE path
 * params are validated by their DTOs.
 *
 * Create is the minimal hire: it links an existing User by sign-in email,
 * derives `active` from the submitted status, reactivates a soft-deleted
 * membership in place, and enforces the actor's role-assignment bounds. Update
 * keeps the Business and linked User fixed, derives the same mirror, applies
 * the same bounds, and restricts rehire of a Terminated membership to an
 * effective admin or the owning User. The `terminatedDate` / `joinDate` and
 * status cross-field rules stay here as named post-parse checks, alongside the
 * database-backed duplicate, user-link and document-count guards. Every error
 * is raised as an `AppError` so the global handler emits RFC 9457
 * `application/problem+json`.
 */
import type { FastifyPluginAsync } from "fastify";
import mongoose, { Types } from "mongoose";
import type { IEmployee } from "restaurant-pos-packages/interfaces/IEmployee";
import type { IUser } from "restaurant-pos-packages/interfaces/IUser";
import {
  compareAccessLayers,
  resolveDefaultAccessLayerForRoles,
} from "restaurant-pos-packages/access";
import { blockedEmploymentStatusEnums } from "restaurant-pos-packages/enums";

import { createAuthHook } from "../../auth/middleware.ts";
import {
  meetsBusinessLayer,
  requireBusinessLayer,
} from "../../access/requireBusinessLayer.ts";
import calculateVacationProportional from "../../employees/calculateVacationProportional.ts";
import {
  applyHireFields,
  canAssignRoles,
  canEditMembership,
  isTerminatedMembership,
  TERMINATED_EMPLOYMENT_STATUS,
} from "../../employees/membershipRules.ts";
import validateEmployeeDates from "../../employees/validateEmployeeDates.ts";
import Employee from "../../models/employee.ts";
import User from "../../models/user.ts";
import Printer from "../../models/printer.ts";
import { markAsDeletedById, withSoftDeleteFilter } from "../../models/softDelete.ts";
import uploadFilesCloudinary from "../../cloudinary/uploadFilesCloudinary.ts";
import {
  type AppError,
  badRequest,
  conflict,
  forbidden,
  notFound,
} from "../../errors/appError.ts";
import { parseMultipart, type MultipartFile } from "../../schemas/multipart.ts";
import {
  createEmployeeBodySchema,
  employeeByBusinessParamsSchema,
  employeesIncludeDeletedQuerySchema,
  employeeIdParamsSchema,
  patchEmployeeBodySchema,
  type CreateEmployeeBody,
  type EmployeeByBusinessParams,
  type EmployeesIncludeDeletedQuery,
  type EmployeeIdParams,
} from "restaurant-pos-packages/schemas/employee";

/** Employment statuses that remove access through the membership. */
const BLOCKED_EMPLOYMENT_STATUSES = new Set(blockedEmploymentStatusEnums);

/**
 * Translate a duplicate-key write failure into the matching conflict. The
 * partial unique indexes back the read-then-write guards against concurrent
 * creates and reactivations.
 */
function duplicateKeyConflict(error: unknown): AppError | null {
  const candidate = error as {
    code?: number;
    keyPattern?: Record<string, unknown>;
  };
  if (candidate?.code !== 11000) return null;

  if (candidate.keyPattern && "taxNumber" in candidate.keyPattern) {
    return conflict("Tax number is already in use at this business!");
  }
  return conflict("User is already an employee!");
}

/**
 * Two concurrent transactions writing the same membership or unique key surface
 * as a retryable write conflict. Treat it as an ordinary conflict so the caller
 * gets Problem Details rather than a server error.
 */
function concurrentTransactionConflict(
  error: unknown,
  detail: string,
): AppError | null {
  const candidate = error as {
    code?: number;
    errorLabelSet?: Set<string>;
  };
  if (
    candidate?.code === 112 ||
    candidate?.errorLabelSet?.has("TransientTransactionError")
  ) {
    return conflict(detail);
  }
  return null;
}

/** The linked User fields the manager list and contacts expose. */
type UserIdentity = {
  displayName: string;
  email: string;
};

/**
 * Total documents an employee may hold. The multipart transport also caps a
 * request at 10 files, so a create can never exceed the cap and only the update
 * path needs to check the running total.
 */
const MAX_DOCUMENT_FILES = 10;

/** Upload collected files to Cloudinary, raising a `400` on any failure. */
async function uploadDocuments(
  folder: string,
  files: MultipartFile[],
  onlyImages: boolean,
): Promise<string[]> {
  const response = await uploadFilesCloudinary({
    folder,
    filesArr: files.map((file) => ({
      buffer: file.buffer,
      mimeType: file.mimetype,
    })),
    onlyImages,
  });

  if (
    typeof response === "string" ||
    response.length === 0 ||
    !response.every((str) => str.includes("https://"))
  ) {
    throw badRequest(
      `Error uploading ${onlyImages ? "image" : "files"}: ${response}`,
    );
  }

  return response;
}

/** The fields a create request contributes to a fresh employee row. */
function toNewEmployee(
  employeeId: Types.ObjectId,
  fields: CreateEmployeeBody,
): Partial<IEmployee> {
  const newEmployee: Partial<IEmployee> = {
    _id: employeeId,
    businessId: new Types.ObjectId(fields.businessId),
  };
  applyHireFields(newEmployee, fields);
  return newEmployee;
}

/** Build the display name and email for one linked User. */
function userIdentity(
  user: { personalDetails?: Record<string, unknown> } | undefined,
): UserIdentity {
  const details = user?.personalDetails as
    | Record<string, string | undefined>
    | undefined;
  const first = details?.firstName?.trim() ?? "";
  const last = details?.lastName?.trim() ?? "";
  const name = `${first} ${last}`.trim();
  const email = details?.email?.trim() ?? "";
  return {
    displayName: name.length > 0 ? name : email || "—",
    email,
  };
}

/** Resolve linked User identities for a set of membership User ids. */
async function loadUserIdentities(
  userIds: unknown[],
): Promise<Map<string, UserIdentity>> {
  const identities = new Map<string, UserIdentity>();
  if (userIds.length === 0) return identities;

  const users = await User.find(
    withSoftDeleteFilter(
      {
        _id: {
          $in: userIds.map((id) => new Types.ObjectId(String(id))),
        },
      },
      true,
    ),
  )
    .select(
      "personalDetails.firstName personalDetails.lastName personalDetails.email",
    )
    .lean();

  for (const user of users) {
    identities.set(String(user._id), userIdentity(user));
  }

  return identities;
}

/** A membership blocks its own User's self-view when it is no longer usable. */
function isBlockedForSelfView(employee: IEmployee): boolean {
  if (employee.deleted) return true;
  if (
    employee.employmentStatus &&
    BLOCKED_EMPLOYMENT_STATUSES.has(employee.employmentStatus)
  ) {
    return true;
  }
  return employee.active === false || Boolean(employee.terminatedDate);
}

/**
 * The non-sensitive self-view: roles, status when present, join date, contract
 * hours, vacation allowance and remaining, and documents. Pay, tax number,
 * national ID, HR comments, and soft-delete metadata are never included.
 */
function toSafeSelfView(employee: IEmployee): Record<string, unknown> {
  const view: Record<string, unknown> = {
    _id: employee._id,
    businessId: employee.businessId,
    allEmployeeRoles: employee.allEmployeeRoles,
    joinDate: employee.joinDate,
    contractHoursWeek: employee.contractHoursWeek,
    vacationDaysPerYear: employee.vacationDaysPerYear,
    vacationDaysLeft: employee.vacationDaysLeft,
    documentsUrl: employee.documentsUrl,
  };

  if (typeof employee.employmentStatus === "string") {
    view.employmentStatus = employee.employmentStatus;
  }

  return view;
}

export const employeesRoutes: FastifyPluginAsync = async (app) => {
  // GET /employees/business/:businessId/management-contacts — profile contact dropdown (before generic /business/:id).
  app.get<{
    Params: EmployeeByBusinessParams;
    Querystring: EmployeesIncludeDeletedQuery;
  }>(
    "/business/:businessId/management-contacts",
    {
      preValidation: [createAuthHook(app)],
      schema: {
        params: employeeByBusinessParamsSchema,
        querystring: employeesIncludeDeletedQuerySchema,
      },
    },
    async (req, reply) => {
      const { businessId } = req.params;
      const { includeDeleted = false } = req.query;

      await requireBusinessLayer({
        userId: req.authSession!.id,
        businessId,
        minimumLayer: "manager",
      });

      const employees = await Employee.find({
        ...withSoftDeleteFilter(
          {
            businessId: new Types.ObjectId(businessId),
            active: { $ne: false },
          },
          includeDeleted,
        ),
      }).lean();

      const managers = employees.filter((e) => {
        const roles = e.allEmployeeRoles;
        if (!Array.isArray(roles)) return false;
        return (
          compareAccessLayers(
            resolveDefaultAccessLayerForRoles(roles),
            "manager",
          ) >= 0
        );
      });

      if (managers.length === 0) {
        return reply.code(200).send([]);
      }

      const identities = await loadUserIdentities(
        managers.map((member) => member.userId),
      );

      const out = managers.map((m) => ({
        employeeId: String(m._id),
        displayName: identities.get(String(m.userId))?.displayName ?? "—",
      }));

      return reply.code(200).send(out);
    },
  );

  // POST /employees - create (formData with documents, transaction)
  app.post(
    "/",
    { preValidation: [createAuthHook(app)] },
    async (req, reply) => {
      const { fields, files } = await parseMultipart(
        req,
        createEmployeeBodySchema,
      );

      const access = await requireBusinessLayer({
        userId: req.authSession!.id,
        businessId: fields.businessId,
        minimumLayer: "manager",
      });

      if (fields.employmentStatus === TERMINATED_EMPLOYMENT_STATUS) {
        throw badRequest("A new membership cannot start Terminated!");
      }

      if (!canAssignRoles(access, fields.allEmployeeRoles)) {
        throw forbidden("You cannot assign one or more of these roles.");
      }

      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        const user = await User.findOne({
          ...withSoftDeleteFilter({
            "personalDetails.email": fields.userEmail,
          }),
        })
          .select("_id")
          .session(session)
          .lean<IUser | null>();

        if (!user) {
          throw conflict("User does not exist!");
        }

        const employeeAlreadyExists = await Employee.exists({
          ...withSoftDeleteFilter({
            businessId: fields.businessId,
            userId: user._id,
          }),
        }).session(session);

        if (employeeAlreadyExists) {
          throw conflict("User is already an employee!");
        }

        const softDeletedEmployee = await Employee.findOne({
          businessId: new Types.ObjectId(fields.businessId),
          userId: user._id,
          deleted: true,
        }).session(session);

        if (softDeletedEmployee) {
          if (
            !canEditMembership(
              access,
              resolveDefaultAccessLayerForRoles(
                softDeletedEmployee.allEmployeeRoles,
              ),
            )
          ) {
            throw forbidden(
              "You cannot edit a membership at or above your access layer.",
            );
          }

          softDeletedEmployee.deleted = false;
          softDeletedEmployee.deletedAt = undefined;
          softDeletedEmployee.deletedBy = undefined;
          softDeletedEmployee.userId = user._id!;
          applyHireFields(softDeletedEmployee, fields, {
            preserveOptional: true,
          });

          if (files.length > 0) {
            const folder = `/business/${fields.businessId}/employees/${softDeletedEmployee._id}`;
            softDeletedEmployee.documentsUrl = await uploadDocuments(
              folder,
              files,
              false,
            );
          }

          await softDeletedEmployee.save({ session });
        } else {
          const employeeId = new mongoose.Types.ObjectId();
          const newEmployee = toNewEmployee(employeeId, fields);
          newEmployee.userId = user._id!;

          if (files.length > 0) {
            const folder = `/business/${fields.businessId}/employees/${employeeId}`;
            newEmployee.documentsUrl = await uploadDocuments(
              folder,
              files,
              false,
            );
          }

          await Employee.create([newEmployee], { session });
        }

        await session.commitTransaction();

        return reply.code(201).send({
          message: `New employee created successfully!`,
        });
      } catch (error) {
        await session.abortTransaction().catch(() => undefined);
        const conflictError =
          duplicateKeyConflict(error) ??
          concurrentTransactionConflict(error, "User is already an employee!");
        if (conflictError) throw conflictError;
        throw error;
      } finally {
        session.endSession();
      }
    },
  );

  // GET /employees/:employeeId - get by ID
  app.get<{
    Params: EmployeeIdParams;
    Querystring: EmployeesIncludeDeletedQuery;
  }>(
    "/:employeeId",
    {
      preValidation: [createAuthHook(app)],
      schema: {
        params: employeeIdParamsSchema,
        querystring: employeesIncludeDeletedQuerySchema,
      },
    },
    async (req, reply) => {
      const { employeeId } = req.params;
      const { includeDeleted = false } = req.query;

      const employee = await Employee.findOne(
        withSoftDeleteFilter({ _id: employeeId }, true),
      ).lean<IEmployee | null>();

      if (!employee) {
        throw notFound("Employee not found!");
      }

      const access = await requireBusinessLayer({
        userId: req.authSession!.id,
        businessId: String(employee.businessId),
        minimumLayer: "employee",
      });

      if (meetsBusinessLayer(access, "manager")) {
        if (employee.deleted && !includeDeleted) {
          throw notFound("Employee not found!");
        }
        return reply.code(200).send(employee);
      }

      if (String(employee.userId) !== req.authSession!.id) {
        throw forbidden("Forbidden");
      }
      if (isBlockedForSelfView(employee)) {
        throw forbidden("Forbidden");
      }

      return reply.code(200).send(toSafeSelfView(employee));
    },
  );

  // PATCH /employees/:employeeId - update (formData with documents, transaction)
  app.patch<{ Params: EmployeeIdParams }>(
    "/:employeeId",
    {
      preValidation: [createAuthHook(app)],
      schema: { params: employeeIdParamsSchema },
    },
    async (req, reply) => {
      const { employeeId } = req.params;

      const { fields, files } = await parseMultipart(
        req,
        patchEmployeeBodySchema,
      );

      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        const employee = (await Employee.findOne(
          withSoftDeleteFilter({ _id: employeeId }),
        )
          .session(session)
          .lean()) as IEmployee | null;

        if (!employee) {
          throw notFound("Employee not found!");
        }

        const access = await requireBusinessLayer({
          userId: req.authSession!.id,
          businessId: String(employee.businessId),
          minimumLayer: "manager",
          session,
        });

        const currentLayer = resolveDefaultAccessLayerForRoles(
          employee.allEmployeeRoles,
        );
        if (!canEditMembership(access, currentLayer)) {
          throw forbidden(
            "You cannot edit a membership at or above your access layer.",
          );
        }
        if (!canAssignRoles(access, fields.allEmployeeRoles)) {
          throw forbidden("You cannot assign one or more of these roles.");
        }

        const statusIsTerminated =
          fields.employmentStatus === TERMINATED_EMPLOYMENT_STATUS;
        const wasTerminated = isTerminatedMembership(employee);

        if (
          wasTerminated &&
          !statusIsTerminated &&
          access.effectiveLayer !== "admin"
        ) {
          throw forbidden(
            "Only an admin or owner can rehire a terminated membership!",
          );
        }

        const terminatedDate = statusIsTerminated
          ? fields.terminatedDate ?? employee.terminatedDate
          : undefined;
        if (statusIsTerminated && !terminatedDate) {
          throw badRequest(
            "Termination date is required for a terminated employee!",
          );
        }

        const datesResult = validateEmployeeDates(
          fields.joinDate,
          terminatedDate,
        );
        if (datesResult !== true) {
          throw badRequest(datesResult);
        }

        if (
          files.length + (employee.documentsUrl?.length ?? 0) >
          MAX_DOCUMENT_FILES
        ) {
          throw badRequest(`Max file quantity is ${MAX_DOCUMENT_FILES}!`);
        }

        const updateEmployeeObj: Partial<IEmployee> = {
          employmentStatus: fields.employmentStatus,
          allEmployeeRoles: fields.allEmployeeRoles,
        };

        if (fields.joinDate.getTime() !== employee.joinDate?.getTime())
          updateEmployeeObj.joinDate = fields.joinDate;
        if (
          fields.taxNumber !== undefined &&
          fields.taxNumber !== employee.taxNumber
        )
          updateEmployeeObj.taxNumber = fields.taxNumber;
        if (
          fields.vacationDaysPerYear !== undefined &&
          fields.vacationDaysPerYear !== employee.vacationDaysPerYear
        )
          updateEmployeeObj.vacationDaysPerYear = fields.vacationDaysPerYear;
        if (statusIsTerminated && terminatedDate)
          updateEmployeeObj.terminatedDate = terminatedDate;
        if (
          fields.contractHoursWeek !== undefined &&
          fields.contractHoursWeek !== employee.contractHoursWeek
        )
          updateEmployeeObj.contractHoursWeek = fields.contractHoursWeek;
        if (fields.comments !== undefined && fields.comments !== employee.comments)
          updateEmployeeObj.comments = fields.comments;

        const salary = fields.salary;
        if (
          salary &&
          (salary.payFrequency !== employee.salary?.payFrequency ||
            salary.grossSalary !== employee.salary?.grossSalary ||
            salary.netSalary !== employee.salary?.netSalary)
        ) {
          updateEmployeeObj.salary = salary;
        }

        const vacationDaysPerYear =
          fields.vacationDaysPerYear ?? employee.vacationDaysPerYear;
        const joinDateChanged =
          fields.joinDate.getTime() !== employee.joinDate?.getTime();
        const vacationChanged =
          fields.vacationDaysPerYear !== undefined &&
          fields.vacationDaysPerYear !== employee.vacationDaysPerYear;
        if (
          vacationDaysPerYear !== undefined &&
          (joinDateChanged || vacationChanged)
        ) {
          updateEmployeeObj.vacationDaysLeft = calculateVacationProportional(
            fields.joinDate,
            vacationDaysPerYear,
          );
        }

        if (files.length > 0) {
          const folder = `/business/${employee.businessId}/employees/${employeeId}`;

          updateEmployeeObj.documentsUrl = [
            ...(employee.documentsUrl ?? []),
            ...(await uploadDocuments(folder, files, true)),
          ];
        }

        const updatedEmployee = await Employee.findOneAndUpdate(
          withSoftDeleteFilter({ _id: employeeId }),
          { $set: updateEmployeeObj },
          {
            returnDocument: "after",
            lean: true,
            session,
            runValidators: true,
          },
        );

        if (BLOCKED_EMPLOYMENT_STATUSES.has(fields.employmentStatus)) {
          await Printer.updateMany(
            {
              businessId: employee.businessId,
              $or: [
                { employeesAllowedToPrintDataIds: employeeId },
                {
                  "configurationSetupToPrintOrders.excludeemployeeIds":
                    employeeId,
                },
              ],
            },
            {
              $pull: {
                employeesAllowedToPrintDataIds: employeeId,
                "configurationSetupToPrintOrders.$[].excludeemployeeIds":
                  employeeId,
              },
            },
            { session },
          );
        }

        if (!updatedEmployee) {
          throw notFound("Employee not found or not updated");
        }

        await session.commitTransaction();

        return reply.code(200).send({
          message: `Employee updated successfully!`,
        });
      } catch (error) {
        await session.abortTransaction().catch(() => undefined);
        const conflictError =
          duplicateKeyConflict(error) ??
          concurrentTransactionConflict(
            error,
            "The membership was changed concurrently. Please retry.",
          );
        if (conflictError) throw conflictError;
        throw error;
      } finally {
        session.endSession();
      }
    },
  );

  // DELETE /employees/:employeeId - delete (transaction)
  app.delete<{ Params: EmployeeIdParams }>(
    "/:employeeId",
    {
      preValidation: [createAuthHook(app)],
      schema: { params: employeeIdParamsSchema },
    },
    async (req, reply) => {
      const { employeeId } = req.params;

      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        const employee = await Employee.findById(employeeId)
          .setOptions({ includeDeleted: true })
          .select("businessId deleted")
          .session(session)
          .lean<IEmployee>();

        if (!employee) {
          throw notFound("Employee not found!");
        }

        await requireBusinessLayer({
          userId: req.authSession!.id,
          businessId: String(employee.businessId),
          minimumLayer: "manager",
          session,
        });

        if (employee.deleted) {
          throw conflict("Employee already deleted!");
        }

        const wasDeleted = await markAsDeletedById(
          Employee as mongoose.Model<IEmployee & { deleted: boolean }>,
          employeeId,
          { session, deletedBy: req.authSession?.id },
        );
        if (!wasDeleted) {
          throw conflict("Employee already deleted!");
        }

        await Printer.updateMany(
          {
            businessId: employee.businessId,
            $or: [
              { employeesAllowedToPrintDataIds: employeeId },
              {
                "configurationSetupToPrintOrders.excludeemployeeIds":
                  employeeId,
              },
            ],
          },
          {
            $pull: {
              employeesAllowedToPrintDataIds: employeeId,
              "configurationSetupToPrintOrders.$[].excludeemployeeIds":
                employeeId,
            },
          },
          { session },
        );

        await session.commitTransaction();

        return reply.code(200).send({
          message: `Employee deleted successfully`,
        });
      } catch (error) {
        await session.abortTransaction().catch(() => undefined);
        throw error;
      } finally {
        session.endSession();
      }
    },
  );

  // GET /employees/business/:businessId - get by business
  app.get<{
    Params: EmployeeByBusinessParams;
    Querystring: EmployeesIncludeDeletedQuery;
  }>(
    "/business/:businessId",
    {
      preValidation: [createAuthHook(app)],
      schema: {
        params: employeeByBusinessParamsSchema,
        querystring: employeesIncludeDeletedQuerySchema,
      },
    },
    async (req, reply) => {
      const { businessId } = req.params;
      const { includeDeleted = false } = req.query;

      await requireBusinessLayer({
        userId: req.authSession!.id,
        businessId,
        minimumLayer: "manager",
      });

      const employees = (await Employee.find({
        ...withSoftDeleteFilter(
          { businessId: new Types.ObjectId(businessId) },
          includeDeleted,
        ),
      }).lean()) as IEmployee[];

      const identities = await loadUserIdentities(
        employees.map((employee) => employee.userId),
      );

      const rows = employees.map((employee) => {
        const identity = identities.get(String(employee.userId));
        return {
          ...employee,
          displayName: identity?.displayName ?? "—",
          email: identity?.email ?? "",
        };
      });

      return reply.code(200).send(rows);
    },
  );
};
