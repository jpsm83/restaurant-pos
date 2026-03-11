# Order confirmation — `lib/orderConfirmation`

This module sends **order confirmation** after a customer pays for a self-order (or delivery, when that flow exists): an **email** (via nodemailer) and an **in-app notification** (Notification document pushed to the User's inbox) so the customer can show proof of payment to staff.

## Flow

- **Entry point:** `sendOrderConfirmation(userId, businessId, params)` — call fire-and-forget (e.g. `.catch(() => {})`) from the self-order route after `commitTransaction`, and from the delivery route when implemented.
- **Steps:** Fetch user email, build receipt message, call `sendReceiptEmail` (if email and SMTP configured) and `sendOrderConfirmationNotification` (creates Notification and pushes to `User.notifications`).
- **Failure handling:** All functions catch errors and log; they never throw. Missing SMTP or user email skips email only; in-app notification is still sent.

## Files

- `buildReceiptMessage.ts` — Builds short receipt text (ref, total paid, "show to staff").
- `sendReceiptEmail.ts` — Sends one email via nodemailer; no-op if SMTP env missing.
- `sendOrderConfirmationNotification.ts` — Creates a Notification (type Info) and pushes to `User.notifications`.
- `sendOrderConfirmation.ts` — Orchestrator: user lookup, build message, send email + notification.

## Environment (email)

For email to be sent, set:

- `SMTP_HOST` — SMTP server host.
- `SMTP_PORT` — SMTP port (e.g. 587, 465).
- `SMTP_USER` — Auth username.
- `SMTP_PASS` — Auth password.
- `SMTP_FROM` (optional) — From address; defaults to `SMTP_USER` if unset.

If these are not set, order confirmation still succeeds and the in-app notification is created; only the email is skipped.
