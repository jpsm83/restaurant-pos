import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Public customer marketing home (`/`).
 * Nav: `Navbar` in `PublicLayout`. Value prop: customer / self-order / reservations (see `documentation/context.md`).
 */
export default function CustomerHomePage() {
  return (
    <main className="flex min-h-0 flex-1 flex-col w-full">
      <section className="flex w-full flex-1 flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
        <Card className="w-full">
          <CardHeader className="items-start text-left">
            <CardTitle>Order and dine with confidence</CardTitle>
            <CardDescription>
              Project Imperium connects you to the restaurants you love: reservations, table-side
              ordering where venues enable it, and a single account for your activity and receipts.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-[120px_1fr]">
            <img
              src="/imperium.png"
              alt="Imperium app logo"
              className="h-28 w-28 rounded-xl border border-neutral-200 bg-white p-2 object-contain"
            />
            <div className="space-y-4 text-sm text-neutral-700">
              <p>
                <span className="font-medium text-neutral-900">Reservations</span> — Request a
                table; staff confirm and tie your visit into the venue&apos;s service flow.
              </p>
              <p>
                <span className="font-medium text-neutral-900">Self-ordering</span> — At
                participating locations, scan the table QR to open a session, place orders, and pay
                when the business allows it—your session is tied to your login, with confirmations
                you can show staff.
              </p>
              <p>
                <span className="font-medium text-neutral-900">Your account</span> — Sign in once
                for customer mode: order history, account activity, and the same identity if you also
                work for a venue as staff (employee mode is gated separately).
              </p>
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
