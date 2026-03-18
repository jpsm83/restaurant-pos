/**
 * options — NextAuth configuration and auth providers
 *
 * Single login: validates email/password against Business first, then User.
 * Session includes type (business | user) and for users linked to an employee:
 * employeeId, businessId, canLogAsEmployee (schedule check: 5 min before shift).
 * Redirect after sign-in: business → /admin; user without employee → customer flow;
 * user with employee → /auth/choose-mode.
 */

import Business from "@/lib/db/models/business";
import User from "@/lib/db/models/user";
import Employee from "@/lib/db/models/employee";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GitHubProvider from "next-auth/providers/github";
import bcrypt from "bcrypt";
import connectDb from "@/lib/db/connectDb";
import { canLogAsEmployee } from "@/lib/auth/canLogAsEmployee";

/** Shape of the credentials object passed to the Credentials provider. */
interface Credentials {
  email: string;
  password: string;
}

/** Object returned from authorize for Business (back-office). */
export interface AuthBusiness {
  id: string;
  email: string;
  type: "business";
}

/** Object returned from authorize for User (person); employee fields only when linked. */
export interface AuthUser {
  id: string;
  email: string;
  type: "user";
  employeeId?: string;
  businessId?: string;
  canLogAsEmployee?: boolean;
}

export type AuthSessionUser = AuthBusiness | AuthUser;

export const options: NextAuthOptions = {
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_ID as string,
      clientSecret: process.env.GITHUB_SECRET as string,
    }),
    CredentialsProvider({
      /** The name to display on the sign in form (e.g. "Sign in with...") */
      name: "Credentials",
      /**
       * `credentials` is used to generate a form on the sign in page.
       * You can specify which fields should be submitted, by adding keys to the `credentials` object.
       * e.g. domain, email, password, 2FA token, etc.
       * You can pass any HTML attribute to the <input> tag through the object.
       * Form fields for the sign-in form; keys become credential names in authorize().
       */
      credentials: {
        email: { label: "Email", type: "email", placeholder: "your email" },
        password: {
          label: "Password",
          type: "password",
          placeholder: "your password",
        },
      },

      async authorize(credentials: Credentials | null | undefined) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Invalid credentials");
        }

        await connectDb();

        // 1. Business first
        const business = (await Business.findOne({
          email: credentials.email,
        })
          .select("_id email password")
          .lean()) as { _id: unknown; email: string; password: string } | null;

        if (business) {
          const ok = await bcrypt.compare(
            credentials.password,
            business.password,
          );
          if (ok) {
            return {
              id: String(business._id),
              email: business.email,
              type: "business",
            } as AuthBusiness;
          }
          return null;
        }

        // 2. User
        const user = (await User.findOne({
          "personalDetails.email": credentials.email,
        })
          .select("_id personalDetails.email personalDetails.password employeeDetails")
          .lean()) as {
          _id: unknown;
          personalDetails: { email?: string; password?: string };
          employeeDetails?: unknown;
        } | null;

        if (!user?.personalDetails?.password) {
          return null;
        }

        const ok = await bcrypt.compare(
          credentials.password,
          user.personalDetails.password,
        );
        if (!ok) return null;

        const email =
          typeof user.personalDetails.email === "string"
            ? user.personalDetails.email
            : String(user.personalDetails.email);
        const base: AuthUser = {
          id: String(user._id),
          email,
          type: "user",
        };

        if (!user.employeeDetails) {
          return base;
        }

        const employee = (await Employee.findById(user.employeeDetails)
          .select("businessId active terminatedDate")
          .lean()) as { businessId: unknown; active?: boolean; terminatedDate?: unknown } | null;

        if (!employee || !employee.active || employee.terminatedDate) {
          return base;
        }

        const { canLogAsEmployee: canLog } = await canLogAsEmployee(
          user.employeeDetails as import("mongoose").Types.ObjectId,
        );

        return {
          ...base,
          employeeId: String(user.employeeDetails),
          businessId: String(employee.businessId),
          canLogAsEmployee: canLog,
        };
      },
    }),
  ],
  pages: {
    signOut: "/",
  },
  callbacks: {
    jwt(params) {
      const { token, user } = params;
      const authUser = user as AuthSessionUser | undefined;
      if (authUser) {
        token.type = authUser.type;
        token.id = authUser.id;
        token.email = authUser.email;
        if (authUser.type === "user") {
          token.employeeId = (authUser as AuthUser).employeeId;
          token.businessId = (authUser as AuthUser).businessId;
          token.canLogAsEmployee = (authUser as AuthUser).canLogAsEmployee;
        }
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = typeof token.id === "string" ? token.id : session.user.id;
        session.user.email = (token.email as string) ?? session.user.email;
        session.user.type = token.type as "business" | "user";
        if (token.type === "user") {
          (session.user as { employeeId?: string }).employeeId = token.employeeId as string | undefined;
          (session.user as { businessId?: string }).businessId = token.businessId as string | undefined;
          (session.user as { canLogAsEmployee?: boolean }).canLogAsEmployee = token.canLogAsEmployee as boolean | undefined;
        }
      }
      return session;
    },
    redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },
  },
  debug: process.env.NODE_ENV === "development",
  session: {
    strategy: "jwt",
  },
  secret: process.env.AUTH_SECRET,
};
