import { useAuth } from "@/auth/store/AuthContext";
import { logout, setAccessToken } from "@/auth";
import { Button } from "@/components/ui/button";
import NotificationsVirtualList from "@/notifications/components/NotificationsVirtualList";
import { useNotifications } from "@/notifications/store/NotificationsContext";
import { selectNotificationCounters } from "@/notifications/store/selectors";

export default function PostLoginPage() {
  const { state, dispatch } = useAuth();
  const { state: notificationsState } = useNotifications();
  const counters = selectNotificationCounters(notificationsState.items);

  const handleLogout = async () => {
    await logout();
    setAccessToken(null);
    localStorage.removeItem("auth_had_session");
    dispatch({ type: "AUTH_CLEAR" });
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-100 p-4">
      <section className="w-full max-w-2xl rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-neutral-900">Logged in</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Welcome, {state.user?.email ?? "user"}.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-neutral-600">
          <p>Unread: {counters.unreadCount}</p>
          <p>Deleted: {counters.deletedCount}</p>
        </div>
        <div className="mt-4">
          <NotificationsVirtualList items={notificationsState.items} />
        </div>
        <Button className="mt-6 w-full" variant="outline" onClick={handleLogout}>
          Log out
        </Button>
      </section>
    </main>
  );
}
