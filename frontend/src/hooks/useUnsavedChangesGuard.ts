import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

type UseUnsavedChangesGuardOptions = {
  isDirty: boolean;
  isSubmitting?: boolean;
  enabled?: boolean;
};

type UseUnsavedChangesGuardResult = {
  isDialogOpen: boolean;
  isLeaving: boolean;
  shouldGuard: boolean;
  stayOnPage: () => void;
  leavePage: () => void;
};

/**
 * Generic navigation guard for dirty forms:
 * - blocks in-app route transitions through React Router
 * - warns on browser/tab close via beforeunload
 * - exposes dialog state and "stay/leave" handlers for reusable confirmation UIs.
 */
export function useUnsavedChangesGuard({
  isDirty,
  isSubmitting = false,
  enabled = true,
}: UseUnsavedChangesGuardOptions): UseUnsavedChangesGuardResult {
  const shouldGuard = useMemo(
    () => enabled && isDirty && !isSubmitting,
    [enabled, isDirty, isSubmitting],
  );
  const navigate = useNavigate();
  const location = useLocation();
  const [declarativeDialogOpen, setDeclarativeDialogOpen] = useState(false);
  const [declarativeLeaving, setDeclarativeLeaving] = useState(false);
  const pendingPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (!shouldGuard) {
      pendingPathRef.current = null;
      return;
    }

    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest("a[href]");
      if (!anchor) return;
      if (anchor.hasAttribute("download")) return;
      if (anchor.getAttribute("target") === "_blank") return;

      const href = anchor.getAttribute("href");
      if (!href) return;
      const url = new URL(href, window.location.href);
      if (url.origin !== window.location.origin) return;

      const nextPath = `${url.pathname}${url.search}${url.hash}`;
      const currentPath = `${location.pathname}${location.search}${location.hash}`;
      if (nextPath === currentPath) return;

      event.preventDefault();
      event.stopPropagation();
      pendingPathRef.current = nextPath;
      setDeclarativeDialogOpen(true);
    };

    document.addEventListener("click", handleDocumentClick, true);
    return () => {
      document.removeEventListener("click", handleDocumentClick, true);
    };
  }, [location.hash, location.pathname, location.search, shouldGuard]);

  useEffect(() => {
    if (!shouldGuard) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [shouldGuard]);

  const stayOnPage = () => {
    pendingPathRef.current = null;
    setDeclarativeDialogOpen(false);
    setDeclarativeLeaving(false);
  };

  const leavePage = () => {
    const nextPath = pendingPathRef.current;
    if (!nextPath) return;
    pendingPathRef.current = null;
    setDeclarativeLeaving(true);
    setDeclarativeDialogOpen(false);
    navigate(nextPath);
    setDeclarativeLeaving(false);
  };

  const isDialogOpen = shouldGuard ? declarativeDialogOpen : false;
  const isLeaving = shouldGuard ? declarativeLeaving : false;

  return {
    isDialogOpen,
    isLeaving,
    shouldGuard,
    stayOnPage,
    leavePage,
  };
}
