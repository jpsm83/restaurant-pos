import { useParams } from "react-router-dom";
import { useAuth } from "@/auth";
import { BusinessTenantPageHeader } from "@/components/BusinessTenantPageHeader";

/** `/business/:businessId/favorites` — placeholder until tenant favorites UI ships. */
export default function BusinessTenantFavoritesPage() {
  const { businessId } = useParams();
  const { state } = useAuth();
  const session = state.user;

  if (!session || session.type !== "business") {
    return null;
  }

  return (
    <>
      <BusinessTenantPageHeader title="Favorites" businessId={businessId} session={session} />
      <main className="min-h-0 flex-1 p-6">
        <p className="text-sm text-neutral-600">This page is not built yet.</p>
      </main>
    </>
  );
}
