import Business from "@/app/lib/models/business";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GitHubProvider from "next-auth/providers/github";
import bcrypt from "bcrypt";
import connectDb from "@/app/lib/utils/connectDb";

// Define an interface for the credentials
interface Credentials {
  email: string;
  password: string;
}

export const options: NextAuthOptions = {
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_ID as string,
      clientSecret: process.env.GITHUB_SECRET as string,
    }),
    CredentialsProvider({
      // The name to display on the sign in form (e.g. "Sign in with...")
      name: "Credentials",
      // `credentials` is used to generate a form on the sign in page.
      // You can specify which fields should be submitted, by adding keys to the `credentials` object.
      // e.g. domain, email, password, 2FA token, etc.
      // You can pass any HTML attribute to the <input> tag through the object.
      credentials: {
        email: { label: "Email", type: "email", placeholder: "your email" },
        password: {
          label: "Password",
          type: "password",
          placeholder: "your password",
        },
      },

      async authorize(credentials: Credentials | null | undefined, req) {
        // You need to provide your own logic here that takes the credentials
        // submitted and returns either a object representing a user or value
        // that is false/null if the credentials are invalid.
        // e.g. return { id: 1, name: 'J Smith', email: 'jsmith@example.com' }
        // You can also use the `req` object to obtain additional parameters
        // (i.e., the request IP address)
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Invalid credentials");
        }

        // connect before first call to DB
        await connectDb();

        // Add logic here to look up the business from the credentials supplied
        const business = await Business.findOne({
          email: credentials.email,
        }).select("email password");

        if (!business) {
          return null;
        }

        const isCorrectPassword = await bcrypt.compare(
          credentials.password,
          business.password
        );

        if (!isCorrectPassword) {
          return null;
        }

        return business;
      },
    }),
  ],
  pages: {
    signOut: "/", // Redirect to root ("/") after sign-out
  },
  debug: process.env.NODE_ENV === "development",
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
