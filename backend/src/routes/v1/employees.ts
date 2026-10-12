/**
 * Employees Routes — employee CRUD, per-business listing and management
 * contacts.
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

import deleteFolderCloudinary from "../../cloudinary/deleteFolderCloudinary.ts";
import calculateVacationProportional from "../../employees/calculateVacationProportional.ts";
import validateEmployeeDates from "../../employees/validateEmployeeDates.ts";
import Employee from "../../models/employee.ts";
import User from "../../models/user.ts";
import Printer from "../../models/printer.ts";
import uploadFilesCloudinary from "../../cloudinary/uploadFilesCloudinary.ts";
import * as enums from "restaurant-pos-packages/enums";
import { badRequest, conflict, notFound } from "../../errors/appError.ts";
import { parseMultipart, type MultipartFile } from "../../schemas/multipart.ts";
import {
  createEmployeeBodySchema,
  employeeByBusinessParamsSchema,
  employeeIdParamsSchema,
  patchEmployeeBodySchema,
  type CreateEmployeeBody,
  type EmployeeByBusinessParams,
  type EmployeeIdParams,
} from "restaurant-pos-packages/schemas/employee";

const { managementRolesEnums } = enums;

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

export const employeesRoutes: FastifyPluginAsync = async (app) => {
  // GET /employees - list all
  app.get("/", async (_req, reply) => {
    const employees = await Employee.find().lean();

    if (!employees?.length) {
      throw notFound("No employees found!");
    }
    return reply.code(200).send(employees);
  });

  // GET /employees/business/:businessId/management-contacts — profile contact dropdown (before generic /business/:id).
  app.get<{ Params: EmployeeByBusinessParams }>(
    "/business/:businessId/management-contacts",
    { schema: { params: employeeByBusinessParamsSchema } },
    async (req, reply) => {
      const { businessId } = req.params;

      const employees = await Employee.find({
        businessId: new Types.ObjectId(businessId),
        active: { $ne: false },
      }).lean();

      const managers = employees.filter((e) => {
        const roles = e.allEmployeeRoles;
        if (!Array.isArray(roles)) return false;
        return roles.some((r) =>
          (managementRolesEnums as readonly string[]).includes(r),
        );
      });

      if (managers.length === 0) {
        return reply.code(200).send([]);
      }

      const userIds = managers.map((m) => m.userId).filter(Boolean);

      const users = await User.find({
        _id: { $in: userIds.map((id) => new Types.ObjectId(String(id))) },
      })
        .select(
          "personalDetails.firstName personalDetails.lastName personalDetails.email",
        )
        .lean();

      const userLabel = new Map<string, string>();
      for (const u of users) {
        const pd = u.personalDetails as
          | Record<string, string | undefined>
          | undefined;
        const first = pd?.firstName?.trim() ?? "";
        const last = pd?.lastName?.trim() ?? "";
        const name = `${first} ${last}`.trim();
        const email = pd?.email?.trim() ?? "";
        userLabel.set(String(u._id), name.length > 0 ? name : email || "—");
      }

      const out = managers.map((m) => ({
        employeeId: String(m._id),
        displayName: userLabel.get(String(m.userId)) ?? "—",
      }));

      return reply.code(200).send(out);
    },
  );

  // POST /employees - create (formData with documents, transaction)
  app.post("/", async (req, reply) => {
    const { fields, files } = await parseMultipart(
      req,
      createEmployeeBodySchema,
    );

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const user = await User.findOne({
        "personalDetails.email": fields.userEmail,
      })
        .select("_id")
        .session(session)
        .lean<IUser | null>();

      if (!user) {
        throw conflict("User does not exist!");
      }

      const employeeAlreadyExists = await Employee.exists({
        businessId: fields.businessId,
        userId: user._id,
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

      const updateUser = await User.findOneAndUpdate(
        { _id: user._id },
        { $set: { employeeDetails: employeeId } },
        { returnDocument: "after", lean: true, session },
      );

      if (!updateUser) {
        throw badRequest("Error updating user!");
      }

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
  });

  // GET /employees/:employeeId - get by ID
  app.get<{ Params: EmployeeIdParams }>(
    "/:employeeId",
    { schema: { params: employeeIdParamsSchema } },
    async (req, reply) => {
      const { employeeId } = req.params;

      const employee = await Employee.findById(employeeId).lean();

      if (!employee) {
        throw notFound("Employee not found!");
      }
      return reply.code(200).send(employee);
    },
  );

  // PATCH /employees/:employeeId - update (formData with documents, transaction)
  app.patch<{ Params: EmployeeIdParams }>(
    "/:employeeId",
    { schema: { params: employeeIdParamsSchema } },
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
        const employee = (await Employee.findById(employeeId)
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
            "personalDetails.email": fields.userEmail,
          })
            .select("_id")
            .session(session)
            .lean<IUser | null>();

          if (!user) {
            throw conflict("User does not exist!");
          }

          const employeeAlreadyExists = await Employee.exists({
            businessId: employee.businessId,
            userId: user._id,
          }).session(session);

          if (employeeAlreadyExists) {
            throw conflict("User is already an employee!");
          }

          const updatedOldUser = await User.findOneAndUpdate(
            { _id: (employee.userId as IUser)._id },
            { $unset: { employeeDetails: null } },
            { returnDocument: "after", lean: true, session },
          );
          const updateNewUser = await User.findOneAndUpdate(
            { _id: user._id },
            { $set: { employeeDetails: employeeId } },
            { returnDocument: "after", lean: true, session },
          );

          if (!updatedOldUser || !updateNewUser) {
            throw badRequest(
              !updatedOldUser
                ? "Old user not found or not updated"
                : "New user not found or not updated",
            );
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
          { _id: employeeId },
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
    { schema: { params: employeeIdParamsSchema } },
    async (req, reply) => {
      const { employeeId } = req.params;

      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        const employee = await Employee.findById(employeeId)
          .session(session)
          .lean<IEmployee>();

        if (!employee) {
          throw notFound("Employee not found!");
        }

        const deletedEmployee = await Employee.findOneAndDelete(
          { _id: employeeId },
          { session },
        );

        if (!deletedEmployee) {
          throw notFound("Employee not found!");
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

        await User.findOneAndUpdate(
          { employeeDetails: employeeId },
          { $unset: { employeeDetails: null } },
          { returnDocument: "after", lean: true, session },
        );

        const folderPath = `/business/${employee.businessId}/employees/${employeeId}`;

        const deleteFolderCloudinaryResult: string | boolean =
          await deleteFolderCloudinary(folderPath);

        if (deleteFolderCloudinaryResult !== true) {
          throw badRequest(
            typeof deleteFolderCloudinaryResult === "string"
              ? deleteFolderCloudinaryResult
              : "DeleteCloudinaryFolder failed!",
          );
        }

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
  app.get<{ Params: EmployeeByBusinessParams }>(
    "/business/:businessId",
    { schema: { params: employeeByBusinessParamsSchema } },
    async (req, reply) => {
      const { businessId } = req.params;

      const employees = await Employee.find({
        businessId: new Types.ObjectId(businessId),
      }).lean();

      return reply.code(200).send(employees);
    },
  );
};
