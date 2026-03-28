import { Link } from "react-router-dom";
import type { AuthBusiness } from "@/auth/types";
import { AccountMenuPopover } from "@/components/AccountMenuPopover";

export function BusinessTenantPageHeader({
  title,
  businessId,
  session,
}: {
  title: string;
  businessId: string | undefined;
  session: AuthBusiness;
}) {
  return (
    <header className="shrink-0 border-b border-neutral-200 bg-white px-4 py-3 sm:px-6 sm:py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
          <Link to="/" className="flex shrink-0 items-center gap-3">
            <img
              src="/imperium.png"
              alt=""
              className="h-8 w-10 object-contain"
              width={32}
              height={32}
            />
            <span className="text-md font-semibold text-neutral-800">
              Project Imperium POS
            </span>
          </Link>
          <div className="min-w-0 border-l-0 sm:border-l sm:border-neutral-200 sm:pl-6">
            <h1 className="text-lg font-semibold text-neutral-900 sm:text-xl">{title}</h1>
            {businessId ? (
              <p className="mt-1 font-mono text-sm text-neutral-600">Tenant: {businessId}</p>
            ) : null}
          </div>
        </div>
        <AccountMenuPopover session={session} />
      </div>
    </header>
  );
}
