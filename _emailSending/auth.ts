import connectDb from "@/app/api/db/connectDb";
import User from "@/app/api/models/user";
import Subscriber from "@/app/api/models/subscriber";
import crypto from "crypto";
import { hash } from "bcrypt";
import mongoose from "mongoose";
import { sendEmail } from "@/lib/utils/email";
import { passwordResetTemplate } from "@/lib/utils/emailTemplates";
import { generateEmailLink } from "@/lib/utils/emailLinkGenerator";
import passwordValidation from "@/lib/utils/passwordValidation";

export interface RequestEmailConfirmationResult {
  user: {
    _id: string;
    username: string;
    email: string;
    preferences?: {
      language?: string;
    };
  } | null;
  verificationToken: string;
}

export async function requestEmailConfirmationService(
  email: string
): Promise<RequestEmailConfirmationResult> {
  if (!email || !email.includes("@")) {
    throw new Error("Invalid email address");
  }

  await connectDb();

  // Check if user exists
  const user = await User.findOne({ email });

  if (!user) {
    // Return null user but don't throw - security: don't reveal if user exists
    return {
      user: null,
      verificationToken: "",
    };
  }

  // Check if email is already verified
  if (user.emailVerified) {
    throw new Error("Email is already verified.");
  }

  // Generate new verification token
  const verificationToken = crypto.randomBytes(32).toString("hex");

  // Update user with new verification token
  await User.findByIdAndUpdate(user._id, {
    verificationToken,
  });

  return {
    user: {
      _id: user._id.toString(),
      username: user.username,
      email: user.email,
      preferences: user.preferences as { language?: string } | undefined,
    },
    verificationToken,
  };
}

export async function confirmEmailService(token: string): Promise<void> {
  if (!token || token.trim() === "") {
    throw new Error("Verification token is required");
  }

  await connectDb();

  // Find user with valid verification token
  const user = await User.findOne({
    verificationToken: token,
  });

  if (!user) {
    throw new Error(
      "Invalid verification token. Please request a new confirmation link."
    );
  }

  // Check if email is already verified
  if (user.emailVerified) {
    throw new Error("Email is already verified.");
  }

  // Start database transaction to update both user and subscriber
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Update user to mark email as verified and clear verification token
    await User.findByIdAndUpdate(
      user._id,
      {
        emailVerified: true,
        verificationToken: undefined,
      },
      { session }
    );

    // Also update linked subscriber's email verification status
    if (user.subscriptionId) {
      await Subscriber.findByIdAndUpdate(
        user.subscriptionId,
        {
          emailVerified: true,
        },
        { session }
      );
    }

    // Commit the transaction
    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
}

export interface RequestPasswordResetResult {
  user: {
    _id: string;
    username: string;
    email: string;
    preferences?: {
      language?: string;
    };
  } | null;
  resetToken: string;
  resetTokenExpiry: Date;
}

export async function requestPasswordResetService(
  email: string
): Promise<RequestPasswordResetResult> {
  if (!email || !email.includes("@")) {
    throw new Error("Invalid email address");
  }

  await connectDb();

  // Check if user exists
  const user = await User.findOne({ email });

  if (!user) {
    // Return null user but don't throw - security: don't reveal if user exists
    return {
      user: null,
      resetToken: "",
      resetTokenExpiry: new Date(),
    };
  }

  // Generate reset token
  const resetToken = crypto.randomBytes(32).toString("hex");
  const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now

  // Save reset token to user
  await User.findByIdAndUpdate(user._id, {
    resetPasswordToken: resetToken,
    resetPasswordExpires: resetTokenExpiry,
  });

  return {
    user: {
      _id: user._id.toString(),
      username: user.username,
      email: user.email,
      preferences: user.preferences as { language?: string } | undefined,
    },
    resetToken,
    resetTokenExpiry,
  };
}

export async function sendPasswordResetEmail(
  email: string
): Promise<{ success: boolean; message: string }> {
  if (!email || !email.includes("@")) {
    throw new Error("Invalid email address");
  }

  // Verify email configuration is available
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    console.error("Email configuration missing");
    throw new Error("Email service is not configured. Please contact support.");
  }

  // Get reset token from service
  const result = await requestPasswordResetService(email);

  // If user doesn't exist, don't reveal it for security
  if (!result.user) {
    return {
      success: true,
      message:
        "If an account with that email exists, a password reset link has been sent.",
    };
  }

  // Get user's preferred locale
  const userLocale = result.user.preferences?.language || "en";

  // Create reset link with locale and translated route
  const resetLink = await generateEmailLink(
    "reset-password",
    { token: result.resetToken },
    userLocale
  );

  // Generate email content
  const emailContent = passwordResetTemplate(
    resetLink,
    result.user.username,
    userLocale
  );

  try {
    // Send email
    console.log("Attempting to send password reset email to:", email);
    const emailResult = await sendEmail({
      from: `"Women's Spot" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    });

    console.log(
      "Password reset email sent successfully:",
      emailResult.messageId
    );

    return {
      success: true,
      message:
        "If an account with that email exists, a password reset link has been sent.",
    };
  } catch (emailError) {
    console.error("Failed to send password reset email:", emailError);

    // Remove the reset token if email failed
    await connectDb();
    await User.findByIdAndUpdate(result.user._id, {
      resetPasswordToken: undefined,
      resetPasswordExpires: undefined,
    });

    throw new Error(
      "Failed to send password reset email. Please try again later."
    );
  }
}

export async function resetPasswordService(
  token: string,
  newPassword: string
): Promise<void> {
  if (!token || !newPassword) {
    throw new Error("Reset token and new password are required");
  }

  // Validate new password using full validation
  if (!passwordValidation(newPassword)) {
    throw new Error(
      "Password must contain at least one lowercase letter, one uppercase letter, one digit, one symbol, and be at least 6 characters long"
    );
  }

  await connectDb();

  // Find user with valid reset token
  const user = await User.findOne({
    resetPasswordToken: token,
    resetPasswordExpires: { $gt: Date.now() }, // Token not expired
  });

  if (!user) {
    throw new Error(
      "Invalid or expired reset token. Please request a new password reset link."
    );
  }

  // Hash new password
  const hashedPassword = await hash(newPassword, 10);

  // Update password and clear reset token
  await User.findByIdAndUpdate(user._id, {
    password: hashedPassword,
    resetPasswordToken: undefined,
    resetPasswordExpires: undefined,
  });
}
