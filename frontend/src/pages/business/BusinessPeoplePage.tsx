import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { Plus, ShieldAlert, Users } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useErrorMessage, type ErrorFailure } from "@/i18n/errorCopy";
import {
  canManageVenue,
  useBusinessAccessSnapshotQuery,
  useVenueMembershipsQuery,
} from "@/services/employees/employeesService";
import { ServiceRequestError } from "@/services/serviceErrors";
import HireStaffForm from "./people/HireStaffForm";
import MembershipTable from "./people/MembershipTable";

function isForbiddenFailure(failure: ErrorFailure | null): boolean {
  return failure?.status === 403 || failure?.code.endsWith(".forbidden") === true;
}

/**
 * Venue People page (`/business/:businessId/people`).
 *
 * The access snapshot gates the page; the list and hire form compose the
 * manager surface. The server repeats the access and role-assignment checks.
 */
export default function BusinessPeoplePage() {
  const { t } = useTranslation("business");
  const { businessId } = useParams<{ businessId: string }>();
  const resolveError = useErrorMessage();
  const accessQuery = useBusinessAccessSnapshotQuery(businessId);
  const access = accessQuery.data;
  const canManage = canManageVenue(access);
  const membershipsQuery = useVenueMembershipsQuery(businessId, {
    enabled: canManage,
  });

  const [isHireOpen, setIsHireOpen] = useState(false);
  const [hired, setHired] = useState(false);

  const accessFailure =
    accessQuery.error instanceof ServiceRequestError
      ? accessQuery.error
      : null;
  const listFailure =
    membershipsQuery.error instanceof ServiceRequestError
      ? membershipsQuery.error
      : null;

  if (accessQuery.isLoading) {
    return (
      <main className="min-h-0 flex-1 space-y-4 p-6" aria-busy="true">
        <span className="sr-only">{t("people.states.loading")}</span>
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-24 w-full max-w-4xl" />
        <Skeleton className="h-40 w-full max-w-4xl" />
      </main>
    );
  }

  if (isForbiddenFailure(accessFailure) || (access && !canManage)) {
    return (
      <main className="min-h-0 flex-1 space-y-4 p-6">
        <h1 className="text-xl font-semibold text-foreground">
          {t("people.title")}
        </h1>
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldAlert className="size-4" aria-hidden />
              {t("people.states.accessDeniedTitle")}
            </CardTitle>
            <CardDescription>
              {t("people.states.accessDeniedDescription")}
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  if (accessQuery.isError || !access) {
    return (
      <main className="min-h-0 flex-1 space-y-4 p-6">
        <h1 className="text-xl font-semibold text-foreground">
          {t("people.title")}
        </h1>
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle className="text-base">
              {t("people.states.errorTitle")}
            </CardTitle>
            <CardDescription>
              {t("people.states.errorDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Alert>
              {resolveError(
                accessFailure ?? { code: "businessAccess.transport" },
              )}
            </Alert>
            <Button
              type="button"
              variant="outline"
              onClick={() => void accessQuery.refetch()}
            >
              {t("people.states.retry")}
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-0 flex-1 space-y-6 p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-xl font-semibold text-foreground">
            <Users className="size-5" aria-hidden />
            {t("people.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("people.description")}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setHired(false);
            setIsHireOpen((open) => !open);
          }}
        >
          <Plus className="size-4" aria-hidden />
          {t("people.hireStaff")}
        </Button>
      </header>

      {hired ? (
        <Alert tone="success" className="w-full max-w-3xl">
          {t("people.messages.hired")}
        </Alert>
      ) : null}

      {isHireOpen ? (
        <HireStaffForm
          businessId={businessId as string}
          access={access}
          onHired={() => {
            setIsHireOpen(false);
            setHired(true);
          }}
          onCancel={() => setIsHireOpen(false)}
        />
      ) : null}

      <Card className="w-full max-w-4xl">
        <CardHeader>
          <CardTitle className="text-base">{t("people.list.title")}</CardTitle>
          <CardDescription>{t("people.list.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {membershipsQuery.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : null}

          {membershipsQuery.isError ? (
            <>
              <p className="font-medium text-foreground">
                {t("people.states.errorTitle")}
              </p>
              <Alert>
                {resolveError(
                  listFailure ?? { code: "employeesFetch.transport" },
                )}
              </Alert>
              <Button
                type="button"
                variant="outline"
                onClick={() => void membershipsQuery.refetch()}
              >
                {t("people.states.retry")}
              </Button>
            </>
          ) : null}

          {membershipsQuery.isSuccess &&
          (membershipsQuery.data?.length ?? 0) === 0 ? (
            <div className="rounded-lg border border-border p-6 text-center">
              <p className="font-medium text-foreground">
                {t("people.states.emptyTitle")}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("people.states.emptyDescription")}
              </p>
            </div>
          ) : null}

          {membershipsQuery.isSuccess &&
          (membershipsQuery.data?.length ?? 0) > 0 ? (
            <MembershipTable rows={membershipsQuery.data ?? []} />
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
