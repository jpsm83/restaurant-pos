import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { getCurrentUser, useAuth } from "@/auth";
import type { AuthUser } from "@/auth/types";
import { AccountMenuPopover } from "@/components/AccountMenuPopover";
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

function ModeChoiceCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="mt-auto">{children}</CardContent>
    </Card>
  );
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
      Unlocks in {label}
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
 * `/:userId/mode` — staff choose **customer** vs **employee**; persists `auth_mode` then navigates (Phase 3.3).
 * Phase 3.4: schedule-backed countdown until the server allows employee login (JWT `canLogAsEmployee`).
 */
export default function ChooseEmployeeModePage() {
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
    return <Navigate to={`/${userId}/customer`} replace />;
  }

  const showCountdown =
    !canEmployee && derived.countdownTargetMs !== null;

  const employeeDescription = canEmployee
    ? "Open the staff workspace for your linked business."
    : showCountdown
      ? "Your shift window opens soon. You can log in five minutes before it starts."
      : "Employee mode is not available right now (schedule or permissions).";

  const goCustomer = async () => {
    setError(null);
    try {
      await setModeAndRefresh("customer");
      navigate(`/${userId}/customer`, { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    }
  };

  const goEmployee = async () => {
    if (!canEmployee) return;
    setError(null);
    try {
      await setModeAndRefresh("employee");
      navigate(`/${userId}/employee`, { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    }
  };

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col bg-neutral-100">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-neutral-200 bg-white px-4 py-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
          <Link to="/" className="flex items-center gap-3">
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
          <span className="hidden text-sm text-neutral-500 sm:inline">Choose mode</span>
        </div>
        <AccountMenuPopover session={sessionUser} />
      </header>
      <main className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 p-4">
        <div className="max-w-lg text-center">
          <h1 className="text-2xl font-semibold text-neutral-900">How do you want to continue?</h1>
          <p className="mt-2 text-sm text-neutral-600">
            Choose customer browsing or your staff tools. This updates your session mode for this browser.
          </p>
        </div>

        {error ? <Alert className="max-w-xl">{error}</Alert> : null}

        <div className="grid w-full max-w-2xl gap-4 md:grid-cols-2">
          <ModeChoiceCard
            title="Continue as customer"
            description="Browse and order like a guest. Use this when you are not on shift."
          >
            <Button
              type="button"
              className="w-full min-w-48"
              disabled={isSettingMode}
              aria-busy={isSettingMode || undefined}
              onClick={() => void goCustomer()}
            >
              Continue as customer
            </Button>
          </ModeChoiceCard>
          <ModeChoiceCard
            title="Continue as employee"
            description={employeeDescription}
          >
            {showCountdown && derived.countdownTargetMs !== null ? (
              <EmployeeModeCountdown
                targetMs={derived.countdownTargetMs}
                onReachZero={() => void onCountdownComplete()}
                className="mb-3 text-center text-sm font-medium text-neutral-700"
              />
            ) : null}
            <Button
              type="button"
              className="w-full min-w-48"
              disabled={!canEmployee || isSettingMode}
              aria-busy={isSettingMode || undefined}
              onClick={() => void goEmployee()}
            >
              Continue as employee
            </Button>
          </ModeChoiceCard>
        </div>
      </main>
    </div>
  );
}
