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
 * params are validated by their DTOs. The `terminatedDate > joinDate` rule
 * stays here as a named post-parse check, alongside the database-backed
 * duplicate, user-link and document-count guards. Every error is raised as an
 * `AppError` so the global handler emits RFC 9457 `application/problem+json`.
 */
import type { FastifyPluginAsync } from "fastify";
import mongoose, { Types } from "mongoose";
import type { IEmployee } from "restaurant-pos-packages/interfaces/IEmployee";
import type { IUser } from "restaurant-pos-packages/interfaces/IUser";
import {
  compareAccessLayers,
  resolveDefaultAccessLayerForRoles,
} from "restaurant-pos-packages/access";

import { createAuthHook } from "../../auth/middleware.ts";
import {
  meetsBusinessLayer,
  requireBusinessLayer,
} from "../../access/requireBusinessLayer.ts";
import calculateVacationProportional from "../../employees/calculateVacationProportional.ts";
import validateEmployeeDates from "../../employees/validateEmployeeDates.ts";
import Employee from "../../models/employee.ts";
import User from "../../models/user.ts";
import Printer from "../../models/printer.ts";
import { markAsDeletedById, withSoftDeleteFilter } from "../../models/softDelete.ts";
import uploadFilesCloudinary from "../../cloudinary/uploadFilesCloudinary.ts";
import { badRequest, conflict, forbidden, notFound } from "../../errors/appError.ts";
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
const BLOCKED_EMPLOYMENT_STATUSES = new Set(["Suspended", "Terminated"]);

/** An Employee row plus optional future employment-status data. */
type MembershipRecord = IEmployee & { employmentStatus?: string };

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

/** The fields a create request contributes to the stored employee. */
function toNewEmployee(
  employeeId: Types.ObjectId,
  fields: CreateEmployeeBody,
): Partial<IEmployee> {
  return {
    _id: employeeId,
    allEmployeeRoles: fields.allEmployeeRoles,
    taxNumber: fields.taxNumber,
    joinDate: fields.joinDate,
    vacationDaysPerYear: fields.vacationDaysPerYear,
    businessId: new Types.ObjectId(fields.businessId),
    vacationDaysLeft: fields.vacationDaysPerYear,
    contractHoursWeek: fields.contractHoursWeek,
    salary: fields.salary,
    comments: fields.comments,
  };
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
function isBlockedForSelfView(employee: MembershipRecord): boolean {
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
function toSafeSelfView(employee: MembershipRecord): Record<string, unknown> {
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

      await requireBusinessLayer({
        userId: req.authSession!.id,
        businessId: fields.businessId,
        minimumLayer: "manager",
      });

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

        const employeeId = new mongoose.Types.ObjectId();
        const newEmployee = toNewEmployee(employeeId, fields);
        newEmployee.userId = user._id!;

        if (files.length > 0) {
          const folder = `/business/${fields.businessId}/employees/${employeeId}`;
          newEmployee.documentsUrl = await uploadDocuments(folder, files, false);
        }

        await Employee.create([newEmployee], { session });

        await session.commitTransaction();

        return reply.code(201).send({
          message: `New employee created successfully!`,
        });
      } catch (error) {
        await session.abortTransaction().catch(() => undefined);
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
      ).lean<MembershipRecord | null>();

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

      const datesResult = validateEmployeeDates(
        fields.joinDate,
        fields.terminatedDate,
      );
      if (datesResult !== true) {
        throw badRequest(datesResult);
      }

      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        const employee = (await Employee.findOne(
          withSoftDeleteFilter({ _id: employeeId }),
        )
          .populate({
            path: "userId",
            select: "personalDetails.email",
            model: User,
          })
          .session(session)
          .lean()) as (IEmployee & { userId: IUser }) | null;

        if (!employee) {
          throw notFound("Employee not found!");
        }

        await requireBusinessLayer({
          userId: req.authSession!.id,
          businessId: String(employee.businessId),
          minimumLayer: "manager",
          session,
        });

        if (
          files.length + (employee.documentsUrl?.length ?? 0) >
          MAX_DOCUMENT_FILES
        ) {
          throw badRequest(`Max file quantity is ${MAX_DOCUMENT_FILES}!`);
        }

        const updateEmployeeObj: Partial<IEmployee> = {};

        if (fields.allEmployeeRoles !== employee.allEmployeeRoles)
          updateEmployeeObj.allEmployeeRoles = fields.allEmployeeRoles;
        if (fields.taxNumber !== employee.taxNumber)
          updateEmployeeObj.taxNumber = fields.taxNumber;
        if (fields.joinDate.getTime() !== employee.joinDate?.getTime())
          updateEmployeeObj.joinDate = fields.joinDate;
        if (fields.vacationDaysPerYear !== employee.vacationDaysPerYear)
          updateEmployeeObj.vacationDaysPerYear = fields.vacationDaysPerYear;
        if (fields.active !== employee.active)
          updateEmployeeObj.active = fields.active;
        if (
          fields.contractHoursWeek !== undefined &&
          fields.contractHoursWeek !== employee.contractHoursWeek
        )
          updateEmployeeObj.contractHoursWeek = fields.contractHoursWeek;
        if (
          fields.terminatedDate &&
          fields.terminatedDate.getTime() !== employee.terminatedDate?.getTime()
        )
          updateEmployeeObj.terminatedDate = fields.terminatedDate;
        if (fields.comments && fields.comments !== employee.comments)
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

        if (
          fields.vacationDaysPerYear !== employee.vacationDaysPerYear ||
          fields.joinDate.getTime() !== employee.joinDate?.getTime()
        ) {
          updateEmployeeObj.vacationDaysLeft = calculateVacationProportional(
            fields.joinDate,
            fields.vacationDaysPerYear,
          );
        }

        if (fields.userEmail !== employee.userId?.personalDetails?.email) {
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
              businessId: employee.businessId,
              userId: user._id,
            }),
          }).session(session);

          if (employeeAlreadyExists) {
            throw conflict("User is already an employee!");
          }

          updateEmployeeObj.userId = user._id;
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
          { returnDocument: "after", lean: true, session },
        );

        if (fields.active === false) {
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
      }).lean()) as MembershipRecord[];

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
