- review files on backend/src/comunications
- review logic cors backend/src/config

- NOT FOR NOW BUT VERY CRITICAL
    "
    Checking how in-app and live delivery work in this codebase so we can answer precisely.

    Short answer: they are not the same as phone OS push (the kind that pops on your lock screen from WhatsApp or mail). In this project, “in-app” means saved to your notification inbox in the database, plus an optional real-time WebSocket update while the web app is connected.

    What actually happens
    Source of truth = persisted inbox
    The docs state that in-app delivery persists the notification and updates each user’s inbox (User.notifications). That’s the reliable guarantee: the item exists for when you open the app or refresh the notifications list.

    “Live” = WebSocket push inside the open app
    There is a WebSocket path (/api/v1/notifications/live). When that is enabled and your browser tab has an open, authenticated connection, the server can push a notification.created event so the UI can update quickly—without you manually refetching. The README explicitly says live push is “best-effort acceleration” and does not replace persisted delivery.

    PC vs mobile in practice

    PC, web app open, tab active and WS connected: you can get something that feels like an instant “push” inside the web UI (if the frontend subscribes and shows a toast/banner).
    Tab closed, browser in background, or no WS: you generally won’t get an immediate on-screen event from this mechanism; the notification should still be there when you open the app again via the inbox/API.
    “This app on my mobile”: if that’s a mobile browser or wrapped web view, same idea: real-time only while that client keeps a live WebSocket to the backend. It is not described as using FCM/APNs (native mobile push), so you should not expect system-level “banner on locked phone” from this stack alone.
    Email
    Email is separate (SMTP). If email is enabled and your address is on file, you can get an email independent of the web app being open—but that’s email delivery, not the in-app WebSocket.

    Bottom line: for managers, “all managers notified” here means in-app record + optional live WebSocket to connected web clients + email when enabled. It does not automatically mean native push notifications on phone/desktop OS unless you add that layer (e.g. service worker + web push, or a native app with FCM/APNs) on top.
    "