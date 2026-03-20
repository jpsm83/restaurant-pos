import type { FastifyPluginAsync } from "fastify";
import mongoose, { Types } from "mongoose";
import type { IEmployee, ISalary } from "../../../../lib/interface/IEmployee.ts";
import type { IUser } from "../../../../lib/interface/IUser.ts";

import isObjectIdValid from "../../utils/isObjectIdValid.ts";
import deleteFolderCloudinary from "../../cloudinary/deleteFolderCloudinary.ts";
import calculateVacationProportional from "../../employees/calculateVacationProportional.ts";
import objDefaultValidation, {
  type ObjDefaultValidationType,
} from "../../../../lib/utils/objDefaultValidation.ts";
import Employee from "../../models/employee.ts";
import User from "../../models/user.ts";
import Printer from "../../models/printer.ts";
import uploadFilesCloudinary from "../../cloudinary/uploadFilesCloudinary.ts";
import { UploadInputFile } from "@lib/interface/ICloudinary.ts";
import * as enums from "../../../../lib/enums.ts";

const { userRolesEnums } = enums;

const reqSalaryFields = ["payFrequency", "grossSalary", "netSalary"];

export const employeesRoutes: FastifyPluginAsync = async (app) => {
  // GET /employees - list all
  app.get("/", async (_req, reply) => {
    const employees = await Employee.find().lean();

    if (!employees?.length) {
      return reply.code(404).send({ message: "No employees found" });
    }
    return reply.code(200).send(employees);
  });

  // POST /employees - create (formData with image, transaction)
  app.post("/", async (req, reply) => {
    try {
      const parts = req.parts();
      const fields: Record<string, string> = {};
      const files: UploadInputFile[] = [];

      for await (const part of parts) {
        if (part.type === "file") {
          if (part.filename) {
            const chunks: Buffer[] = [];
            for await (const chunk of part.file) {
              chunks.push(chunk);
            }
            files.push({
              buffer: Buffer.concat(chunks),
              mimeType: part.mimetype,
            });
          }
        } else {
          fields[part.fieldname] = String(part.value);
        }
      }

      const allEmployeeRoles = fields.allEmployeeRoles
        ? (JSON.parse(fields.allEmployeeRoles) as string[])
        : [];
      const taxNumber = fields.taxNumber;
      const joinDate = fields.joinDate ? new Date(fields.joinDate) : null;
      const vacationDaysPerYear = fields.vacationDaysPerYear
        ? parseInt(fields.vacationDaysPerYear)
        : 0;
      const businessId = fields.businessId;
      const userEmail = fields.userEmail;
      const contractHoursWeek = fields.contractHoursWeek
        ? Number(fields.contractHoursWeek)
        : undefined;
      const salary = fields.salary
        ? (JSON.parse(fields.salary) as ISalary)
        : undefined;
      const comments = fields.comments || undefined;

      if (
        !allEmployeeRoles?.length ||
        !taxNumber ||
        !joinDate ||
        !vacationDaysPerYear ||
        !businessId ||
        !userEmail
      ) {
        return reply.code(400).send({
          message:
            "AllEmployeeRoles, taxNumber, joinDate, vacationDaysPerYear, businessId and userEmail are required fields!",
        });
      }

      if (isObjectIdValid([businessId]) !== true) {
        return reply.code(400).send({ message: "Business ID is not valid!" });
      }

      if (files && files.length > 10) {
        return reply.code(400).send({ message: "Max file quantity is 3!" });
      }

      for (const role of allEmployeeRoles) {
        if (!(userRolesEnums as readonly string[]).includes(role)) {
          return reply.code(400).send({ message: "Invalid subscription!" });
        }
      }

      if (salary) {
        const salaryValidationResult = (objDefaultValidation as unknown as ObjDefaultValidationType)(
          salary,
          reqSalaryFields,
          []
        );
        if (salaryValidationResult !== true) {
          return reply.code(400).send({ message: salaryValidationResult });
        }
      }

      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        const user = await User.findOne({ "personalDetails.email": userEmail })
          .select("_id")
          .session(session)
          .lean<IUser | null>();

        if (!user) {
          await session.abortTransaction();
          return reply.code(409).send({ message: "User does not exist!" });
        }

        const employeeAlreadyExists = await Employee.exists({
          businessId,
          userId: user._id,
        }).session(session);

        if (employeeAlreadyExists) {
          await session.abortTransaction();
          return reply.code(409).send({ message: "User is already an employee!" });
        }

        const employeeId = new mongoose.Types.ObjectId();

        const newEmployee: Partial<IEmployee> = {
          _id: employeeId,
          allEmployeeRoles,
          taxNumber,
          joinDate,
          vacationDaysPerYear,
          businessId: new Types.ObjectId(businessId),
          userId: user._id!,
          vacationDaysLeft: vacationDaysPerYear,
          contractHoursWeek: contractHoursWeek || undefined,
          salary: salary || undefined,
          comments: comments || undefined,
        };

        if (files.length > 0) {
          const folder = `/business/${businessId}/employees/${employeeId}`;

          const cloudinaryUploadResponse = await uploadFilesCloudinary({
            folder,
            filesArr: files,
            onlyImages: false,
          });

          if (
            typeof cloudinaryUploadResponse === "string" ||
            cloudinaryUploadResponse.length === 0 ||
            !cloudinaryUploadResponse.every((str) => str.includes("https://"))
          ) {
            await session.abortTransaction();
            return reply.code(400).send({
              message: `Error uploading files: ${cloudinaryUploadResponse}`,
            });
          }

          newEmployee.documentsUrl = cloudinaryUploadResponse;
        }

        const [createEmployee, updateUser] = await Promise.all([
          Employee.create([newEmployee], { session }),
          User.findOneAndUpdate(
            { _id: user._id },
            { $set: { employeeDetails: employeeId } },
            { new: true, lean: true, session }
          ),
        ]);

        if (!createEmployee || !updateUser) {
          await session.abortTransaction();
          const message = !createEmployee
            ? `Error creating employee!`
            : `Error updating user!`;
          return reply.code(400).send({ message });
        }

        await session.commitTransaction();

        return reply.code(201).send({
          message: `New employee created successfully!`,
        });
      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        session.endSession();
      }
    } catch (error) {
      return reply.code(500).send({
        message: "Create employee failed!",
        error: error instanceof Error ? error.message : error,
      });
    }
  });

  // GET /employees/:employeeId - get by ID
  app.get("/:employeeId", async (req, reply) => {
    const params = req.params as { employeeId?: string };
    const employeeId = params.employeeId;

    if (!employeeId || !isObjectIdValid([employeeId])) {
      return reply.code(400).send({ message: "Invalid employee ID!" });
    }

    const employee = await Employee.findById(employeeId).lean();

    if (!employee) {
      return reply.code(404).send({ message: "Employee not found!" });
    }
    return reply.code(200).send(employee);
  });

  // PATCH /employees/:employeeId - update (formData with image)
  app.patch("/:employeeId", async (req, reply) => {
    try {
      const params = req.params as { employeeId?: string };
      const employeeId = params.employeeId;

      if (!employeeId || isObjectIdValid([employeeId]) !== true) {
        return reply.code(400).send({ message: "Business ID is not valid!" });
      }

      const parts = req.parts();
      const fields: Record<string, string> = {};
      const files: UploadInputFile[] = [];

      for await (const part of parts) {
        if (part.type === "file") {
          if (part.filename) {
            const chunks: Buffer[] = [];
            for await (const chunk of part.file) {
              chunks.push(chunk);
            }
            files.push({
              buffer: Buffer.concat(chunks),
              mimeType: part.mimetype,
            });
          }
        } else {
          fields[part.fieldname] = String(part.value);
        }
      }

      const allEmployeeRoles = fields.allEmployeeRoles
        ? (JSON.parse(fields.allEmployeeRoles) as string[])
        : [];
      const taxNumber = fields.taxNumber;
      const joinDate = fields.joinDate ? new Date(fields.joinDate) : null;
      const vacationDaysPerYear = fields.vacationDaysPerYear
        ? parseInt(fields.vacationDaysPerYear)
        : 0;
      const userEmail = fields.userEmail;
      const active = fields.active === "true";
      const contractHoursWeek = fields.contractHoursWeek
        ? Number(fields.contractHoursWeek)
        : undefined;
      const salary = fields.salary
        ? (JSON.parse(fields.salary) as ISalary)
        : undefined;
      const terminatedDate = fields.terminatedDate
        ? new Date(fields.terminatedDate)
        : undefined;
      const comments = fields.comments || undefined;

      if (
        !allEmployeeRoles?.length ||
        !taxNumber ||
        !joinDate ||
        !vacationDaysPerYear ||
        !userEmail
      ) {
        return reply.code(400).send({
          message:
            "AllEmployeeRoles, taxNumber, joinDate, vacationDaysPerYear, businessId and userEmail are required fields!",
        });
      }

      for (const role of allEmployeeRoles) {
        if (!(userRolesEnums as readonly string[]).includes(role)) {
          return reply.code(400).send({ message: "Invalid subscription!" });
        }
      }

      if (salary) {
        const salaryValidationResult = (objDefaultValidation as unknown as ObjDefaultValidationType)(
          salary,
          reqSalaryFields,
          []
        );
        if (salaryValidationResult !== true) {
          return reply.code(400).send({ message: salaryValidationResult });
        }
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
          await session.abortTransaction();
          return reply.code(404).send({ message: "Employee not found!" });
        }

        if (files && files.length + (employee?.documentsUrl?.length || 0) > 10) {
          await session.abortTransaction();
          return reply.code(400).send({ message: "Max file quantity is 10!" });
        }

        const updateEmployeeObj: Partial<IEmployee> = {};

        if (allEmployeeRoles && allEmployeeRoles !== employee.allEmployeeRoles)
          updateEmployeeObj.allEmployeeRoles = allEmployeeRoles;
        if (taxNumber && taxNumber !== employee.taxNumber)
          updateEmployeeObj.taxNumber = taxNumber;
        if (joinDate && joinDate.getTime() !== employee.joinDate?.getTime())
          updateEmployeeObj.joinDate = joinDate;
        if (vacationDaysPerYear && vacationDaysPerYear !== employee.vacationDaysPerYear)
          updateEmployeeObj.vacationDaysPerYear = vacationDaysPerYear;
        if (active !== undefined && active !== employee.active)
          updateEmployeeObj.active = active;
        if (contractHoursWeek && contractHoursWeek !== employee.contractHoursWeek)
          updateEmployeeObj.contractHoursWeek = contractHoursWeek;
        if (terminatedDate && terminatedDate.getTime() !== employee.terminatedDate?.getTime())
          updateEmployeeObj.terminatedDate = terminatedDate;
        if (comments && comments !== employee.comments)
          updateEmployeeObj.comments = comments;

        if (salary) {
          const updatedSalary: Partial<ISalary> = {};
          for (const [key, value] of Object.entries(salary)) {
            if (value !== employee.salary?.[key as keyof typeof salary]) {
              (updatedSalary as Record<string, unknown>)[key] = value;
            }
          }
          if (Object.keys(updatedSalary).length > 0)
            updateEmployeeObj.salary = updatedSalary as ISalary;
        }

        if (
          vacationDaysPerYear !== employee.vacationDaysPerYear ||
          (joinDate && joinDate.getTime() !== employee.joinDate?.getTime())
        ) {
          updateEmployeeObj.vacationDaysLeft = calculateVacationProportional(
            joinDate || employee.joinDate!,
            vacationDaysPerYear || employee.vacationDaysPerYear
          );
        }

        if (userEmail !== employee?.userId?.personalDetails?.email) {
          const user = await User.findOne({ "personalDetails.email": userEmail })
            .select("_id")
            .session(session)
            .lean<IUser | null>();

          if (!user) {
            await session.abortTransaction();
            return reply.code(409).send({ message: "User does not exist!" });
          }

          const employeeAlreadyExists = await Employee.exists({
            businessId: employee.businessId,
            userId: user._id,
          }).session(session);

          if (employeeAlreadyExists) {
            await session.abortTransaction();
            return reply.code(409).send({ message: "User is already an employee!" });
          }

          const [updatedOldUser, updateNewUser] = await Promise.all([
            User.findOneAndUpdate(
              { _id: (employee.userId as IUser)._id },
              { $unset: { employeeDetails: null } },
              { new: true, lean: true, session }
            ),
            User.findOneAndUpdate(
              { _id: user._id },
              { $set: { employeeDetails: employeeId } },
              { new: true, lean: true, session }
            ),
          ]);

          if (!updatedOldUser || !updateNewUser) {
            await session.abortTransaction();
            const message = !updatedOldUser
              ? "Old user not found or not updated"
              : "New user not found or not updated";
            return reply.code(200).send({ message });
          }

          updateEmployeeObj.userId = user._id;
        }

        if (files.length > 0) {
          const folder = `/business/${employee.businessId}/employees/${employeeId}`;

          const cloudinaryUploadResponse = await uploadFilesCloudinary({
            folder,
            filesArr: files,
            onlyImages: true,
          });

          if (
            typeof cloudinaryUploadResponse === "string" ||
            cloudinaryUploadResponse.length === 0 ||
            !cloudinaryUploadResponse.every((str) => str.includes("https://"))
          ) {
            await session.abortTransaction();
            return reply.code(400).send({
              message: `Error uploading image: ${cloudinaryUploadResponse}`,
            });
          }

          updateEmployeeObj.documentsUrl = [
            ...(employee?.documentsUrl || []),
            ...cloudinaryUploadResponse,
          ];
        }

        const [updatedEmployee] = await Promise.all([
          Employee.findOneAndUpdate(
            { _id: employeeId },
            { $set: updateEmployeeObj },
            { new: true, lean: true, session }
          ),

          active === false
            ? Printer.updateMany(
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
                { session }
              )
            : Promise.resolve(null),
        ]);

        if (!updatedEmployee) {
          await session.abortTransaction();
          return reply.code(200).send({
            message: "Employee not found or not updated",
          });
        }

        await session.commitTransaction();

        return reply.code(200).send({
          message: `Employee updated successfully!`,
        });
      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        session.endSession();
      }
    } catch (error) {
      return reply.code(500).send({
        message: "Update employee failed!",
        error: error instanceof Error ? error.message : error,
      });
    }
  });

  // DELETE /employees/:employeeId - delete (transaction)
  app.delete("/:employeeId", async (req, reply) => {
    const params = req.params as { employeeId?: string };
    const employeeId = params.employeeId;

    if (!employeeId || !isObjectIdValid([employeeId])) {
      return reply.code(400).send({ message: "Invalid employee ID!" });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const employee = await Employee.findById(employeeId).session(session).lean<IEmployee>();

      if (!employee) {
        await session.abortTransaction();
        return reply.code(404).send({ message: "Employee not found!" });
      }

      const [deletedEmployee, updatePrinter, updateUser] = await Promise.all([
        Employee.findOneAndDelete({ _id: employeeId }, { session }),

        Printer.updateMany(
          {
            businessId: employee.businessId,
            $or: [
              { employeesAllowedToPrintDataIds: employeeId },
              {
                "configurationSetupToPrintOrders.excludeemployeeIds": employeeId,
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
          { session }
        ),

        User.findOneAndUpdate(
          { employeeDetails: employeeId },
          { $unset: { employeeDetails: null } },
          { new: true, lean: true, session }
        ),
      ]);

      if (!deletedEmployee || !updatePrinter || !updateUser) {
        await session.abortTransaction();
        const message = !deletedEmployee
          ? "Employee not found or not deleted"
          : !updatePrinter
          ? "Printer not updated"
          : "User not found or not updated";
        return reply.code(200).send({ message });
      }

      const folderPath = `/business/${employee.businessId}/employees/${employeeId}`;

      const deleteFolderCloudinaryResult: string | boolean =
        await deleteFolderCloudinary(folderPath);

      if (deleteFolderCloudinaryResult !== true) {
        await session.abortTransaction();
        return reply.code(400).send({ message: deleteFolderCloudinaryResult });
      }

      await session.commitTransaction();

      return reply.code(200).send({
        message: `Employee deleted successfully`,
      });
    } catch (error) {
      await session.abortTransaction();
      return reply.code(500).send({
        message: "Delete employee failed!",
        error: error instanceof Error ? error.message : error,
      });
    } finally {
      session.endSession();
    }
  });

  // GET /employees/business/:businessId - get by business
  app.get("/business/:businessId", async (req, reply) => {
    const params = req.params as { businessId?: string };
    const businessId = params.businessId;

    if (!businessId || isObjectIdValid([businessId]) !== true) {
      return reply.code(400).send({ message: "Invalid business ID!" });
    }

    const employees = await Employee.find({
      businessId: new Types.ObjectId(businessId),
    }).lean();

    if (!employees.length) {
      return reply.code(404).send({
        message: "No employees found within the business id!",
      });
    }
    return reply.code(200).send(employees);
  });
};
