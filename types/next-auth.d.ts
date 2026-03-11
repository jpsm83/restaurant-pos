import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id?: string;
      email?: string | null;
      name?: string | null;
      image?: string | null;
      type: "business" | "user";
      employeeId?: string;
      businessId?: string;
      canLogAsEmployee?: boolean;
      mode?: "customer" | "employee";
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    type?: "business" | "user";
    employeeId?: string;
    businessId?: string;
    canLogAsEmployee?: boolean;
    mode?: "customer" | "employee";
  }
}
