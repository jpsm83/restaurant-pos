import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Public business marketing home (`/business`).
 * Nav: `Navbar`. Tenant POS + operations (see `documentation/context.md` — What the app can do).
 */
export default function BusinessHomePage() {
  return (
    <main className="flex min-h-0 flex-1 flex-col w-full">
      <section className="flex w-full flex-1 flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
        <Card className="w-full">
          <CardHeader className="items-start text-left">
            <CardTitle>One platform for service, stock, and numbers</CardTitle>
            <CardDescription>
              A full-stack, multi-tenant POS and operations hub for bars and restaurants: live
              service, menu and costing, purchasing, inventory, staff, reporting, and reservations—
              isolated per business.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-3 text-sm text-neutral-700 sm:grid-cols-2">
              <li className="rounded-lg border border-neutral-200 bg-neutral-50/80 px-3 py-2">
                <span className="font-medium text-neutral-900">Service &amp; sales</span> — Sales
                points and sessions, orders, promotions, payments, transfers, and printing—aligned
                with your floor workflow.
              </li>
              <li className="rounded-lg border border-neutral-200 bg-neutral-50/80 px-3 py-2">
                <span className="font-medium text-neutral-900">Menu &amp; inventory</span> — Business
                goods, recipes and allergens, stock that moves with sales, and monthly physical counts.
              </li>
              <li className="rounded-lg border border-neutral-200 bg-neutral-50/80 px-3 py-2">
                <span className="font-medium text-neutral-900">Purchasing</span> — Suppliers,
                receipts, line edits with audit trail, and waste and cost targets tied into reporting.
              </li>
              <li className="rounded-lg border border-neutral-200 bg-neutral-50/80 px-3 py-2">
                <span className="font-medium text-neutral-900">People &amp; schedules</span> —{" "}
                Employees, roles, shifts, and schedule-aware access for operational and manager
                actions.
              </li>
              <li className="rounded-lg border border-neutral-200 bg-neutral-50/80 px-3 py-2 sm:col-span-2">
                <span className="font-medium text-neutral-900">Reporting</span> — Daily sales by
                actor, weekly rollups, and monthly KPIs with targets—so you see performance as you
                run the house.
              </li>
            </ul>
            <div className="mt-6 flex flex-wrap gap-3 border-t border-neutral-200 pt-6">
              <Button asChild size="sm">
                <Link to="/business/register">Register your business</Link>
              </Button>
              <p className="self-center text-xs text-neutral-600">
                Creates your tenant account (same as the header{" "}
                <span className="font-medium text-neutral-800">Sign up</span> link).
              </p>
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
