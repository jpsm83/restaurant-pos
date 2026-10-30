import { useAuthConfigQuery } from "@/auth/api";
import { getGoogleClientId } from "@/auth/google";

/** Google sign-in is offered only when configured on both client and server. */
export function useGoogleSignInEnabled(): boolean {
  const { data: authConfig } = useAuthConfigQuery();
  return (
    Boolean(getGoogleClientId()) && authConfig?.googleSignInEnabled === true
  );
}
