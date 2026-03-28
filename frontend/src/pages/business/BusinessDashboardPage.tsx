import { useParams } from "react-router-dom";
import { useAuth } from "@/auth";
import { BusinessTenantPageHeader } from "@/components/BusinessTenantPageHeader";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Authenticated tenant home (`/business/:businessId`). Outer shell: `BusinessLayout`.
 */
export default function BusinessDashboardPage() {
  const { businessId } = useParams();
  const { state } = useAuth();

  const session = state.user;
  const email = session?.type === "business" ? session.email : undefined;

  return (
    <>
      {session?.type === "business" ? (
        <BusinessTenantPageHeader
          title="Business dashboard"
          businessId={businessId}
          session={session}
        />
      ) : null}
      <main className="min-h-0 flex-1 p-6">
        <Card className="mx-auto max-w-lg">
          <CardHeader>
            <CardTitle>Tenant workspace</CardTitle>
            <CardDescription>
              {email ? (
                <>
                  Signed in as <span className="font-medium text-neutral-800">{email}</span>
                </>
              ) : (
                "Session details unavailable."
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-neutral-600">
              Use the account menu (top right) for profile, favorites, dashboard, or to sign out.
            </p>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
