import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useNavigate } from "react-router-dom";
import { getCurrentUser } from "@/auth/api";
import { useAuth } from "@/auth/store/AuthContext";
import type { AuthUser } from "@/auth/types";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuthMode } from "@/context/AuthModeContext";
import { useErrorMessage, type ErrorFailure } from "@/i18n/errorCopy";
import { findFirstEnterableVenue } from "@/lib/accessibleVenues";
import { SessionLoading } from "@/routes/AuthRouteGuards";
import { toServiceRequestError } from "@/services/serviceErrors";
import { useAccessibleVenuesQuery } from "@/services/authVenues";
import { queryKeys } from "@/services/queryKeys";
import { useNextShiftForEmployee } from "@/services/schedulesService";
import {
  deriveEmployeeModeFromSchedule,
  formatDayKeyLocal,
} from "@/lib/employeeModeSchedule";
import {
  canonicalBusinessDashboardRoutePath,
  canonicalCustomerDashboardPath,
} from "@/routes/canonicalPaths";

function formatRemaining(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function EmployeeModeCountdown({
  targetMs,
  onReachZero,
  className,
}: {
  targetMs: number;
  onReachZero: () => void;
  className?: string;
}) {
  const { t } = useTranslation("mode");
  const onZeroRef = useRef(onReachZero);
  const firedRef = useRef(false);
  const [label, setLabel] = useState("");

  useEffect(() => {
    onZeroRef.current = onReachZero;
  }, [onReachZero]);

  useEffect(() => {
    firedRef.current = false;

    const tick = () => {
      const remainingMs = targetMs - Date.now();
      if (remainingMs <= 0) {
        setLabel(formatRemaining(0));
        if (!firedRef.current) {
          firedRef.current = true;
          onZeroRef.current();
        }
        return false;
      }
      setLabel(formatRemaining(Math.ceil(remainingMs / 1000)));
      return true;
    };

    if (!tick()) {
      return;
    }

    const id = window.setInterval(() => {
      if (!tick()) {
        window.clearInterval(id);
      }
    }, 1000);

    return () => window.clearInterval(id);
  }, [targetMs]);

  return (
    <CardDescription
      className={className}
      role="status"
      aria-live="polite"
    >
      {t("countdown.unlocksIn", { time: label })}
    </CardDescription>
  );
}

function hasEmployeeLink(
  user: AuthUser | null | undefined,
): user is AuthUser & { employeeId: string } {
  if (!user || user.type !== "user") return false;
  const id = user.employeeId?.trim();
  return Boolean(id);
}

/**
 * `/mode` — the Customer | Business fallback for direct visits. Business opens the
 * first enterable venue; when venues exist but none are enterable yet, the page
 * keeps the schedule countdown and explanation instead of hiding Business.
 */
export default function SelectUserModePage() {
  const { t } = useTranslation("mode");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { state, dispatch } = useAuth();
  const {
    setModeAndRefresh,
    isSettingMode,
    error: modeLoadError,
  } = useAuthMode();
  const [submitFailure, setSubmitFailure] = useState<ErrorFailure | null>(null);
  const resolveError = useErrorMessage();

  const [dayKey, setDayKey] = useState(() => formatDayKeyLocal(new Date()));
  useEffect(() => {
    const id = window.setInterval(() => {
      setDayKey(formatDayKeyLocal(new Date()));
    }, 60_000);
    return () => window.clearInterval(id);
  }, []);

  const sessionUser = state.user?.type === "user" ? state.user : null;
  const venuesQuery = useAccessibleVenuesQuery({ enabled: Boolean(sessionUser) });
  const venues = venuesQuery.data ?? [];
  const firstEnterableVenue = findFirstEnterableVenue(venues);
  const canEnterBusiness = Boolean(firstEnterableVenue);

  const linked = hasEmployeeLink(sessionUser);
  const businessId = linked ? sessionUser.businessId : undefined;
  const employeeId = linked ? sessionUser.employeeId : undefined;

  const scheduleQuery = useNextShiftForEmployee({
    businessId,
    employeeId,
    dayKey,
    enabled: Boolean(
      businessId &&
        employeeId &&
        linked &&
        venuesQuery.isSuccess &&
        venues.length > 0 &&
        !canEnterBusiness,
    ),
  });

  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!linked || canEnterBusiness) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [linked, canEnterBusiness]);

  const scheduleFailure = scheduleQuery.isError
    ? toServiceRequestError(scheduleQuery.error, "scheduleLoad")
    : null;
  const venuesFailure = venuesQuery.isError
    ? toServiceRequestError(venuesQuery.error, "venuesLoad")
    : null;
  const modeLoadFailure = modeLoadError
    ? toServiceRequestError(modeLoadError, "modeLoad")
    : null;
  // Submit feedback is the most direct; then the venue read that drives
  // Business eligibility, then the schedule check and the mode read.
  const failure =
    submitFailure ?? venuesFailure ?? scheduleFailure ?? modeLoadFailure;

  const derived = useMemo(
    () => deriveEmployeeModeFromSchedule(nowMs, scheduleQuery.data?.entries ?? []),
    [nowMs, scheduleQuery.data?.entries],
  );

  const refreshVenuesAndSession = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.auth.venues() });
    const me = await getCurrentUser();
    if (me.ok && me.data) {
      dispatch({ type: "AUTH_SUCCESS", payload: me.data });
    }
  }, [dispatch, queryClient]);

  useEffect(() => {
    if (!linked || canEnterBusiness || !scheduleQuery.isSuccess || !scheduleQuery.data) return;
    const d = deriveEmployeeModeFromSchedule(
      Date.now(),
      scheduleQuery.data.entries,
    );
    if (!d.scheduleAllowsEmployeeNow) return;
    void refreshVenuesAndSession();
  }, [
    linked,
    canEnterBusiness,
    scheduleQuery.isSuccess,
    scheduleQuery.data,
    refreshVenuesAndSession,
  ]);

  const onCountdownComplete = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: queryKeys.schedules.employeeDayAll(),
    });
    await refreshVenuesAndSession();
  }, [queryClient, refreshVenuesAndSession]);

  if (!sessionUser) {
    return <Navigate to={canonicalCustomerDashboardPath()} replace />;
  }

  if (venuesQuery.isLoading) {
    return <SessionLoading />;
  }

  if (venuesQuery.isSuccess && venues.length === 0) {
    return <Navigate to={canonicalCustomerDashboardPath()} replace />;
  }

  const showCountdown =
    !canEnterBusiness && derived.countdownTargetMs !== null;

  const businessDescription = canEnterBusiness
    ? t("businessHelp.canBusiness")
    : showCountdown
      ? t("businessHelp.countdownSoon")
      : t("businessHelp.blocked");

  const goCustomer = async () => {
    setSubmitFailure(null);
    try {
      await setModeAndRefresh("customer");
      navigate(canonicalCustomerDashboardPath(), { replace: true });
    } catch (e) {
      setSubmitFailure(toServiceRequestError(e, "modeSave"));
    }
  };

  const goBusiness = async () => {
    if (!firstEnterableVenue) return;
    setSubmitFailure(null);
    try {
      await setModeAndRefresh("business");
      navigate(
        canonicalBusinessDashboardRoutePath(firstEnterableVenue.businessId),
        { replace: true },
      );
    } catch (e) {
      setSubmitFailure(toServiceRequestError(e, "modeSave"));
    }
  };

  return (
    <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-y-auto bg-surface">
      <main className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>{t("title")}</CardTitle>
            <CardDescription>{t("description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {failure ? <Alert>{resolveError(failure)}</Alert> : null}
            <Button
              type="button"
              className="w-full"
              disabled={isSettingMode}
              aria-busy={isSettingMode || undefined}
              onClick={() => void goCustomer()}
            >
              {t("continueCustomer")}
            </Button>
            <div className="space-y-2 border-t border-border pt-4">
              <CardDescription>{businessDescription}</CardDescription>
              {showCountdown && derived.countdownTargetMs !== null ? (
                <EmployeeModeCountdown
                  targetMs={derived.countdownTargetMs}
                  onReachZero={() => void onCountdownComplete()}
                  className="text-center text-sm font-medium text-muted-foreground"
                />
              ) : null}
              <Button
                type="button"
                className="w-full"
                disabled={!canEnterBusiness || isSettingMode}
                aria-busy={isSettingMode || undefined}
                onClick={() => void goBusiness()}
              >
                {t("continueBusiness")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
