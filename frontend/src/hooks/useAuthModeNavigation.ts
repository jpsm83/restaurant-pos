/**
 * Switch the session's Customer | Business mode and then move to a destination.
 *
 * Wraps the existing `POST /auth/set-mode` mutation (which invalidates the
 * `auth.mode` query) so the minimal Open business and return-to-customer paths
 * share one failure contract.
 */
import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSetAuthModeMutation, type AuthMode } from "@/services/authMode";
import {
  toServiceRequestError,
  type ServiceRequestError,
} from "@/services/serviceErrors";

export function useAuthModeNavigation() {
  const navigate = useNavigate();
  const setModeMutation = useSetAuthModeMutation();
  const [failure, setFailure] = useState<ServiceRequestError | null>(null);

  const switchModeAndNavigate = useCallback(
    async (mode: AuthMode, destination: string): Promise<void> => {
      setFailure(null);
      try {
        await setModeMutation.mutateAsync(mode);
        navigate(destination);
      } catch (error) {
        setFailure(toServiceRequestError(error, "modeSave"));
      }
    },
    [navigate, setModeMutation],
  );

  return {
    switchModeAndNavigate,
    failure,
    isSwitchingMode: setModeMutation.isPending,
  };
}
