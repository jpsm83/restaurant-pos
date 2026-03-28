import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { getCurrentUser, useAuth } from "@/auth";
import type { AuthUser } from "@/auth/types";
import Navbar from "@/components/Navbar";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuthMode } from "@/auth";
import { useNextShiftForEmployee } from "@/services/schedulesService";
import {
  deriveEmployeeModeFromSchedule,
  formatDayKeyLocal,
} from "@/lib/employeeModeSchedule";
import { canonicalUserCustomerHomePath, canonicalUserEmployeeHomePath } from "@/routes/canonicalPaths";

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
    <p className={className} role="status" aria-live="polite">
      {t("countdown.unlocksIn", { time: label })}
    </p>
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
 * `/:userId/mode` — users linked as staff pick customer vs employee; same shell rhythm as `LoginPage`.
 */
export default function SelectUserModePage() {
  const { t } = useTranslation("mode");
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { state, dispatch } = useAuth();
  const { setModeAndRefresh, isSettingMode } = useAuthMode();
  const [error, setError] = useState<string | null>(null);

  const [dayKey, setDayKey] = useState(() => formatDayKeyLocal(new Date()));
  useEffect(() => {
    const id = window.setInterval(() => {
      setDayKey(formatDayKeyLocal(new Date()));
    }, 60_000);
    return () => window.clearInterval(id);
  }, []);

  const sessionUser = state.user?.type === "user" ? state.user : null;
  const linked = hasEmployeeLink(sessionUser);
  const businessId = linked ? sessionUser.businessId : undefined;
  const employeeId = linked ? sessionUser.employeeId : undefined;
  const canEmployee = linked && sessionUser.canLogAsEmployee === true;

  const scheduleQuery = useNextShiftForEmployee({
    businessId,
    employeeId,
    dayKey,
    enabled: Boolean(businessId && employeeId && linked && !canEmployee),
  });

  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!linked || canEmployee) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [linked, canEmployee]);

  const derived = useMemo(
    () => deriveEmployeeModeFromSchedule(nowMs, scheduleQuery.data?.entries ?? []),
    [nowMs, scheduleQuery.data?.entries],
  );

  useEffect(() => {
    if (!linked || canEmployee || !scheduleQuery.isSuccess || !scheduleQuery.data) return;
    const d = deriveEmployeeModeFromSchedule(
      Date.now(),
      scheduleQuery.data.entries,
    );
    if (!d.scheduleAllowsEmployeeNow) return;
    let cancelled = false;
    void getCurrentUser().then((me) => {
      if (cancelled || !me.ok || !me.data) return;
      dispatch({ type: "AUTH_SUCCESS", payload: me.data });
    });
    return () => {
      cancelled = true;
    };
  }, [linked, canEmployee, scheduleQuery.isSuccess, scheduleQuery.data, dispatch]);

  const onCountdownComplete = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["schedules", "employeeDay"] });
    const me = await getCurrentUser();
    if (me.ok && me.data) {
      dispatch({ type: "AUTH_SUCCESS", payload: me.data });
    }
  }, [dispatch, queryClient]);

  if (!userId) {
    return <Navigate to="/" replace />;
  }

  if (!linked || !sessionUser) {
    return <Navigate to={`/${userId}/customer/home`} replace />;
  }

  const showCountdown =
    !canEmployee && derived.countdownTargetMs !== null;

  const employeeDescription = canEmployee
    ? t("employeeHelp.canEmployee")
    : showCountdown
      ? t("employeeHelp.countdownSoon")
      : t("employeeHelp.blocked");

  const goCustomer = async () => {
    setError(null);
    try {
      await setModeAndRefresh("customer");
      navigate(canonicalUserCustomerHomePath(sessionUser), { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.generic"));
    }
  };

  const goEmployee = async () => {
    if (!canEmployee) return;
    setError(null);
    try {
      await setModeAndRefresh("employee");
      navigate(canonicalUserEmployeeHomePath(sessionUser), { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.generic"));
    }
  };

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col bg-neutral-100">
      <Navbar />
      <main className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>{t("title")}</CardTitle>
            <CardDescription>{t("description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error ? <Alert>{error}</Alert> : null}
            <Button
              type="button"
              className="w-full"
              disabled={isSettingMode}
              aria-busy={isSettingMode || undefined}
              onClick={() => void goCustomer()}
            >
              {t("continueCustomer")}
            </Button>
            <div className="space-y-2 border-t border-neutral-200 pt-4">
              <p className="text-sm text-neutral-600">{employeeDescription}</p>
              {showCountdown && derived.countdownTargetMs !== null ? (
                <EmployeeModeCountdown
                  targetMs={derived.countdownTargetMs}
                  onReachZero={() => void onCountdownComplete()}
                  className="text-center text-sm font-medium text-neutral-700"
                />
              ) : null}
              <Button
                type="button"
                className="w-full"
                disabled={!canEmployee || isSettingMode}
                aria-busy={isSettingMode || undefined}
                onClick={() => void goEmployee()}
              >
                {t("continueEmployee")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
