// this will be used to send push notifications to employees
// tokens have to be saved in the employee model
// firebase cloud messaging tokens are used to send push notifications to employees
// it is not done yet

import { Types } from "mongoose";

// imported utils
import connectDb from "@/app/lib/utils/connectDb";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";

// imported models
import Employee from "@/app/lib/models/employee";

export const saveTokenIntoEmployee = async (
  employeeId: Types.ObjectId,
  fcmToken: string
) => {
  // Validate employee ID
  if (!isObjectIdValid([employeeId])) {
    return "Invalid employee ID!";
  }

  // Validate fcmToken
  if (typeof fcmToken !== "string" || fcmToken.trim() === "") {
    return "FCM token is required and must be a non-empty string!";
  }

  try {
    // Connect to the database
    await connectDb();

    // Update the employee with the new FCM token
    const updatedToken = await Employee.findByIdAndUpdate(
      employeeId,
      { $set: { fcmToken } },
      { new: true, lean: true }
    );

    if (!updatedToken) {
      return "Employee not found!";
    }

    return "FCM token saved into employee successfully!";
  } catch (error) {
    return "Save FCM token into employee failed! Error: " + error;
  }
};
